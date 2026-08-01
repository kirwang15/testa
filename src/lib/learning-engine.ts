import type {
  LearningSnapshot,
  LearningStatistics,
  ReviewReason,
  WordLearningProgress
} from "@/types/game";

export const MAX_MASTERY_LEVEL = 5;
export const MASTERED_WORD_LEVEL = 4;

export function createEmptyWordLearningProgress(wordId: string): WordLearningProgress {
  return {
    wordId,
    masteryLevel: 0,
    correctCount: 0,
    wrongCount: 0,
    streak: 0,
    favorite: false,
    difficult: false,
    reviewReasons: [],
    firstTryCorrectRecorded: false
  };
}

export function createInitialLearningStatistics(): LearningStatistics {
  return {
    totalWordsLearned: 0,
    totalWordsMastered: 0,
    totalStudyMinutes: 0,
    studyStreak: 0,
    firstTryCorrectWords: 0,
    completedDueReviews: 0,
    actualHintEvents: 0,
    activeDateKeys: []
  };
}

export function createInitialLearningSnapshot(): LearningSnapshot {
  return {
    words: {},
    studyStats: createInitialLearningStatistics()
  };
}

export function normalizeWordLearningProgress(
  value: Partial<WordLearningProgress> | undefined,
  wordId: string
): WordLearningProgress {
  const correctCount =
    typeof value?.correctCount === "number" && Number.isFinite(value.correctCount)
      ? Math.max(0, Math.floor(value.correctCount))
      : 0;
  const wrongCount =
    typeof value?.wrongCount === "number" && Number.isFinite(value.wrongCount)
      ? Math.max(0, Math.floor(value.wrongCount))
      : 0;
  const explicitReviewReasons = Array.isArray(value?.reviewReasons)
    ? Array.from(
        new Set(
          value.reviewReasons.filter(
            (reason): reason is ReviewReason => reason === "wrong" || reason === "clue"
          )
        )
      )
    : undefined;
  const reviewReasons: ReviewReason[] = explicitReviewReasons ?? (
    value?.difficult === true && wrongCount > 0
      ? ["wrong"]
      : value?.difficult === true && correctCount > 0
        ? ["clue"]
        : []
  );

  return {
    wordId,
    sourceBook:
      value?.sourceBook === 1 ||
      value?.sourceBook === 2 ||
      value?.sourceBook === 3 ||
      value?.sourceBook === 4
        ? value.sourceBook
        : undefined,
    contentRating:
      value?.contentRating === "all-ages" ||
      value?.contentRating === "13-plus" ||
      value?.contentRating === "parent-review"
        ? value.contentRating
        : undefined,
    contentVersion:
      typeof value?.contentVersion === "string" && value.contentVersion
        ? value.contentVersion
        : undefined,
    masteryLevel:
      typeof value?.masteryLevel === "number" && Number.isFinite(value.masteryLevel)
        ? Math.max(0, Math.min(MAX_MASTERY_LEVEL, Math.floor(value.masteryLevel)))
        : 0,
    correctCount,
    wrongCount,
    streak:
      typeof value?.streak === "number" && Number.isFinite(value.streak)
        ? Math.max(0, Math.floor(value.streak))
        : 0,
    favorite: value?.favorite === true,
    difficult: value?.difficult === true,
    reviewReasons,
    lastReviewed: typeof value?.lastReviewed === "string" ? value.lastReviewed : undefined,
    nextReview: typeof value?.nextReview === "string" ? value.nextReview : undefined,
    firstTryCorrectRecorded: value?.firstTryCorrectRecorded === true
  };
}

export function updateMastery(
  progress: WordLearningProgress,
  outcome: "correct" | "wrong",
  options?: {
    softened?: boolean;
  }
): WordLearningProgress {
  const reviewReasons = progress.reviewReasons ?? [];

  if (outcome === "wrong") {
    return {
      ...progress,
      masteryLevel: Math.max(0, progress.masteryLevel - 1),
      streak: 0,
      wrongCount: progress.wrongCount + 1
    };
  }

  return {
    ...progress,
    masteryLevel: Math.min(
      MAX_MASTERY_LEVEL,
      progress.masteryLevel + (options?.softened ? 0 : 1)
    ),
    streak: progress.streak + 1,
    correctCount: progress.correctCount + 1,
    difficult:
      options?.softened || reviewReasons.length > 0
        ? progress.difficult
        : false
  };
}

export function markWordCorrect(
  progress: WordLearningProgress,
  reviewedAt = new Date().toISOString(),
  options?: {
    softened?: boolean;
  }
): WordLearningProgress {
  return {
    ...updateMastery(progress, "correct", options),
    lastReviewed: reviewedAt
  };
}

export function markWordWrong(
  progress: WordLearningProgress,
  reviewedAt = new Date().toISOString()
): WordLearningProgress {
  const reviewReasons = progress.reviewReasons ?? [];

  return {
    ...updateMastery(progress, "wrong"),
    lastReviewed: reviewedAt,
    difficult: true,
    reviewReasons: reviewReasons.includes("wrong")
      ? reviewReasons
      : [...reviewReasons, "wrong"]
  };
}

export function markWordClueUsed(
  progress: WordLearningProgress
): WordLearningProgress {
  const reviewReasons = progress.reviewReasons ?? [];

  return {
    ...progress,
    difficult: true,
    reviewReasons: reviewReasons.includes("clue")
      ? reviewReasons
      : [...reviewReasons, "clue"]
  };
}

export function completeWordReview(
  progress: WordLearningProgress,
  reviewedAt = new Date().toISOString()
): WordLearningProgress {
  const correct = markWordCorrect(progress, reviewedAt);

  return {
    ...correct,
    difficult: false,
    reviewReasons: []
  };
}

export function toggleFavoriteWord(progress: WordLearningProgress) {
  return {
    ...progress,
    favorite: !progress.favorite
  };
}

export function setWordDifficult(
  progress: WordLearningProgress,
  difficult = true
): WordLearningProgress {
  return {
    ...progress,
    difficult
  };
}

export function getFavoriteWords(progressByWordId: Record<string, WordLearningProgress>) {
  return Object.values(progressByWordId).filter((progress) => progress.favorite);
}

export function getDifficultWords(progressByWordId: Record<string, WordLearningProgress>) {
  return Object.values(progressByWordId).filter((progress) => progress.difficult);
}

export function getReviewableDifficultWords(
  progressByWordId: Record<string, WordLearningProgress>
) {
  return getDifficultWords(progressByWordId).filter(
    (progress) =>
      (progress.reviewReasons?.length ?? 0) > 0 &&
      (progress.correctCount > 0 || progress.wrongCount > 0)
  );
}

export function getDisplayableFavoriteWords(
  progressByWordId: Record<string, WordLearningProgress>
) {
  return getFavoriteWords(progressByWordId).filter(
    (progress) => progress.correctCount > 0
  );
}

export function getMasteredWords(progressByWordId: Record<string, WordLearningProgress>) {
  return Object.values(progressByWordId).filter(
    (progress) =>
      progress.correctCount > 0 &&
      progress.masteryLevel >= MASTERED_WORD_LEVEL
  );
}

export function summarizeWordProgress(
  progresses: WordLearningProgress[]
) {
  return progresses.reduce(
    (summary, progress) => {
      if (progress.correctCount > 0) {
        summary.learnedWords += 1;
      }
      if (
        progress.correctCount > 0 &&
        progress.masteryLevel >= MASTERED_WORD_LEVEL
      ) {
        summary.masteredWords += 1;
      }
      if ((progress.reviewReasons?.length ?? 0) > 0) {
        summary.difficultWords += 1;
      }
      return summary;
    },
    { learnedWords: 0, masteredWords: 0, difficultWords: 0 }
  );
}

export function synchronizeLearningStatistics(
  baseStats: LearningStatistics,
  progressByWordId: Record<string, WordLearningProgress>
) {
  const allProgress = Object.values(progressByWordId);
  const summary = summarizeWordProgress(allProgress);

  return {
    ...baseStats,
    totalWordsLearned: summary.learnedWords,
    totalWordsMastered: summary.masteredWords
  };
}

export function recordStudySession(
  stats: LearningStatistics,
  studiedAt: string,
  minutes = 0,
  localDateKey?: string
): LearningStatistics {
  return recordLearningActivity({
    ...stats,
    totalStudyMinutes: stats.totalStudyMinutes + Math.max(0, Math.floor(minutes)),
  }, studiedAt, localDateKey);
}

function isValidDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value;
}

export function recordLearningActivity(
  stats: LearningStatistics,
  occurredAt = new Date().toISOString(),
  localDateKey = getLocalCalendarDateKey(new Date(occurredAt))
): LearningStatistics {
  const dateKey = localDateKey;
  if (!isValidDateKey(dateKey)) return stats;
  const activeDateKeys = Array.from(
    new Set([...(stats.activeDateKeys ?? []).filter(isValidDateKey), dateKey])
  ).sort();
  let studyStreak = 0;
  for (let index = activeDateKeys.length - 1; index >= 0; index -= 1) {
    if (index === activeDateKeys.length - 1) {
      studyStreak = 1;
      continue;
    }
    const current = Date.parse(`${activeDateKeys[index]}T00:00:00.000Z`);
    const next = Date.parse(`${activeDateKeys[index + 1]}T00:00:00.000Z`);
    if (next - current !== 24 * 60 * 60 * 1000) break;
    studyStreak += 1;
  }

  return {
    ...stats,
    activeDateKeys,
    studyStreak,
    lastStudyDate: activeDateKeys.at(-1)
  };
}

export function getLocalCalendarDateKey(date = new Date()) {
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function recordFirstTryCorrect(
  stats: LearningStatistics,
  occurredAt: string,
  localDateKey?: string
) {
  return recordLearningActivity(
    { ...stats, firstTryCorrectWords: (stats.firstTryCorrectWords ?? 0) + 1 },
    occurredAt,
    localDateKey
  );
}

export function recordCompletedDueReview(
  stats: LearningStatistics,
  occurredAt: string,
  localDateKey?: string
) {
  return recordLearningActivity(
    { ...stats, completedDueReviews: (stats.completedDueReviews ?? 0) + 1 },
    occurredAt,
    localDateKey
  );
}

export function recordActualHintEvent(
  stats: LearningStatistics,
  occurredAt: string,
  localDateKey?: string
) {
  return recordLearningActivity(
    { ...stats, actualHintEvents: (stats.actualHintEvents ?? 0) + 1 },
    occurredAt,
    localDateKey
  );
}
