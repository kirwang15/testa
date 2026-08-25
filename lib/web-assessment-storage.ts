import type { AssessmentSession } from "./web-assessment";

export type AssessmentStoredState = {
  active?: AssessmentSession;
  history: AssessmentSession[];
};

const anchors = new Set([
  "primarySchool",
  "middleSchool",
  "highSchool",
  "kaoyan",
  "ielts",
  "toefl",
  "unrestricted"
]);
const phases = new Set(["broad", "adaptive", "wrapUp", "complete"]);
const reliabilityStatuses = new Set(["good", "caution", "invalid"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validCoverage(value: unknown) {
  return (
    isRecord(value) &&
    [value.basic, value.advanced, value.target].every(
      (entry) => isFiniteNumber(entry) && entry >= 0 && entry <= 1
    )
  );
}

function validResponse(value: unknown) {
  if (!isRecord(value)) return false;
  const structurallyValid = (
    typeof value.itemId === "string" &&
    (value.itemType === "realWord" || value.itemType === "pseudoword") &&
    Number.isInteger(value.frequencyBand) &&
    (value.frequencyBand as number) >= 1 &&
    (value.frequencyBand as number) <= 20 &&
    Array.isArray(value.targetTags) &&
    value.targetTags.every((tag) => typeof tag === "string") &&
    (value.questionType === "yesNo" || value.questionType === "multipleChoice") &&
    (value.phase === "broad" || value.phase === "adaptive" || value.phase === "wrapUp") &&
    typeof value.correct === "boolean" &&
    typeof value.skipped === "boolean" &&
    isFiniteNumber(value.responseTimeMs) &&
    value.responseTimeMs >= 0 &&
    typeof value.scored === "boolean" &&
    typeof value.lowEffort === "boolean" &&
    (value.recognized === undefined || typeof value.recognized === "boolean") &&
    (value.selectedOptionIndex === undefined || Number.isInteger(value.selectedOptionIndex)) &&
    (value.verifiesResponseIndex === undefined || Number.isInteger(value.verifiesResponseIndex))
  );
  if (!structurallyValid) return false;
  if (value.phase === "broad" && value.questionType !== "yesNo") return false;
  if (
    value.phase === "wrapUp" &&
    (value.scored !== false || value.questionType !== "yesNo")
  ) {
    return false;
  }
  if (value.itemType === "pseudoword" && value.questionType !== "yesNo") return false;
  if (value.questionType === "multipleChoice" && value.itemType !== "realWord") {
    return false;
  }
  return true;
}

function phasesAreMonotonic(responses: AssessmentSession["responses"]) {
  const order = { broad: 0, adaptive: 1, wrapUp: 2 } as const;
  let latest = 0;
  for (const response of responses) {
    const current = order[response.phase as keyof typeof order];
    if (current < latest) return false;
    latest = current;
  }
  return true;
}

function phaseMatchesResponses(
  value: Record<string, unknown>,
  responses: AssessmentSession["responses"],
  mode: "active" | "history"
) {
  if (!phasesAreMonotonic(responses)) return false;
  if (mode === "history") {
    if (value.phase !== "complete") return false;
    // Historical proxy-v1 results use the earlier 10 + 2 policy. Keep them
    // readable after a bank upgrade while enforcing the exact v2 state shape
    // for results created by the current bank.
    if (!String(value.bankVersion).startsWith("assessment-proxy-v2-")) {
      return responses.length > 0;
    }
  } else if (value.phase === "complete") {
    return false;
  }

  const broad = responses.filter((response) => response.phase === "broad").length;
  const adaptive = responses.filter((response) => response.phase === "adaptive").length;
  const wrapUp = responses.filter((response) => response.phase === "wrapUp").length;
  const scoringScreens = broad + adaptive;

  if (value.phase === "broad") {
    return broad === responses.length && broad < 20;
  }
  if (value.phase === "adaptive") {
    return broad === 20 && wrapUp === 0 && scoringScreens < 76;
  }
  if (value.phase === "wrapUp") {
    return (
      broad === 20 &&
      scoringScreens >= 48 &&
      scoringScreens <= 76 &&
      wrapUp >= 0 &&
      wrapUp < 4
    );
  }
  return (
    value.phase === "complete" &&
    broad === 20 &&
    scoringScreens >= 48 &&
    scoringScreens <= 76 &&
    wrapUp === 4 &&
    responses.length >= 52 &&
    responses.length <= 80
  );
}

export function normalizeAssessmentSession(
  value: unknown,
  mode: "active" | "history"
): AssessmentSession | undefined {
  if (!isRecord(value)) return undefined;
  const estimateHistory = Array.isArray(value.estimateHistory) &&
    value.estimateHistory.every(isFiniteNumber)
    ? value.estimateHistory
    : mode === "history" && isFiniteNumber(value.estimate)
      ? [value.estimate]
      : undefined;
  if (
    typeof value.sessionId !== "string" ||
    !anchors.has(String(value.selectedAnchor)) ||
    typeof value.bankVersion !== "string" ||
    !Number.isInteger(value.seed) ||
    !phases.has(String(value.phase)) ||
    !Array.isArray(value.responses) ||
    value.responses.length > 80 ||
    !value.responses.every(validResponse) ||
    !isFiniteNumber(value.theta) ||
    !isFiniteNumber(value.standardError) ||
    value.standardError <= 0 ||
    !isFiniteNumber(value.estimate) ||
    !isFiniteNumber(value.estimateLower) ||
    !isFiniteNumber(value.estimateUpper) ||
    value.estimateLower > value.estimate ||
    value.estimate > value.estimateUpper ||
    !reliabilityStatuses.has(String(value.reliability)) ||
    !validCoverage(value.coverage) ||
    !estimateHistory ||
    typeof value.startedAt !== "string" ||
    !Number.isFinite(Date.parse(value.startedAt)) ||
    !isFiniteNumber(value.durationMs) ||
    value.durationMs < 0
  ) {
    return undefined;
  }
  const candidate = { ...value, estimateHistory } as unknown as AssessmentSession;
  return phaseMatchesResponses(value, candidate.responses, mode)
    ? candidate
    : undefined;
}

export function reconcileAssessmentState(
  state: AssessmentStoredState,
  bankVersion: string
): AssessmentStoredState {
  const history = state.history
    .map((session) => normalizeAssessmentSession(session, "history"))
    .filter((session): session is AssessmentSession => Boolean(session))
    .slice(0, 10);
  const active = normalizeAssessmentSession(state.active, "active");
  return active?.bankVersion === bankVersion
    ? { active, history }
    : { history };
}

function storageKey(profileId: string) {
  return `word-trail-web-assessment-v1:${profileId}`;
}

export function loadAssessmentState(profileId: string): AssessmentStoredState {
  if (typeof window === "undefined") return { history: [] };
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(storageKey(profileId)) ?? "null"
    );
    if (!isRecord(parsed) || !Array.isArray(parsed.history)) {
      return { history: [] };
    }
    const history = parsed.history
      .map((session) => normalizeAssessmentSession(session, "history"))
      .filter((session): session is AssessmentSession => Boolean(session))
      .slice(0, 10);
    const active = normalizeAssessmentSession(parsed.active, "active");
    return active ? { active, history } : { history };
  } catch {
    return { history: [] };
  }
}

export function saveAssessmentState(
  profileId: string,
  state: AssessmentStoredState
) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    storageKey(profileId),
    JSON.stringify({ active: state.active, history: state.history.slice(0, 10) })
  );
}
