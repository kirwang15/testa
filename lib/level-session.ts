import type { LevelProgress } from "../types/game";

export function getLevelScopedAttemptProgress(
  sessionLevelId: string,
  currentLevelId: string,
  attemptProgress: LevelProgress | undefined
) {
  return sessionLevelId === currentLevelId ? attemptProgress : undefined;
}
