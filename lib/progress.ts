import {
  getAllLevelIds,
  getFirstLevel,
  getLevelById,
  getLevelsByUnitId,
  getRecommendedLevel,
  getUnitById
} from "./levelLoader";
import {
  applyHint as applyEngineHint,
  applyWordSubmission as applyEngineWordSubmission,
  createEmptyLevelProgress,
  createGameState,
  normalizeCoins,
  STARTING_COINS
} from "../src/lib/game-engine";
import {
  createEmptyWordLearningProgress,
  createInitialLearningStatistics,
  markWordCorrect,
  normalizeWordLearningProgress,
  recordStudySession,
  setWordDifficult,
  synchronizeLearningStatistics
} from "../src/lib/learning-engine";
import { scheduleNextReview } from "../src/lib/review-engine";
import type {
  GameProgress,
  HintResult,
  LearningStatistics,
  Level,
  LevelProgress,
  SubmitWordResult,
  WordLearningProgress
} from "../types/game";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeHintsUsed(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function normalizeLevelProgress(value: unknown): LevelProgress {
  if (!isRecord(value)) {
    return createEmptyLevelProgress();
  }

  const normalized: LevelProgress = {
    foundWords: normalizeStringList(value.foundWords),
    revealedCells: normalizeStringList(value.revealedCells) as LevelProgress["revealedCells"],
    completed: value.completed === true,
    hintsUsed: normalizeHintsUsed(value.hintsUsed)
  };

  if (typeof value.completedAt === "string") {
    normalized.completedAt = value.completedAt;
  }

  return normalized;
}

function normalizeLevelMap(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([levelId, levelProgress]) => [
      levelId,
      normalizeLevelProgress(levelProgress)
    ])
  );
}

function normalizeWordProgressMap(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([wordId]) => typeof wordId === "string" && wordId.length > 0)
      .map(([wordId, wordProgress]) => [
        wordId,
        normalizeWordLearningProgress(
          isRecord(wordProgress) ? (wordProgress as Partial<WordLearningProgress>) : undefined,
          wordId
        )
      ])
  );
}

function normalizeStudyStats(value: unknown): LearningStatistics {
  if (!isRecord(value)) {
    return createInitialLearningStatistics();
  }

  return {
    totalWordsLearned:
      typeof value.totalWordsLearned === "number" && Number.isFinite(value.totalWordsLearned)
        ? Math.max(0, Math.floor(value.totalWordsLearned))
        : 0,
    totalWordsMastered:
      typeof value.totalWordsMastered === "number" && Number.isFinite(value.totalWordsMastered)
        ? Math.max(0, Math.floor(value.totalWordsMastered))
        : 0,
    totalStudyMinutes:
      typeof value.totalStudyMinutes === "number" && Number.isFinite(value.totalStudyMinutes)
        ? Math.max(0, Math.floor(value.totalStudyMinutes))
        : 0,
    studyStreak:
      typeof value.studyStreak === "number" && Number.isFinite(value.studyStreak)
        ? Math.max(0, Math.floor(value.studyStreak))
        : 0,
    lastStudyDate:
      typeof value.lastStudyDate === "string" ? value.lastStudyDate : undefined
  };
}

function getCurrentLocation(levelId: string | undefined) {
  const level = levelId ? getLevelById(levelId) : undefined;

  return {
    currentLevelId: level?.id,
    currentUnitId: level?.unitId,
    currentBookId: level?.bookId
  };
}

function synchronizeProgressDerivedState(progress: GameProgress): GameProgress {
  const recommendedLevel = getRecommendedLevel(progress.levels) ?? getFirstLevel();
  const currentLevel = progress.currentLevelId
    ? getLevelById(progress.currentLevelId)
    : undefined;
  const location = getCurrentLocation(currentLevel?.id ?? recommendedLevel?.id);
  const studyStats = synchronizeLearningStatistics(progress.studyStats, progress.words);

  return {
    ...progress,
    coins: normalizeCoins(progress.coins),
    unlockedLevelIds: getAllLevelIds(),
    currentLevelId: currentLevel?.id ?? location.currentLevelId,
    currentUnitId: currentLevel?.unitId ?? location.currentUnitId,
    currentBookId: currentLevel?.bookId ?? location.currentBookId,
    studyStats
  };
}

function getUnitEstimatedMinutes(level: Level) {
  const fallbackMinutes = 12;
  const unitLevels = getLevelsByUnitId(level.unitId);
  const unitLevelCount = Math.max(1, unitLevels.length);
  const unit = getUnitById(level.unitId);
  const totalUnitMinutes = unit?.estimatedMinutes ?? fallbackMinutes;

  return Math.max(1, Math.round(totalUnitMinutes / unitLevelCount));
}

export function createInitialGameProgress(): GameProgress {
  const firstLevel = getFirstLevel();

  return {
    coins: STARTING_COINS,
    unlockedLevelIds: getAllLevelIds(),
    currentBookId: firstLevel?.bookId,
    currentUnitId: firstLevel?.unitId,
    currentLevelId: firstLevel?.id,
    levels: {},
    words: {},
    studyStats: createInitialLearningStatistics()
  };
}

export function getSavedLevelProgress(progress: GameProgress, levelId: string) {
  return progress.levels[levelId] ?? createEmptyLevelProgress();
}

export function getSavedWordProgress(progress: GameProgress, wordId: string) {
  return progress.words[wordId] ?? createEmptyWordLearningProgress(wordId);
}

export function normalizeGameProgress(progress: GameProgress): GameProgress {
  return synchronizeProgressDerivedState({
    ...progress,
    levels: normalizeLevelMap(progress.levels),
    words: normalizeWordProgressMap(progress.words),
    studyStats: normalizeStudyStats(progress.studyStats)
  });
}

export function mergePersistedGameProgress(
  persistedProgress: unknown,
  fallbackProgress: GameProgress
): GameProgress {
  if (!isRecord(persistedProgress)) {
    return normalizeGameProgress(fallbackProgress);
  }

  return normalizeGameProgress({
    ...fallbackProgress,
    ...persistedProgress,
    levels: isRecord(persistedProgress.levels) ? persistedProgress.levels : fallbackProgress.levels,
    words: isRecord(persistedProgress.words) ? persistedProgress.words : fallbackProgress.words,
    studyStats: isRecord(persistedProgress.studyStats)
      ? persistedProgress.studyStats
      : fallbackProgress.studyStats
  } as GameProgress);
}

function updateWordProgressAfterCorrectAnswer(
  progress: GameProgress,
  wordId: string,
  reviewedAt: string,
  softened = false
) {
  const baseWordProgress = getSavedWordProgress(progress, wordId);
  const correctProgress = markWordCorrect(baseWordProgress, reviewedAt, { softened });
  const scheduledProgress = scheduleNextReview(
    correctProgress,
    softened ? "hint" : "correct",
    new Date(reviewedAt)
  );

  return {
    ...progress.words,
    [wordId]: scheduledProgress
  };
}

function updateWordProgressAfterHint(
  progress: GameProgress,
  wordId: string,
  reviewedAt: string
) {
  const baseWordProgress = getSavedWordProgress(progress, wordId);
  const difficultProgress = setWordDifficult(baseWordProgress, true);
  const scheduledProgress =
    difficultProgress.correctCount > 0 || difficultProgress.masteryLevel > 0
      ? scheduleNextReview(difficultProgress, "hint", new Date(reviewedAt))
      : difficultProgress;

  return {
    ...progress.words,
    [wordId]: scheduledProgress
  };
}

export function applyWordSubmission(
  progress: GameProgress,
  level: Level,
  attempt: string
): { nextProgress: GameProgress; result: SubmitWordResult } {
  const currentState = createGameState(
    level,
    getSavedLevelProgress(progress, level.id),
    progress.coins
  );
  const result = applyEngineWordSubmission(currentState, attempt);

  if (result.status !== "correct" && result.status !== "level-complete") {
    if (result.status === "already-found") {
      return {
        nextProgress: progress,
        result: {
          status: "already-found",
          attempt: result.attempt,
          word: result.word
        }
      };
    }

    return {
      nextProgress: progress,
      result: {
        status: "not-target",
        attempt: result.attempt
      }
    };
  }

  const reviewedAt =
    result.status === "level-complete"
      ? result.state.progress.completedAt ?? new Date().toISOString()
      : new Date().toISOString();
  const nextLevelProgress = result.state.progress;
  const newlyCompleted =
    result.status === "level-complete" && currentState.progress.completed === false;
  const nextWords =
    result.word.vocabularyWordId
      ? updateWordProgressAfterCorrectAnswer(
          progress,
          result.word.vocabularyWordId,
          reviewedAt,
          currentState.progress.hintsUsed > 0
        )
      : progress.words;
  const baseNextProgress: GameProgress = {
    ...progress,
    coins: result.state.coins,
    levels: {
      ...progress.levels,
      [level.id]: nextLevelProgress
    },
    words: nextWords
  };
  const nextProgress = synchronizeProgressDerivedState(
    newlyCompleted
      ? {
          ...baseNextProgress,
          studyStats: recordStudySession(
            baseNextProgress.studyStats,
            reviewedAt,
            getUnitEstimatedMinutes(level)
          )
        }
      : baseNextProgress
  );

  if (result.status === "correct") {
    return {
      nextProgress,
      result: {
        status: "correct",
        attempt: result.attempt,
        word: result.word,
        reward: 0,
        baseReward: 0,
        bonusReward: 0
      }
    };
  }

  return {
    nextProgress,
    result: {
      status: "level-complete",
      attempt: result.attempt,
      word: result.word,
      reward: newlyCompleted ? result.reward : 0,
      baseReward: newlyCompleted ? result.baseReward : 0,
      bonusReward: newlyCompleted ? result.bonusReward : 0
    }
  };
}

export function applyHintUsage(
  progress: GameProgress,
  level: Level
): { nextProgress: GameProgress; result: HintResult } {
  const currentState = createGameState(
    level,
    getSavedLevelProgress(progress, level.id),
    progress.coins
  );
  const result = applyEngineHint(currentState);

  if (result.status !== "revealed") {
    return {
      nextProgress: progress,
      result:
        result.status === "not-enough-coins"
          ? {
              status: "not-enough-coins",
              cost: result.cost
            }
          : {
              status: "no-hints-left"
            }
    };
  }

  const reviewedAt = new Date().toISOString();
  const nextWords =
    result.vocabularyWordId
      ? updateWordProgressAfterHint(progress, result.vocabularyWordId, reviewedAt)
      : progress.words;

  return {
    nextProgress: synchronizeProgressDerivedState({
      ...progress,
      coins: result.state.coins,
      levels: {
        ...progress.levels,
        [level.id]: result.state.progress
      },
      words: nextWords
    }),
    result: {
      status: "revealed",
      cellKey: result.cellKey,
      letter: result.letter,
      cost: result.cost,
      vocabularyWordId: result.vocabularyWordId
    }
  };
}
