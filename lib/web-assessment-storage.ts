import type { AssessmentSession } from "./web-assessment";

export type AssessmentStoredState = {
  active?: AssessmentSession;
  history: AssessmentSession[];
};

function storageKey(profileId: string) {
  return `word-trail-web-assessment-v1:${profileId}`;
}

export function loadAssessmentState(profileId: string): AssessmentStoredState {
  if (typeof window === "undefined") return { history: [] };
  try {
    const parsed = JSON.parse(
      localStorage.getItem(storageKey(profileId)) ?? "null"
    ) as AssessmentStoredState | null;
    return parsed && Array.isArray(parsed.history)
      ? { active: parsed.active, history: parsed.history.slice(0, 10) }
      : { history: [] };
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
