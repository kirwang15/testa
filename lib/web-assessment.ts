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
  schemaVersion: 2;
  policyVersion: 2;
  bankVersion: string;
  generatorVersion: string;
  sourceHash: string;
  estimateRange: { min: number; max: number };
  calibrationStatus: "proxy-v1";
  anchorProfiles: Array<{
    id: AssessmentAnchor;
    estimateMin: number;
    estimateMax: number;
    priorMeanTheta: number;
    priorStandardDeviation: number;
  }>;
  broadPhaseRules: {
    totalItems: number;
    realItems: number;
    pseudowordItems: number;
    realBands: number[];
    pseudowordSlots: number[];
    pseudowordBands: number[];
  };
  stoppingRules: {
    minimumScoringItems: number;
    maximumScoringItems: number;
    wrapUpItems: number;
    minimumMultipleChoiceItems: number;
    minimumBasicItems: number;
    minimumAdvancedItems: number;
    minimumTargetItems: number;
    standardErrorThreshold: number;
    relativeEstimateChangeThreshold: number;
    stableEstimateChanges: number;
    informationThreshold: number;
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
  estimateHistory: number[];
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
  reconcileAssessmentState,
  saveAssessmentState,
  type AssessmentStoredState
} from "./web-assessment-storage";

export async function loadAssessmentBank(signal?: AbortSignal) {
  const response = await fetch("/content/assessment/bank-v1.json", {
    credentials: "same-origin",
    signal
  });
  if (!response.ok) throw new Error(`Assessment bank unavailable (${response.status})`);
  const candidate = (await response.json()) as AssessmentBank;
  if (
    candidate.schemaVersion !== 2 ||
    candidate.policyVersion !== 2 ||
    !candidate.bankVersion.startsWith("assessment-proxy-v2-") ||
    candidate.generatorVersion !== "assessment-bank-generator-v2" ||
    !/^[a-f0-9]{64}$/.test(candidate.sourceHash) ||
    candidate.bankVersion !==
      `assessment-proxy-v2-${candidate.sourceHash.slice(0, 16)}` ||
    candidate.calibrationStatus !== "proxy-v1" ||
    candidate.broadPhaseRules.totalItems !== 20 ||
    candidate.broadPhaseRules.realItems !== 16 ||
    candidate.broadPhaseRules.pseudowordItems !== 4 ||
    candidate.stoppingRules.minimumScoringItems !== 48 ||
    candidate.stoppingRules.maximumScoringItems !== 76 ||
    candidate.stoppingRules.wrapUpItems !== 4 ||
    candidate.stoppingRules.minimumMultipleChoiceItems !== 12 ||
    candidate.stoppingRules.minimumBasicItems !== 4 ||
    candidate.stoppingRules.minimumAdvancedItems !== 4 ||
    candidate.stoppingRules.minimumTargetItems !== 4 ||
    candidate.stoppingRules.standardErrorThreshold !== 0.32 ||
    candidate.stoppingRules.relativeEstimateChangeThreshold !== 0.03 ||
    candidate.stoppingRules.stableEstimateChanges !== 6 ||
    candidate.stoppingRules.informationThreshold !== 0.08 ||
    candidate.items.length !== 1440 ||
    candidate.items.filter((item) => item.itemType === "realWord").length !== 1200 ||
    candidate.items.filter((item) => item.itemType === "pseudoword").length !== 240
  ) {
    throw new Error("Assessment bank failed validation");
  }
  return candidate;
}

export function startAssessment(
  bank: AssessmentBank,
  anchor: AssessmentAnchor,
  options: { seed?: number; startedAt?: Date } = {}
): AssessmentSession {
  const startedAt = options.startedAt ?? new Date();
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
    seed: options.seed ?? startedAt.getTime(),
    phase: "broad",
    responses: [],
    theta: profile.priorMeanTheta,
    standardError: profile.priorStandardDeviation,
    estimate,
    estimateLower,
    estimateUpper,
    reliability: "good",
    coverage: { basic: 0, advanced: 0, target: 0 },
    estimateHistory: [estimate],
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
    if (slot < 0 || slot >= bank.broadPhaseRules.totalItems) {
      throw new Error("Broad phase is outside its configured policy");
    }
    const pseudoOrdinal = bank.broadPhaseRules.pseudowordSlots.indexOf(slot);
    const pseudo = pseudoOrdinal >= 0;
    const realOrdinal = slot - bank.broadPhaseRules.pseudowordSlots.filter(
      (value) => value < slot
    ).length;
    item = pickItem(
      bank,
      pseudo ? "pseudoword" : "realWord",
      pseudo
        ? bank.broadPhaseRules.pseudowordBands[pseudoOrdinal]
        : bank.broadPhaseRules.realBands[realOrdinal],
      usedIds,
      session.seed,
      slot
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
    const quota = nextCoverageQuota(bank, session);
    const preferredBand = quota?.preferredBand ?? bandForEstimate(session.estimate);
    item = pickItem(
      bank,
      "realWord",
      preferredBand,
      usedIds,
      session.seed,
      100 + adaptiveIndex,
      quota?.predicate
    );
  } else {
    const wrapIndex = session.responses.filter((response) => response.phase === "wrapUp").length;
    const preferredBand = Math.max(1, Math.min(20, Math.round(session.estimate / 1000) - 3));
    item = pickItem(
      bank,
      "realWord",
      preferredBand,
      usedIds,
      session.seed,
      500 + wrapIndex
    );
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
  if (!skipped && question.type === "yesNo" && typeof answer.recognized !== "boolean") {
    throw new Error("Yes/no assessment answer is missing");
  }
  if (
    !skipped &&
    question.type === "multipleChoice" &&
    (!Number.isInteger(answer.selectedOptionIndex) ||
      answer.selectedOptionIndex! < 0 ||
      answer.selectedOptionIndex! >= question.item.options.length)
  ) {
    throw new Error("Multiple-choice assessment answer is out of range");
  }
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
  const estimateHistory = [...(session.estimateHistory ?? [session.estimate])];
  const latest = responses.at(-1)!;
  if (
    latest.scored &&
    latest.itemType === "realWord" &&
    latest.phase !== "wrapUp" &&
    !latest.lowEffort
  ) {
    estimateHistory.push(posterior.estimate);
  }
  let phase = session.phase;
  if (phase === "broad" && scoringScreens >= bank.broadPhaseRules.totalItems) phase = "adaptive";
  else if (phase === "adaptive") {
    const reachedMaximum = scoringScreens >= bank.stoppingRules.maximumScoringItems;
    const converged =
      scoredCount >= bank.stoppingRules.minimumScoringItems &&
      multipleChoiceCount >= bank.stoppingRules.minimumMultipleChoiceItems &&
      hasCoverageQuotas(bank, responses, session.selectedAnchor) &&
      posterior.standardError <= bank.stoppingRules.standardErrorThreshold &&
      hasStableEstimate(bank, estimateHistory) &&
      nextExpectedInformationGain(bank, session, responses, posterior) <
        bank.stoppingRules.informationThreshold;
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
    estimateHistory,
    durationMs: session.durationMs + Math.max(0, answer.responseTimeMs)
  };
  return { session: nextSession, showCarefulWarning };
}

function pickItem(
  bank: AssessmentBank,
  kind: AssessmentItem["itemType"],
  preferredBand: number,
  usedIds: Set<string>,
  seed: number,
  salt: number,
  predicate?: (item: AssessmentItem) => boolean
) {
  for (let distance = 0; distance < 20; distance += 1) {
    const bands = new Set([preferredBand - distance, preferredBand + distance]);
    const candidates = bank.items
      .filter(
        (item) =>
          item.itemType === kind &&
          bands.has(item.frequencyBand) &&
          !usedIds.has(item.itemId) &&
          (!predicate || predicate(item))
      )
      .sort((a, b) => stableHash(a.itemId, seed, salt) - stableHash(b.itemId, seed, salt));
    if (candidates[0]) return candidates[0];
  }
  if (predicate) {
    return pickItem(bank, kind, preferredBand, usedIds, seed, salt);
  }
  throw new Error(`No unused ${kind} assessment item`);
}

function stableHash(value: string, seed: number, salt: number) {
  let hash = (0x811c9dc5 ^ seed ^ salt) >>> 0;
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

function bandForEstimate(estimate: number) {
  return Math.max(1, Math.min(20, Math.ceil(estimate / 1000)));
}

function targetBand(bank: AssessmentBank, anchor: AssessmentAnchor) {
  const profile = bank.anchorProfiles.find((entry) => entry.id === anchor)!;
  return bandForEstimate(Math.round((profile.estimateMin + profile.estimateMax) / 2));
}

function matchesTarget(
  response: Pick<AssessmentResponse, "frequencyBand" | "targetTags">,
  anchor: AssessmentAnchor
) {
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

function scoredRealResponses(responses: AssessmentResponse[]) {
  return responses.filter(
    (response) =>
      response.scored &&
      !response.lowEffort &&
      response.itemType === "realWord" &&
      response.phase !== "wrapUp"
  );
}

function coverageCounts(responses: AssessmentResponse[], anchor: AssessmentAnchor) {
  const real = scoredRealResponses(responses);
  return {
    basic: real.filter((response) => response.frequencyBand <= 7).length,
    advanced: real.filter(
      (response) => response.frequencyBand >= 8 && response.frequencyBand <= 14
    ).length,
    target: real.filter((response) => matchesTarget(response, anchor)).length
  };
}

function nextCoverageQuota(bank: AssessmentBank, session: AssessmentSession) {
  const counts = coverageCounts(session.responses, session.selectedAnchor);
  if (counts.basic < bank.stoppingRules.minimumBasicItems) {
    return {
      preferredBand: 5,
      predicate: (item: AssessmentItem) => item.frequencyBand <= 7
    };
  }
  if (counts.advanced < bank.stoppingRules.minimumAdvancedItems) {
    return {
      preferredBand: 11,
      predicate: (item: AssessmentItem) =>
        item.frequencyBand >= 8 && item.frequencyBand <= 14
    };
  }
  if (counts.target < bank.stoppingRules.minimumTargetItems) {
    return {
      preferredBand: targetBand(bank, session.selectedAnchor),
      predicate: (item: AssessmentItem) =>
        matchesTarget(item, session.selectedAnchor)
    };
  }
  return undefined;
}

function hasCoverageQuotas(
  bank: AssessmentBank,
  responses: AssessmentResponse[],
  anchor: AssessmentAnchor
) {
  const counts = coverageCounts(responses, anchor);
  return (
    counts.basic >= bank.stoppingRules.minimumBasicItems &&
    counts.advanced >= bank.stoppingRules.minimumAdvancedItems &&
    counts.target >= bank.stoppingRules.minimumTargetItems
  );
}

function hasStableEstimate(bank: AssessmentBank, history: number[]) {
  const changeCount = bank.stoppingRules.stableEstimateChanges;
  if (history.length < changeCount + 1) return false;
  const tail = history.slice(-(changeCount + 1));
  for (let index = 1; index < tail.length; index += 1) {
    const denominator = Math.max(100, tail[index - 1]);
    const relativeChange = Math.abs(tail[index] - tail[index - 1]) / denominator;
    if (relativeChange >= bank.stoppingRules.relativeEstimateChangeThreshold) return false;
  }
  return true;
}

function itemInformation(theta: number, item: AssessmentItem, guessing: number) {
  const logistic = 1 / (1 + Math.exp(-item.discrimination * (theta - item.difficulty)));
  const probability = guessing + (1 - guessing) * logistic;
  const derivative = item.discrimination * (1 - guessing) * logistic * (1 - logistic);
  return (derivative * derivative) / Math.max(1e-9, probability * (1 - probability));
}

function nextExpectedInformationGain(
  bank: AssessmentBank,
  session: AssessmentSession,
  responses: AssessmentResponse[],
  posterior: { theta: number; standardError: number; estimate: number }
) {
  const usedIds = new Set(responses.map((response) => response.itemId));
  const scoringScreens = responses.filter((response) => response.phase !== "wrapUp").length;
  const candidate = pickItem(
    bank,
    "realWord",
    bandForEstimate(posterior.estimate),
    usedIds,
    session.seed,
    900 + scoringScreens
  );
  const nextAdaptiveIndex = responses.filter(
    (response) => response.phase === "adaptive"
  ).length;
  const guessing = nextAdaptiveIndex % 2 === 0 ? candidate.guessing : 0;
  return (
    itemInformation(posterior.theta, candidate, guessing) *
    posterior.standardError *
    posterior.standardError
  );
}

function reliabilityFor(bank: AssessmentBank, responses: AssessmentResponse[]): AssessmentReliability {
  const pseudoFalsePositives = responses.filter(
    (response) => response.scored && response.itemType === "pseudoword" && response.recognized
  ).length;
  const pseudowordsPresented = responses.filter(
    (response) => response.scored && response.itemType === "pseudoword"
  ).length;
  const lowEffort = responses.filter((response) => response.lowEffort).length;
  const contradictions = responses.filter(
    (response) => response.scored && response.verifiesResponseIndex !== undefined && !response.correct
  ).length;
  const scoringScreens = responses.filter((response) => response.phase !== "wrapUp").length;
  const scored = responses.filter((response) => response.scored).length;
  if (
    (scoringScreens >= bank.stoppingRules.maximumScoringItems && scored < bank.stoppingRules.minimumScoringItems) ||
    (pseudowordsPresented > 0 && pseudoFalsePositives === pseudowordsPresented) ||
    lowEffort >= 3 ||
    contradictions >= 2
  ) return "invalid";
  if (pseudoFalsePositives >= 1 || lowEffort >= 2 || contradictions >= 1) return "caution";
  return "good";
}
