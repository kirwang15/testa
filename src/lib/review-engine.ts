import type { VocabularyWord, WordLearningProgress } from "@/types/game";

export type ReviewOutcome = "correct" | "wrong" | "hint";

const REVIEW_INTERVAL_DAYS: Record<number, number> = {
  0: 1,
  1: 1,
  2: 3,
  3: 7,
  4: 14,
  5: 30
};

function clampMasteryLevel(masteryLevel: number) {
  return Math.max(0, Math.min(5, Math.floor(masteryLevel)));
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate.toISOString();
}

export function scheduleNextReview(
  progress: WordLearningProgress,
  outcome: ReviewOutcome,
  now = new Date()
) {
  const lastReviewed = now.toISOString();
  const masteryLevel =
    outcome === "wrong"
      ? Math.max(0, progress.masteryLevel - 1)
      : outcome === "hint"
        ? Math.max(0, progress.masteryLevel)
        : progress.masteryLevel;
  const intervalDays =
    outcome === "wrong"
      ? 1
      : outcome === "hint"
        ? Math.max(1, REVIEW_INTERVAL_DAYS[clampMasteryLevel(masteryLevel)] - 1)
        : REVIEW_INTERVAL_DAYS[clampMasteryLevel(masteryLevel)];

  return {
    ...progress,
    lastReviewed,
    nextReview: addDays(now, intervalDays)
  };
}

export function getDueWords(
  progressByWordId: Record<string, WordLearningProgress>,
  now = new Date()
) {
  const nowTime = now.getTime();

  return Object.values(progressByWordId)
    .filter((progress) => {
      return progress.nextReview ? Date.parse(progress.nextReview) <= nowTime : false;
    })
    .sort((left, right) => {
      return (
        Date.parse(left.nextReview ?? now.toISOString()) -
          Date.parse(right.nextReview ?? now.toISOString()) ||
        left.masteryLevel - right.masteryLevel ||
        left.wordId.localeCompare(right.wordId)
      );
    });
}

export function buildReviewQueue(
  words: VocabularyWord[],
  progressByWordId: Record<string, WordLearningProgress>,
  now = new Date()
) {
  const wordById = new Map(words.map((word) => [word.id, word]));

  return getDueWords(progressByWordId, now)
    .map((progress) => wordById.get(progress.wordId))
    .filter((word): word is VocabularyWord => Boolean(word));
}

export function getDailyReviewList(
  words: VocabularyWord[],
  progressByWordId: Record<string, WordLearningProgress>,
  now = new Date(),
  limit = 10
) {
  return buildReviewQueue(words, progressByWordId, now).slice(0, Math.max(0, limit));
}
