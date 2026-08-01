import type { GameProgress } from "@/types/game";
import { getLocalCalendarDateKey } from "../src/lib/learning-engine";

export type ParentLearningMetrics = {
  completedLevels: number;
  masteredWords: number;
  firstTryCorrectWords: number;
  completedDueReviews: number;
  actualHintEvents: number;
  recordedWrongAttempts: number;
  activeDays: number;
  studyStreak: number;
  lastActiveDate?: string;
};

function normalizeRecordedDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp)) return undefined;
  return new Date(timestamp).toISOString().slice(0, 10) === value
    ? value
    : undefined;
}

export function getParentLearningMetrics(
  progress: GameProgress,
  currentLocalDateKey = getLocalCalendarDateKey()
): ParentLearningMetrics {
  const levels = Object.values(progress.levels);
  const words = Object.values(progress.words);
  const activeDateKeys = Array.from(
    new Set((progress.studyStats.activeDateKeys ?? []).map(normalizeRecordedDate).filter(
      (date): date is string => Boolean(date)
    ))
  );

  const sortedActiveDateKeys = activeDateKeys.sort();
  const latestActiveDate = sortedActiveDateKeys.at(-1);
  const daysBetween = (earlier: string, later: string) =>
    Math.round(
      (Date.parse(`${later}T00:00:00.000Z`) -
        Date.parse(`${earlier}T00:00:00.000Z`)) /
        (24 * 60 * 60 * 1000)
    );
  let currentStreak = 0;
  if (
    latestActiveDate &&
    normalizeRecordedDate(currentLocalDateKey) &&
    daysBetween(latestActiveDate, currentLocalDateKey) >= 0 &&
    daysBetween(latestActiveDate, currentLocalDateKey) <= 1
  ) {
    currentStreak = 1;
    for (let index = sortedActiveDateKeys.length - 2; index >= 0; index -= 1) {
      if (
        daysBetween(
          sortedActiveDateKeys[index]!,
          sortedActiveDateKeys[index + 1]!
        ) !== 1
      ) {
        break;
      }
      currentStreak += 1;
    }
  }

  return {
    completedLevels: levels.filter((level) => level.completed).length,
    masteredWords: words.filter(
      (word) => word.correctCount > 0 && word.masteryLevel >= 4
    ).length,
    firstTryCorrectWords: Math.max(0, progress.studyStats.firstTryCorrectWords ?? 0),
    completedDueReviews: Math.max(0, progress.studyStats.completedDueReviews ?? 0),
    actualHintEvents: Math.max(0, progress.studyStats.actualHintEvents ?? 0),
    recordedWrongAttempts: words.reduce(
      (total, word) => total + Math.max(0, word.wrongCount),
      0
    ),
    activeDays: activeDateKeys.length,
    studyStreak: currentStreak,
    lastActiveDate: latestActiveDate
  };
}
