import { normalizeGameProgress } from "./progress";
import type { GameProgress } from "../types/game";

export const GAME_STORAGE_KEY = "word-trail-mvp-progress";

type PersistedEnvelope = {
  state: GameProgress;
  version: number;
};

export function getPersistedGameProgress(progress: GameProgress): GameProgress {
  return {
    coins: progress.coins,
    unlockedLevelIds: progress.unlockedLevelIds,
    currentBookId: progress.currentBookId,
    currentUnitId: progress.currentUnitId,
    currentLevelId: progress.currentLevelId,
    levels: progress.levels,
    words: progress.words,
    studyStats: progress.studyStats
  };
}

export function serializePersistedGameProgress(
  progress: GameProgress,
  version = 1
) {
  return JSON.stringify({
    state: getPersistedGameProgress(progress),
    version
  });
}

export function deserializePersistedGameProgress(raw: string | null) {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedEnvelope> | GameProgress;
    const state =
      parsed && typeof parsed === "object" && "state" in parsed
        ? parsed.state
        : parsed;

    if (!state || typeof state !== "object") {
      return undefined;
    }

    const progress = state as Partial<GameProgress>;

    return normalizeGameProgress({
      coins: typeof progress.coins === "number" ? progress.coins : 0,
      unlockedLevelIds: Array.isArray(progress.unlockedLevelIds)
        ? progress.unlockedLevelIds
        : [],
      currentBookId:
        typeof progress.currentBookId === "string" ? progress.currentBookId : undefined,
      currentUnitId:
        typeof progress.currentUnitId === "string" ? progress.currentUnitId : undefined,
      currentLevelId:
        typeof progress.currentLevelId === "string" ? progress.currentLevelId : undefined,
      levels:
        progress.levels && typeof progress.levels === "object"
          ? progress.levels
          : {},
      words:
        progress.words && typeof progress.words === "object" ? progress.words : {},
      studyStats:
        progress.studyStats && typeof progress.studyStats === "object"
          ? progress.studyStats
          : {}
    } as GameProgress);
  } catch {
    return undefined;
  }
}
