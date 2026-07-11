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
  buildGrid,
  createEmptyLevelProgress,
  createGameState,
  createLevelAttemptSnapshot,
  createReplayLevelProgress,
  normalizeWord,
  normalizeCoins,
  STARTING_COINS
} from "../src/lib/game-engine";
import {
  createEmptyWordLearningProgress,
  createInitialLearningStatistics,
  completeWordReview,
  markWordClueUsed,
  markWordCorrect,
  markWordWrong,
  normalizeWordLearningProgress,
  recordStudySession,
  synchronizeLearningStatistics
} from "../src/lib/learning-engine";
import { scheduleNextReview } from "../src/lib/review-engine";
import { getWordById } from "../src/lib/vocabulary-loader";
import type {
  CellKey,
  GameProgress,
  HintResult,
  LearningStatistics,
  Level,
  LevelProgress,
  SubmitWordResult,
  TargetWord,
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

function uniqueStrings(value: unknown) {
  return Array.from(new Set(normalizeStringList(value)));
}

function normalizeCellKeyList(value: unknown): CellKey[] {
  return normalizeStringList(value).filter(
    (item): item is CellKey => /^(0|[1-9]\d*):(0|[1-9]\d*)$/.test(item)
  );
}

function normalizeHintsUsed(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function normalizeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function normalizeHintStages(value: unknown, level: Level | undefined) {
  if (!isRecord(value) || !level) {
    return {};
  }

  const targetById = new Map(level.targetWords.map((word) => [word.id, word]));

  return Object.fromEntries(
    Object.entries(value).flatMap(([wordId, rawStage]) => {
      const word = targetById.get(wordId);
      if (
        !word ||
        typeof rawStage !== "number" ||
        !Number.isFinite(rawStage) ||
        rawStage <= 0
      ) {
        return [];
      }

      return [[wordId, Math.min(word.word.length + 1, Math.floor(rawStage))]];
    })
  );
}

function normalizeLevelProgress(
  value: unknown,
  level?: Level,
  includeActiveReplay = true
): LevelProgress {
  if (!isRecord(value)) {
    return createEmptyLevelProgress();
  }

  const targetIds = level
    ? new Set(level.targetWords.map((word) => word.id))
    : undefined;
  const gridCellKeys = level
    ? new Set(Object.keys(buildGrid(level)))
    : undefined;
  const foundWords = uniqueStrings(value.foundWords).filter(
    (wordId) => !targetIds || targetIds.has(wordId)
  );
  const revealedCells = Array.from(new Set(normalizeCellKeyList(value.revealedCells))).filter(
    (cellKey) => !gridCellKeys || gridCellKeys.has(cellKey)
  );
  const hintedWordIds = uniqueStrings(value.hintedWordIds).filter(
    (wordId) => !targetIds || targetIds.has(wordId)
  );
  const allTargetsFound = Boolean(
    level && level.targetWords.every((word) => foundWords.includes(word.id))
  );
  const hasReliableCompletionHistory =
    value.completed === true &&
    (typeof value.completedAt === "string" || normalizeCount(value.attemptCount) > 0);
  const normalized: LevelProgress = {
    foundWords,
    revealedCells,
    hintedWordIds,
    hintStages: normalizeHintStages(value.hintStages, level),
    completed: allTargetsFound || hasReliableCompletionHistory,
    hintsUsed: normalizeHintsUsed(value.hintsUsed),
    wrongAttempts: normalizeCount(value.wrongAttempts),
    duplicateAttempts: normalizeCount(value.duplicateAttempts),
    bestStars: Math.min(3, normalizeCount(value.bestStars)),
    attemptCount: normalizeCount(value.attemptCount)
  };

  if (typeof value.completedAt === "string") {
    normalized.completedAt = value.completedAt;
  }

  if (typeof value.lastPlayedAt === "string") {
    normalized.lastPlayedAt = value.lastPlayedAt;
  }

  if (
    includeActiveReplay &&
    level &&
    value.completed === true &&
    isRecord(value.activeReplayAttempt)
  ) {
    const activeProgress = normalizeLevelProgress(
      value.activeReplayAttempt,
      level,
      false
    );
    if (!activeProgress.completed) {
      normalized.activeReplayAttempt = createLevelAttemptSnapshot(activeProgress);
    }
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
      normalizeLevelProgress(levelProgress, getLevelById(levelId))
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
  const trustedWords = Object.fromEntries(
    Object.entries(progress.words).filter(([wordId]) => Boolean(getWordById(wordId)))
  );
  const studyStats = synchronizeLearningStatistics(progress.studyStats, trustedWords);

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

function persistLevelAttempt(
  historicalProgress: LevelProgress,
  attemptProgress: LevelProgress,
  hasExplicitAttempt = true
) {
  if (historicalProgress.completed && !hasExplicitAttempt) {
    return historicalProgress;
  }

  return historicalProgress.completed
    ? {
        ...historicalProgress,
        activeReplayAttempt: createLevelAttemptSnapshot(attemptProgress)
      }
    : attemptProgress;
}

export function normalizeGameProgress(progress: GameProgress): GameProgress {
  return synchronizeProgressDerivedState({
    ...progress,
    levels: normalizeLevelMap(progress.levels),
    words: normalizeWordProgressMap(progress.words),
    studyStats: normalizeStudyStats(progress.studyStats)
  });
}

export function restartLevelAttempt(
  progress: GameProgress,
  levelId: string
) {
  const historicalProgress = progress.levels[levelId];
  if (!historicalProgress?.completed) {
    return progress;
  }

  return synchronizeProgressDerivedState({
    ...progress,
    levels: {
      ...progress.levels,
      [levelId]: {
        ...historicalProgress,
        activeReplayAttempt: undefined
      }
    }
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
  const difficultProgress = markWordClueUsed(baseWordProgress);
  const scheduledProgress =
    difficultProgress.correctCount > 0 || difficultProgress.masteryLevel > 0
      ? scheduleNextReview(difficultProgress, "hint", new Date(reviewedAt))
      : difficultProgress;

  return {
    ...progress.words,
    [wordId]: scheduledProgress
  };
}

function getEditDistance(left: string, right: string) {
  const distances = Array.from({ length: left.length + 1 }, () =>
    Array.from({ length: right.length + 1 }, () => 0)
  );

  for (let leftIndex = 0; leftIndex <= left.length; leftIndex += 1) {
    distances[leftIndex][0] = leftIndex;
  }
  for (let rightIndex = 0; rightIndex <= right.length; rightIndex += 1) {
    distances[0][rightIndex] = rightIndex;
  }

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      distances[leftIndex][rightIndex] = Math.min(
        distances[leftIndex - 1][rightIndex] + 1,
        distances[leftIndex][rightIndex - 1] + 1,
        distances[leftIndex - 1][rightIndex - 1] + substitutionCost
      );

      if (
        leftIndex > 1 &&
        rightIndex > 1 &&
        left[leftIndex - 1] === right[rightIndex - 2] &&
        left[leftIndex - 2] === right[rightIndex - 1]
      ) {
        distances[leftIndex][rightIndex] = Math.min(
          distances[leftIndex][rightIndex],
          distances[leftIndex - 2][rightIndex - 2] + 1
        );
      }
    }
  }

  return distances[left.length][right.length];
}

function getRelatedTargetWord(
  level: Level,
  attempt: string,
  progress: LevelProgress
) {
  const rankedTargets = level.targetWords
    .filter((word) => !progress.foundWords.includes(word.id))
    .map((word) => ({
      word,
      distance: getEditDistance(attempt, word.word),
      threshold: Math.max(1, Math.floor(word.word.length / 4))
    }))
    .sort(
      (left, right) =>
        left.distance - right.distance || left.word.id.localeCompare(right.word.id)
    );
  const nearest = rankedTargets[0];

  if (
    !nearest ||
    nearest.distance > nearest.threshold ||
    rankedTargets[1]?.distance === nearest.distance
  ) {
    return undefined;
  }

  return nearest.word;
}

function wordReceivedHint(word: TargetWord, progress: LevelProgress) {
  return progress.hintedWordIds.includes(word.id);
}

function updateWordProgressAfterWrongAnswer(
  progress: GameProgress,
  wordId: string,
  reviewedAt: string
) {
  return {
    ...progress.words,
    [wordId]: markWordWrong(getSavedWordProgress(progress, wordId), reviewedAt)
  };
}

export function applyWordSubmission(
  progress: GameProgress,
  level: Level,
  attempt: string,
  attemptProgress?: LevelProgress
): {
  nextProgress: GameProgress;
  result: SubmitWordResult;
  attemptProgress: LevelProgress;
} {
  const historicalLevelProgress = getSavedLevelProgress(progress, level.id);
  const currentState = createGameState(
    level,
    attemptProgress ?? historicalLevelProgress,
    progress.coins
  );
  const result = applyEngineWordSubmission(currentState, attempt);

  if (result.status !== "correct" && result.status !== "level-complete") {
    if (result.status === "already-found") {
      if (historicalLevelProgress.completed && !attemptProgress) {
        return {
          nextProgress: progress,
          attemptProgress: result.state.progress,
          result: {
            status: "already-found",
            attempt: result.attempt,
            word: result.word
          }
        };
      }
      const nextProgress = synchronizeProgressDerivedState({
        ...progress,
        levels: {
          ...progress.levels,
          [level.id]: persistLevelAttempt(
            historicalLevelProgress,
            result.state.progress,
            Boolean(attemptProgress)
          )
        }
      });
      return {
        nextProgress,
        attemptProgress: result.state.progress,
        result: {
          status: "already-found",
          attempt: result.attempt,
          word: result.word
        }
      };
    }

    const reviewedAt = new Date().toISOString();
    const relatedWord = getRelatedTargetWord(level, result.attempt, currentState.progress);
    const nextWords = relatedWord?.vocabularyWordId
      ? updateWordProgressAfterWrongAnswer(
          progress,
          relatedWord.vocabularyWordId,
          reviewedAt
        )
      : progress.words;
    const nextProgress = synchronizeProgressDerivedState({
      ...progress,
      levels: {
        ...progress.levels,
        [level.id]: persistLevelAttempt(
          historicalLevelProgress,
          result.state.progress,
          Boolean(attemptProgress)
        )
      },
      words: nextWords
    });

    return {
      nextProgress,
      attemptProgress: result.state.progress,
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
    result.status === "level-complete" && historicalLevelProgress.completed === false;
  const nextWords =
    result.word.vocabularyWordId
      ? updateWordProgressAfterCorrectAnswer(
          progress,
          result.word.vocabularyWordId,
          reviewedAt,
          wordReceivedHint(result.word, currentState.progress)
        )
      : progress.words;
  const persistedLevelProgress =
    result.status === "level-complete" && !newlyCompleted
      ? {
          ...nextLevelProgress,
          completed: true,
          completedAt:
            historicalLevelProgress.completedAt ?? nextLevelProgress.completedAt,
          bestStars: Math.max(
            historicalLevelProgress.bestStars,
            nextLevelProgress.bestStars
          ),
          activeReplayAttempt: undefined
        }
      : persistLevelAttempt(
          historicalLevelProgress,
          nextLevelProgress,
          Boolean(attemptProgress)
        );
  const baseNextProgress: GameProgress = {
    ...progress,
    coins:
      result.status === "level-complete" && !newlyCompleted
        ? progress.coins
        : result.state.coins,
    levels: {
      ...progress.levels,
      [level.id]: persistedLevelProgress
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
      attemptProgress: nextLevelProgress,
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
    attemptProgress: nextLevelProgress,
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
  level: Level,
  attemptProgress?: LevelProgress,
  targetWordId?: string
): {
  nextProgress: GameProgress;
  result: HintResult;
  attemptProgress: LevelProgress;
} {
  const historicalLevelProgress = getSavedLevelProgress(progress, level.id);
  const currentState = createGameState(
    level,
    attemptProgress ?? historicalLevelProgress,
    progress.coins
  );
  const result = applyEngineHint(currentState, targetWordId);

  if (result.status !== "revealed") {
    return {
      nextProgress: progress,
      attemptProgress: result.state.progress,
      result: {
        status: "no-hints-left"
      }
    };
  }

  const reviewedAt = new Date().toISOString();
  const attributedTargetWordId = targetWordId ?? result.state.progress.hintedWordIds.at(-1);
  const stagedAttemptProgress: LevelProgress = attributedTargetWordId
    ? {
        ...result.state.progress,
        hintStages: {
          ...result.state.progress.hintStages,
          [attributedTargetWordId]:
            (result.state.progress.hintStages[attributedTargetWordId] ?? 0) + 1
        }
      }
    : result.state.progress;
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
        [level.id]: persistLevelAttempt(
          historicalLevelProgress,
          stagedAttemptProgress,
          Boolean(attemptProgress)
        )
      },
      words: nextWords
    }),
    attemptProgress: stagedAttemptProgress,
    result: {
      status: "revealed",
      cellKey: result.cellKey,
      letter: result.letter,
      vocabularyWordId: result.vocabularyWordId
    }
  };
}

export function applyPronunciationHintUsage(
  progress: GameProgress,
  level: Level,
  attemptProgress?: LevelProgress,
  targetWordId?: string
) {
  const historicalLevelProgress = getSavedLevelProgress(progress, level.id);
  const currentAttempt = attemptProgress ?? historicalLevelProgress;
  const nextAttemptProgress: LevelProgress = {
    ...currentAttempt,
    hintsUsed: currentAttempt.hintsUsed + 1,
    hintStages: targetWordId
      ? {
          ...currentAttempt.hintStages,
          [targetWordId]: (currentAttempt.hintStages[targetWordId] ?? 0) + 1
        }
      : currentAttempt.hintStages
  };
  const nextProgress = synchronizeProgressDerivedState({
    ...progress,
    levels: {
      ...progress.levels,
      [level.id]: persistLevelAttempt(
        historicalLevelProgress,
        nextAttemptProgress,
        Boolean(attemptProgress)
      )
    }
  });

  return {
    nextProgress,
    attemptProgress: nextAttemptProgress
  };
}

export function getReviewReasonSummary(progress: WordLearningProgress) {
  const reasons = progress.reviewReasons ?? [];
  const labels: string[] = [];

  if (reasons.includes("wrong")) {
    labels.push("Needs spelling practice");
  }
  if (reasons.includes("clue")) {
    labels.push("Used a clue");
  }

  return labels.join(" · ");
}

export function applyReviewSubmission(
  progress: GameProgress,
  wordId: string,
  attempt: string
) {
  const reviewedAt = new Date().toISOString();
  const vocabularyWord = getWordById(wordId);
  if (!vocabularyWord) {
    return { status: "unknown-word" as const, nextProgress: progress };
  }
  const currentWordProgress = getSavedWordProgress(progress, wordId);

  if (normalizeWord(attempt) !== normalizeWord(vocabularyWord.word)) {
    const nextProgress = synchronizeProgressDerivedState({
      ...progress,
      words: {
        ...progress.words,
        [wordId]: markWordWrong(currentWordProgress, reviewedAt)
      }
    });

    return { status: "wrong" as const, nextProgress };
  }

  const reviewedProgress = completeWordReview(currentWordProgress, reviewedAt);
  const scheduledProgress = scheduleNextReview(
    reviewedProgress,
    "correct",
    new Date(reviewedAt)
  );
  const nextProgress = synchronizeProgressDerivedState({
    ...progress,
    words: {
      ...progress.words,
      [wordId]: scheduledProgress
    }
  });

  return { status: "correct" as const, nextProgress };
}

export function applyConfirmedPronunciationHint(
  progress: GameProgress,
  levelId: string,
  targetWordId: string
) {
  const level = getLevelById(levelId);
  const targetExists = level?.targetWords.some((word) => word.id === targetWordId);
  if (!level || !targetExists) {
    return {
      status: "stale" as const,
      nextProgress: progress,
      attemptProgress: createEmptyLevelProgress()
    };
  }

  const historical = getSavedLevelProgress(progress, levelId);
  const latestAttempt = historical.completed
    ? createReplayLevelProgress(historical)
    : historical;
  if (latestAttempt.foundWords.includes(targetWordId)) {
    return {
      status: "stale" as const,
      nextProgress: progress,
      attemptProgress: latestAttempt
    };
  }
  const result = applyPronunciationHintUsage(
    progress,
    level,
    latestAttempt,
    targetWordId
  );
  return { status: "applied" as const, ...result };
}
