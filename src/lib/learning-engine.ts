import type {
  LearningSnapshot,
  LearningStatistics,
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
    difficult: false
  };
}

export function createInitialLearningStatistics(): LearningStatistics {
  return {
    totalWordsLearned: 0,
    totalWordsMastered: 0,
    totalStudyMinutes: 0,
    studyStreak: 0
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
  return {
    wordId,
    masteryLevel:
      typeof value?.masteryLevel === "number" && Number.isFinite(value.masteryLevel)
        ? Math.max(0, Math.min(MAX_MASTERY_LEVEL, Math.floor(value.masteryLevel)))
        : 0,
    correctCount:
      typeof value?.correctCount === "number" && Number.isFinite(value.correctCount)
        ? Math.max(0, Math.floor(value.correctCount))
        : 0,
    wrongCount:
      typeof value?.wrongCount === "number" && Number.isFinite(value.wrongCount)
        ? Math.max(0, Math.floor(value.wrongCount))
        : 0,
    streak:
      typeof value?.streak === "number" && Number.isFinite(value.streak)
        ? Math.max(0, Math.floor(value.streak))
        : 0,
    favorite: value?.favorite === true,
    difficult: value?.difficult === true,
    lastReviewed: typeof value?.lastReviewed === "string" ? value.lastReviewed : undefined,
    nextReview: typeof value?.nextReview === "string" ? value.nextReview : undefined
  };
}

export function updateMastery(
  progress: WordLearningProgress,
  outcome: "correct" | "wrong",
  options?: {
    softened?: boolean;
  }
): WordLearningProgress {
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
    difficult: options?.softened ? progress.difficult : false
  };
}

export function markWordCorrect(
  progress: WordLearningProgress,
  reviewedAt = new Date().toISOString(),
  options?: {
    softened?: boolean;
  }
) {
  return {
    ...updateMastery(progress, "correct", options),
    lastReviewed: reviewedAt
  };
}

export function markWordWrong(
  progress: WordLearningProgress,
  reviewedAt = new Date().toISOString()
) {
  return {
    ...updateMastery(progress, "wrong"),
    lastReviewed: reviewedAt,
    difficult: true
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
) {
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

export function getMasteredWords(progressByWordId: Record<string, WordLearningProgress>) {
  return Object.values(progressByWordId).filter(
    (progress) => progress.masteryLevel >= MASTERED_WORD_LEVEL
  );
}

export function synchronizeLearningStatistics(
  baseStats: LearningStatistics,
  progressByWordId: Record<string, WordLearningProgress>
) {
  const allProgress = Object.values(progressByWordId);

  return {
    ...baseStats,
    totalWordsLearned: allProgress.filter(
      (progress) => progress.correctCount > 0 || progress.wrongCount > 0
    ).length,
    totalWordsMastered: allProgress.filter(
      (progress) => progress.masteryLevel >= MASTERED_WORD_LEVEL
    ).length
  };
}

export function recordStudySession(
  stats: LearningStatistics,
  studiedAt: string,
  minutes = 0
): LearningStatistics {
  const studyDay = studiedAt.slice(0, 10);
  const previousDay = stats.lastStudyDate;

  let studyStreak = stats.studyStreak;

  if (previousDay !== studyDay) {
    if (!previousDay) {
      studyStreak = 1;
    } else {
      const gapInDays = Math.round(
        (Date.parse(studyDay) - Date.parse(previousDay)) / (24 * 60 * 60 * 1000)
      );

      studyStreak = gapInDays === 1 ? stats.studyStreak + 1 : 1;
    }
  }

  return {
    ...stats,
    totalStudyMinutes: stats.totalStudyMinutes + Math.max(0, Math.floor(minutes)),
    studyStreak,
    lastStudyDate: studyDay
  };
}
