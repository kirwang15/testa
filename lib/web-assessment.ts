export type AssessmentAnchor =
  | "primarySchool"
  | "middleSchool"
  | "highSchool"
  | "kaoyan"
  | "ielts"
  | "toefl"
  | "unrestricted";

export type AssessmentItem = {
  itemId: string;
  lemmaId: string;
  itemType: "realWord" | "pseudoword";
  spelling: string;
  frequencyBand: number;
  targetTags: string[];
  meaning: string;
  partOfSpeech: string;
  options: string[];
  correctOptionIndex: number;
  difficulty: number;
  discrimination: number;
  guessing: number;
  calibrationStatus: "proxy-v1";
  sourceId: string;
};

export type AssessmentBank = {
  schemaVersion: 1;
  bankVersion: string;
  estimateRange: { min: number; max: number };
  calibrationStatus: "proxy-v1";
  anchorProfiles: Array<{
    id: AssessmentAnchor;
    estimateMin: number;
    estimateMax: number;
    priorMeanTheta: number;
    priorStandardDeviation: number;
  }>;
  stoppingRules: {
    minimumScoringItems: number;
    maximumScoringItems: number;
    wrapUpItems: number;
    minimumMultipleChoiceItems: number;
    standardErrorThreshold: number;
  };
  items: AssessmentItem[];
};

export type AssessmentPhase = "broad" | "adaptive" | "wrapUp" | "complete";
export type AssessmentReliability = "good" | "caution" | "invalid";
export type AssessmentQuestionType = "yesNo" | "multipleChoice";

export type AssessmentResponse = {
  itemId: string;
  itemType: AssessmentItem["itemType"];
  frequencyBand: number;
  targetTags: string[];
  questionType: AssessmentQuestionType;
  phase: AssessmentPhase;
  recognized?: boolean;
  selectedOptionIndex?: number;
  correct: boolean;
  skipped: boolean;
  responseTimeMs: number;
  scored: boolean;
  lowEffort: boolean;
  verifiesResponseIndex?: number;
};

export type AssessmentSession = {
  sessionId: string;
  selectedAnchor: AssessmentAnchor;
  bankVersion: string;
  seed: number;
  phase: AssessmentPhase;
  responses: AssessmentResponse[];
  theta: number;
  standardError: number;
  estimate: number;
  estimateLower: number;
  estimateUpper: number;
  reliability: AssessmentReliability;
  coverage: { basic: number; advanced: number; target: number };
  startedAt: string;
  durationMs: number;
};

export type AssessmentQuestion = {
  questionId: string;
  phase: AssessmentPhase;
  type: AssessmentQuestionType;
  item: AssessmentItem;
  verifiesResponseIndex?: number;
};
export {
  loadAssessmentState,
  saveAssessmentState,
  type AssessmentStoredState
} from "./web-assessment-storage";

const BROAD_REAL_BANDS = [1, 4, 7, 10, 13, 16, 18, 20];
const BROAD_PSEUDO_SLOTS = new Set([3, 8]);

export async function loadAssessmentBank(signal?: AbortSignal) {
  const response = await fetch("/content/assessment/bank-v1.json", {
    credentials: "same-origin",
    signal
  });
  if (!response.ok) throw new Error(`Assessment bank unavailable (${response.status})`);
  const candidate = (await response.json()) as AssessmentBank;
  if (
    candidate.schemaVersion !== 1 ||
    candidate.calibrationStatus !== "proxy-v1" ||
    candidate.items.length !== 1440 ||
    candidate.items.filter((item) => item.itemType === "realWord").length !== 1200 ||
    candidate.items.filter((item) => item.itemType === "pseudoword").length !== 240
  ) {
    throw new Error("Assessment bank failed validation");
  }
  return candidate;
}

export function startAssessment(bank: AssessmentBank, anchor: AssessmentAnchor): AssessmentSession {
  const startedAt = new Date();
  const profile = bank.anchorProfiles.find((entry) => entry.id === anchor);
  if (!profile) throw new Error(`Unknown assessment anchor: ${anchor}`);
  const estimate = estimateForTheta(bank, profile.priorMeanTheta);
  const [estimateLower, estimateUpper] = confidenceBounds(
    bank,
    profile.priorMeanTheta,
    profile.priorStandardDeviation
  );
  return {
    sessionId: `assessment-${startedAt.getTime()}`,
    selectedAnchor: anchor,
    bankVersion: bank.bankVersion,
    seed: startedAt.getTime(),
    phase: "broad",
    responses: [],
    theta: profile.priorMeanTheta,
    standardError: profile.priorStandardDeviation,
    estimate,
    estimateLower,
    estimateUpper,
    reliability: "good",
    coverage: { basic: 0, advanced: 0, target: 0 },
    startedAt: startedAt.toISOString(),
    durationMs: 0
  };
}

export function nextAssessmentQuestion(
  bank: AssessmentBank,
  session: AssessmentSession
): AssessmentQuestion {
  if (session.bankVersion !== bank.bankVersion || session.phase === "complete") {
    throw new Error("Assessment session is not compatible with this bank");
  }
  const usedIds = new Set(session.responses.map((response) => response.itemId));
  let item: AssessmentItem;
  let type: AssessmentQuestionType = "yesNo";
  let verifiesResponseIndex: number | undefined;

  if (session.phase === "broad") {
    const slot = session.responses.filter((response) => response.phase === "broad").length;
    const pseudo = BROAD_PSEUDO_SLOTS.has(slot);
    const realOrdinal = slot - [...BROAD_PSEUDO_SLOTS].filter((value) => value < slot).length;
    item = pickItem(
      bank,
      pseudo ? "pseudoword" : "realWord",
      pseudo ? (slot === 3 ? 8 : 18) : BROAD_REAL_BANDS[realOrdinal],
      usedIds,
      session.seed + slot
    );
  } else if (session.phase === "adaptive") {
    const adaptiveIndex = session.responses.filter((response) => response.phase === "adaptive").length;
    type = adaptiveIndex % 2 === 0 ? "multipleChoice" : "yesNo";
    if (type === "multipleChoice") {
      for (let index = session.responses.length - 1; index >= 0; index -= 1) {
        const response = session.responses[index];
        const alreadyVerified = session.responses.some(
          (candidate) => candidate.verifiesResponseIndex === index
        );
        if (
          response.scored &&
          response.itemType === "realWord" &&
          response.questionType === "yesNo" &&
          response.recognized &&
          !alreadyVerified
        ) {
          const candidate = bank.items.find((entry) => entry.itemId === response.itemId);
          if (candidate) {
            item = candidate;
            verifiesResponseIndex = index;
            return questionFor(session, item, type, verifiesResponseIndex);
          }
        }
      }
    }
    const preferredBand = Math.max(1, Math.min(20, Math.ceil(session.estimate / 1000)));
    item = pickItem(bank, "realWord", preferredBand, usedIds, session.seed + 100 + adaptiveIndex);
  } else {
    const wrapIndex = session.responses.filter((response) => response.phase === "wrapUp").length;
    const preferredBand = Math.max(1, Math.min(20, Math.round(session.estimate / 1000) - 3));
    item = pickItem(bank, "realWord", preferredBand, usedIds, session.seed + 500 + wrapIndex);
  }

  return questionFor(session, item, type, verifiesResponseIndex);
}

function questionFor(
  session: AssessmentSession,
  item: AssessmentItem,
  type: AssessmentQuestionType,
  verifiesResponseIndex?: number
): AssessmentQuestion {
  return {
    questionId: `${session.responses.length + 1}-${item.itemId}-${type}`,
    phase: session.phase,
    type,
    item,
    verifiesResponseIndex
  };
}

export function submitAssessmentAnswer(
  bank: AssessmentBank,
  session: AssessmentSession,
  question: AssessmentQuestion,
  answer: {
    recognized?: boolean;
    selectedOptionIndex?: number;
    skipped?: boolean;
    responseTimeMs: number;
  }
) {
  const expected = nextAssessmentQuestion(bank, session);
  if (expected.questionId !== question.questionId) throw new Error("Assessment question is stale");
  const skipped = answer.skipped === true;
  const correct = skipped
    ? false
    : question.type === "yesNo"
      ? question.item.itemType === "pseudoword"
        ? answer.recognized === false
        : answer.recognized === true
      : answer.selectedOptionIndex === question.item.correctOptionIndex;
  let responses = [
    ...session.responses,
    {
      itemId: question.item.itemId,
      itemType: question.item.itemType,
      frequencyBand: question.item.frequencyBand,
      targetTags: question.item.targetTags,
      questionType: question.type,
      phase: question.phase,
      recognized: answer.recognized,
      selectedOptionIndex: answer.selectedOptionIndex,
      correct,
      skipped,
      responseTimeMs: Math.max(0, answer.responseTimeMs),
      scored: question.phase !== "wrapUp" && !skipped,
      lowEffort: false,
      verifiesResponseIndex: question.verifiesResponseIndex
    } satisfies AssessmentResponse
  ];

  let rapidStreak = 0;
  for (let index = responses.length - 1; index >= 0; index -= 1) {
    const response = responses[index];
    if (response.skipped || response.phase === "wrapUp" || response.responseTimeMs >= 500) break;
    rapidStreak += 1;
  }
  const showCarefulWarning = rapidStreak === 3;
  if (rapidStreak >= 3) {
    responses = responses.map((response, index) =>
      index >= responses.length - rapidStreak
        ? { ...response, lowEffort: true, scored: false }
        : response
    );
  }

  const posterior = posteriorFor(bank, session.selectedAnchor, responses);
  const scoringScreens = responses.filter((response) => response.phase !== "wrapUp").length;
  const scoredCount = responses.filter((response) => response.scored).length;
  const multipleChoiceCount = responses.filter(
    (response) => response.scored && response.questionType === "multipleChoice"
  ).length;
  let phase = session.phase;
  if (phase === "broad" && scoringScreens >= 10) phase = "adaptive";
  else if (phase === "adaptive") {
    const reachedMaximum = scoringScreens >= bank.stoppingRules.maximumScoringItems;
    const converged =
      scoredCount >= bank.stoppingRules.minimumScoringItems &&
      multipleChoiceCount >= bank.stoppingRules.minimumMultipleChoiceItems &&
      posterior.standardError <= Math.max(0.55, bank.stoppingRules.standardErrorThreshold);
    if (reachedMaximum || converged) phase = "wrapUp";
  } else if (
    phase === "wrapUp" &&
    responses.filter((response) => response.phase === "wrapUp").length >=
      bank.stoppingRules.wrapUpItems
  ) {
    phase = "complete";
  }

  const reliability = reliabilityFor(bank, responses);
  const nextSession: AssessmentSession = {
    ...session,
    phase,
    responses,
    ...posterior,
    reliability,
    coverage: coverageFor(responses, session.selectedAnchor),
    durationMs: session.durationMs + Math.max(0, answer.responseTimeMs)
  };
  return { session: nextSession, showCarefulWarning };
}

function pickItem(
  bank: AssessmentBank,
  kind: AssessmentItem["itemType"],
  preferredBand: number,
  usedIds: Set<string>,
  salt: number
) {
  for (let distance = 0; distance < 20; distance += 1) {
    const bands = new Set([preferredBand - distance, preferredBand + distance]);
    const candidates = bank.items
      .filter(
        (item) =>
          item.itemType === kind &&
          bands.has(item.frequencyBand) &&
          !usedIds.has(item.itemId)
      )
      .sort((a, b) => stableHash(a.itemId, salt) - stableHash(b.itemId, salt));
    if (candidates[0]) return candidates[0];
  }
  throw new Error(`No unused ${kind} assessment item`);
}

function stableHash(value: string, salt: number) {
  let hash = (0x811c9dc5 ^ salt) >>> 0;
  for (const character of value) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193) >>> 0;
  }
  return hash;
}

function posteriorFor(
  bank: AssessmentBank,
  anchor: AssessmentAnchor,
  responses: AssessmentResponse[]
) {
  const profile = bank.anchorProfiles.find((entry) => entry.id === anchor)!;
  const itemById = new Map(bank.items.map((item) => [item.itemId, item]));
  const points: Array<{ theta: number; logWeight: number }> = [];
  let maxLogWeight = Number.NEGATIVE_INFINITY;
  for (let theta = -6; theta <= 6.0001; theta += 0.1) {
    let logWeight = -0.5 * Math.pow((theta - profile.priorMeanTheta) / profile.priorStandardDeviation, 2);
    for (const response of responses) {
      if (!response.scored || response.lowEffort || response.itemType === "pseudoword" || response.phase === "wrapUp") continue;
      const item = itemById.get(response.itemId)!;
      const guessing = response.questionType === "multipleChoice" ? item.guessing : 0;
      const logistic = 1 / (1 + Math.exp(-item.discrimination * (theta - item.difficulty)));
      const probability = Math.min(1 - 1e-9, Math.max(1e-9, guessing + (1 - guessing) * logistic));
      logWeight += Math.log(response.correct ? probability : 1 - probability);
    }
    points.push({ theta, logWeight });
    maxLogWeight = Math.max(maxLogWeight, logWeight);
  }
  const weights = points.map((point) => Math.exp(point.logWeight - maxLogWeight));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const theta = points.reduce((sum, point, index) => sum + point.theta * weights[index], 0) / total;
  const variance = points.reduce(
    (sum, point, index) => sum + Math.pow(point.theta - theta, 2) * weights[index],
    0
  ) / total;
  const standardError = Math.sqrt(variance);
  const [estimateLower, estimateUpper] = confidenceBounds(bank, theta, standardError);
  return {
    theta,
    standardError,
    estimate: estimateForTheta(bank, theta),
    estimateLower,
    estimateUpper
  };
}

function estimateForTheta(bank: AssessmentBank, theta: number) {
  const raw = bank.estimateRange.max / (1 + Math.exp(-theta));
  return Math.max(bank.estimateRange.min, Math.min(bank.estimateRange.max, Math.round(raw / 100) * 100));
}

function confidenceBounds(bank: AssessmentBank, theta: number, standardError: number) {
  return [
    estimateForTheta(bank, theta - 1.96 * standardError),
    estimateForTheta(bank, theta + 1.96 * standardError)
  ] as const;
}

function matchesTarget(response: AssessmentResponse, anchor: AssessmentAnchor) {
  if (anchor === "primarySchool") return response.frequencyBand <= 3;
  if (anchor === "middleSchool") return response.frequencyBand >= 3 && response.frequencyBand <= 7;
  if (anchor === "highSchool") return response.frequencyBand >= 5 && response.frequencyBand <= 10;
  if (anchor === "kaoyan") return response.targetTags.includes("general") && response.frequencyBand >= 6;
  if (anchor === "ielts") return response.targetTags.includes("academic");
  if (anchor === "toefl") return response.targetTags.includes("academic") && response.frequencyBand >= 8;
  return response.frequencyBand >= 15;
}

function coverageFor(responses: AssessmentResponse[], anchor: AssessmentAnchor) {
  const real = responses.filter(
    (response) => response.scored && response.itemType === "realWord" && response.phase !== "wrapUp"
  );
  const ratio = (selected: AssessmentResponse[]) =>
    selected.length === 0 ? 0 : selected.filter((response) => response.correct).length / selected.length;
  return {
    basic: ratio(real.filter((response) => response.frequencyBand <= 7)),
    advanced: ratio(real.filter((response) => response.frequencyBand >= 8 && response.frequencyBand <= 14)),
    target: ratio(real.filter((response) => matchesTarget(response, anchor)))
  };
}

function reliabilityFor(bank: AssessmentBank, responses: AssessmentResponse[]): AssessmentReliability {
  const pseudoFalsePositives = responses.filter(
    (response) => response.scored && response.itemType === "pseudoword" && response.recognized
  ).length;
  const lowEffort = responses.filter((response) => response.lowEffort).length;
  const contradictions = responses.filter(
    (response) => response.scored && response.verifiesResponseIndex !== undefined && !response.correct
  ).length;
  const scoringScreens = responses.filter((response) => response.phase !== "wrapUp").length;
  const scored = responses.filter((response) => response.scored).length;
  if (
    (scoringScreens >= bank.stoppingRules.maximumScoringItems && scored < bank.stoppingRules.minimumScoringItems) ||
    pseudoFalsePositives >= 2 ||
    lowEffort >= 3 ||
    contradictions >= 2
  ) return "invalid";
  if (pseudoFalsePositives >= 1 || lowEffort >= 2 || contradictions >= 1) return "caution";
  return "good";
}
