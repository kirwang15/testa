import {
  getFirstProgressLevel,
  getProgressLevelById as getIndexedProgressLevelById,
  getProgressLevelIds,
  getRecommendedProgressLevel
} from "./curriculum-progress-index";
import {
  getRuntimeLevelById,
  getRuntimeVocabularyWordContentVersion,
  getRuntimeVocabularyWordById,
  registerRuntimeLevel
} from "./runtime-registry";
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
  recordActualHintEvent,
  recordCompletedDueReview,
  recordFirstTryCorrect,
  getLocalCalendarDateKey,
  recordLearningActivity,
  synchronizeLearningStatistics
} from "../src/lib/learning-engine";
import { getContentBookNumber } from "./content-access";
import { scheduleNextReview } from "../src/lib/review-engine";
import type {
  CellKey,
  CurriculumLevelIndex,
  GameProgress,
  HintResult,
  LearningStatistics,
  Level,
  LevelProgress,
  SubmitWordResult,
  TargetWord,
  WordLearningProgress
} from "../types/game";

const LEGACY_CONTENT_PREFIX = "legacy:";

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

function isRuntimeLevel(
  level: Level | CurriculumLevelIndex | undefined
): level is Level {
  return Boolean(level && "targetWords" in level && Array.isArray(level.targetWords));
}

function normalizeHintStages(
  value: unknown,
  level: Level | CurriculumLevelIndex | undefined
) {
  if (!isRecord(value) || !level) {
    return {};
  }

  if (!isRuntimeLevel(level)) {
    return Object.fromEntries(
      Object.entries(value).flatMap(([wordId, rawStage]) =>
        typeof rawStage === "number" && Number.isFinite(rawStage) && rawStage > 0
          ? [[wordId, Math.min(12, Math.floor(rawStage))]]
          : []
      )
    );
  }

  const targetById = new Map(
    level.targetWords.flatMap((word) => [
      [word.id, word] as const,
      ...(word.id.startsWith(LEGACY_CONTENT_PREFIX)
        ? [[word.id.slice(LEGACY_CONTENT_PREFIX.length), word] as const]
        : [])
    ])
  );

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

      return [[word.id, Math.min(word.word.length + 1, Math.floor(rawStage))]];
    })
  );
}

function normalizeLevelProgress(
  value: unknown,
  level?: Level | CurriculumLevelIndex,
  includeActiveReplay = true
): LevelProgress {
  if (!isRecord(value)) {
    return createEmptyLevelProgress(level?.layoutRevision);
  }

  const layoutMatches =
    !level?.layoutRevision || value.layoutRevision === level.layoutRevision;

  const targetIds = isRuntimeLevel(level)
    ? new Set(level.targetWords.map((word) => word.id))
    : undefined;
  const canonicalTargetId = (wordId: string) => {
    if (!level) return wordId;
    if (targetIds?.has(wordId)) return wordId;
    const namespacedId = `${LEGACY_CONTENT_PREFIX}${wordId}`;
    return targetIds?.has(namespacedId) ? namespacedId : wordId;
  };
  const gridCellKeys = isRuntimeLevel(level)
    ? new Set(Object.keys(buildGrid(level)))
    : undefined;
  const foundWords = uniqueStrings(value.foundWords).map(canonicalTargetId).filter(
    (wordId) => !targetIds || targetIds.has(wordId)
  );
  const revealedCells = layoutMatches
    ? Array.from(new Set(normalizeCellKeyList(value.revealedCells))).filter(
        (cellKey) => !gridCellKeys || gridCellKeys.has(cellKey)
      )
    : [];
  const hintedWordIds = layoutMatches
    ? uniqueStrings(value.hintedWordIds).map(canonicalTargetId).filter(
        (wordId) => !targetIds || targetIds.has(wordId)
      )
    : [];
  const allTargetsFound = Boolean(
    isRuntimeLevel(level) &&
      level.targetWords.every((word) => foundWords.includes(word.id))
  );
  const hasReliableCompletionHistory =
    value.completed === true &&
    (typeof value.completedAt === "string" || normalizeCount(value.attemptCount) > 0);
  const normalized: LevelProgress = {
    ...(level?.layoutRevision ? { layoutRevision: level.layoutRevision } : {}),
    foundWords,
    revealedCells,
    hintedWordIds,
    hintStages: layoutMatches ? normalizeHintStages(value.hintStages, level) : {},
    completed: allTargetsFound || hasReliableCompletionHistory,
    hintsUsed: layoutMatches ? normalizeHintsUsed(value.hintsUsed) : 0,
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
    layoutMatches &&
    value.completed === true &&
    isRecord(value.activeReplayAttempt)
  ) {
    const activeProgress = normalizeLevelProgress(
      {
        ...value.activeReplayAttempt,
        // Attempt snapshots intentionally omit historical scoring metadata,
        // including the revision. The completed parent is the revision owner.
        layoutRevision: level.layoutRevision
      },
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
    Object.entries(value).map(([levelId, levelProgress]) => {
      const canonicalLevelId = canonicalizePersistedLevelId(levelId);
      const level = getProgressLevelById(canonicalLevelId);
      return [
        level?.id ?? canonicalLevelId,
        normalizeLevelProgress(levelProgress, level)
      ];
    })
  );
}

function canonicalizePersistedLevelId(levelId: string) {
  if (levelId.startsWith(LEGACY_CONTENT_PREFIX) || levelId.startsWith("nce-1997-")) {
    return levelId;
  }
  return /^nce-[1-4]-u\d+-level-\d+$/.test(levelId)
    ? `${LEGACY_CONTENT_PREFIX}${levelId}`
    : levelId;
}

function getProgressLevelById(levelId: string) {
  const canonicalLevelId = canonicalizePersistedLevelId(levelId);
  const known =
    getRuntimeLevelById(canonicalLevelId) ?? getIndexedProgressLevelById(canonicalLevelId);
  if (known) return known;

  const legacy = /^legacy:(nce-[1-4])-(u\d+)-level-\d+$/.exec(canonicalLevelId);
  if (!legacy) return undefined;
  return {
    id: canonicalLevelId,
    bookId: `${LEGACY_CONTENT_PREFIX}${legacy[1]}`,
    unitId: `${LEGACY_CONTENT_PREFIX}${legacy[1]}-${legacy[2]}`,
    wordCount: 0,
    releaseStatus: "automated-beta" as const,
    rating: "all-ages" as const
  } satisfies CurriculumLevelIndex;
}

function normalizeWordProgressMap(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([wordId]) => typeof wordId === "string" && wordId.length > 0)
      .map(([wordId, wordProgress]) => {
        const canonicalWordId = canonicalizePersistedWordId(wordId);
        return [
        canonicalWordId,
        normalizeWordLearningProgress(
          isRecord(wordProgress) ? (wordProgress as Partial<WordLearningProgress>) : undefined,
          canonicalWordId
        )
      ];
      })
  );
}

function canonicalizePersistedWordId(wordId: string) {
  if (wordId.startsWith(LEGACY_CONTENT_PREFIX) || wordId.startsWith("nce-1997-")) {
    return wordId;
  }
  return /^nce-[1-4]-u\d+-/.test(wordId)
    ? `${LEGACY_CONTENT_PREFIX}${wordId}`
    : wordId;
}

function normalizeStudyStats(value: unknown): LearningStatistics {
  if (!isRecord(value)) {
    return createInitialLearningStatistics();
  }

  const activeDateKeys = Array.isArray(value.activeDateKeys)
    ? Array.from(
        new Set(
          value.activeDateKeys.filter(
            (date): date is string =>
              typeof date === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test(date) &&
              Number.isFinite(Date.parse(`${date}T00:00:00.000Z`)) &&
              new Date(Date.parse(`${date}T00:00:00.000Z`))
                .toISOString()
                .slice(0, 10) === date
          )
        )
      ).sort()
    : [];

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
      typeof value.lastStudyDate === "string" ? value.lastStudyDate : undefined,
    firstTryCorrectWords:
      typeof value.firstTryCorrectWords === "number" && Number.isFinite(value.firstTryCorrectWords)
        ? Math.max(0, Math.floor(value.firstTryCorrectWords))
        : 0,
    completedDueReviews:
      typeof value.completedDueReviews === "number" && Number.isFinite(value.completedDueReviews)
        ? Math.max(0, Math.floor(value.completedDueReviews))
        : 0,
    actualHintEvents:
      typeof value.actualHintEvents === "number" && Number.isFinite(value.actualHintEvents)
        ? Math.max(0, Math.floor(value.actualHintEvents))
        : 0,
    activeDateKeys
  };
}

function getCurrentLocation(levelId: string | undefined) {
  const canonicalLevelId = levelId
    ? canonicalizePersistedLevelId(levelId)
    : undefined;
  const level = canonicalLevelId ? getProgressLevelById(canonicalLevelId) : undefined;

  return {
    currentLevelId: level?.id,
    currentUnitId: level?.unitId,
    currentBookId: level?.bookId
  };
}

function synchronizeProgressDerivedState(progress: GameProgress): GameProgress {
  const recommendedLevel =
    getRecommendedProgressLevel(progress.levels) ?? getFirstProgressLevel();
  const currentLevel = progress.currentLevelId
    ? getProgressLevelById(progress.currentLevelId)
    : undefined;
  const location = getCurrentLocation(currentLevel?.id ?? recommendedLevel?.id);
  const trustedWords = Object.fromEntries(
    Object.entries(progress.words).filter(([wordId]) =>
      /^(?:nce-1997-b[1-4]-|ielts-nawl-v1-|kaoyan-core-v1-|legacy:nce-[1-4]-u\d+-)/.test(wordId)
    )
  );
  const studyStats = synchronizeLearningStatistics(progress.studyStats, trustedWords);

  return {
    ...progress,
    coins: normalizeCoins(progress.coins),
    unlockedLevelIds: getProgressLevelIds(),
    currentLevelId: currentLevel?.id ?? location.currentLevelId,
    currentUnitId: currentLevel?.unitId ?? location.currentUnitId,
    currentBookId: currentLevel?.bookId ?? location.currentBookId,
    studyStats
  };
}

export function createInitialGameProgress(): GameProgress {
  const firstLevel = getFirstProgressLevel();

  return {
    coins: STARTING_COINS,
    unlockedLevelIds: getProgressLevelIds(),
    currentBookId: firstLevel?.bookId,
    currentUnitId: firstLevel?.unitId,
    currentLevelId: firstLevel?.id,
    levels: {},
    words: {},
    studyStats: createInitialLearningStatistics()
  };
}

export function getSavedLevelProgress(progress: GameProgress, levelId: string) {
  const canonicalLevelId = canonicalizePersistedLevelId(levelId);
  return (
    progress.levels[canonicalLevelId] ??
    progress.levels[levelId] ??
    createEmptyLevelProgress(getProgressLevelById(canonicalLevelId)?.layoutRevision)
  );
}

export function getSavedWordProgress(progress: GameProgress, wordId: string) {
  const canonicalWordId = canonicalizePersistedWordId(wordId);
  return (
    progress.words[canonicalWordId] ??
    progress.words[wordId] ??
    createEmptyWordLearningProgress(canonicalWordId)
  );
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

  const runtimeWord = getRuntimeVocabularyWordById(wordId);
  const sourceBook = runtimeWord
    ? getContentBookNumber(runtimeWord.bookId)
    : undefined;
  const contentVersion = getRuntimeVocabularyWordContentVersion(wordId);
  return {
    ...progress.words,
    [wordId]: {
      ...scheduledProgress,
      ...(sourceBook ? { sourceBook } : {}),
      ...(runtimeWord ? { contentRating: runtimeWord.rating } : {}),
      ...(contentVersion ? { contentVersion } : {}),
      firstTryCorrectRecorded:
        baseWordProgress.firstTryCorrectRecorded ||
        (baseWordProgress.correctCount === 0 && baseWordProgress.wrongCount === 0)
    }
  };
}

function isFirstTryCorrect(
  progress: GameProgress,
  wordId: string
) {
  const wordProgress = getSavedWordProgress(progress, wordId);
  return (
    !wordProgress.firstTryCorrectRecorded &&
    wordProgress.correctCount === 0 &&
    wordProgress.wrongCount === 0
  );
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

  const runtimeWord = getRuntimeVocabularyWordById(wordId);
  const sourceBook = runtimeWord
    ? getContentBookNumber(runtimeWord.bookId)
    : undefined;
  const contentVersion = getRuntimeVocabularyWordContentVersion(wordId);
  return {
    ...progress.words,
    [wordId]: {
      ...scheduledProgress,
      ...(sourceBook ? { sourceBook } : {}),
      ...(runtimeWord ? { contentRating: runtimeWord.rating } : {}),
      ...(contentVersion ? { contentVersion } : {})
    }
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
  const runtimeWord = getRuntimeVocabularyWordById(wordId);
  const sourceBook = runtimeWord
    ? getContentBookNumber(runtimeWord.bookId)
    : undefined;
  const contentVersion = getRuntimeVocabularyWordContentVersion(wordId);
  return {
    ...progress.words,
    [wordId]: {
      ...markWordWrong(getSavedWordProgress(progress, wordId), reviewedAt),
      ...(sourceBook ? { sourceBook } : {}),
      ...(runtimeWord ? { contentRating: runtimeWord.rating } : {}),
      ...(contentVersion ? { contentVersion } : {})
    }
  };
}

export function applyWordSubmission(
  progress: GameProgress,
  level: Level,
  attempt: string,
  attemptProgress?: LevelProgress,
  targetWordId?: string,
  localDateKey = getLocalCalendarDateKey()
): {
  nextProgress: GameProgress;
  result: SubmitWordResult;
  attemptProgress: LevelProgress;
} {
  registerRuntimeLevel(level);
  const historicalLevelProgress = getSavedLevelProgress(progress, level.id);
  const currentState = createGameState(
    level,
    attemptProgress ?? historicalLevelProgress,
    progress.coins
  );
  const result = applyEngineWordSubmission(currentState, attempt, { targetWordId });

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
    const relatedWord =
      level.targetWords.find((word) => word.id === targetWordId) ??
      getRelatedTargetWord(level, result.attempt, currentState.progress);
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
      words: nextWords,
      studyStats: recordLearningActivity(progress.studyStats, reviewedAt, localDateKey)
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
  const firstTryCorrect = Boolean(
    result.word.vocabularyWordId &&
    isFirstTryCorrect(progress, result.word.vocabularyWordId)
  );
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
    words: nextWords,
    studyStats: firstTryCorrect
      ? recordFirstTryCorrect(progress.studyStats, reviewedAt, localDateKey)
      : recordLearningActivity(progress.studyStats, reviewedAt, localDateKey)
  };
  // `totalStudyMinutes` is a legacy migration-only field. A level's estimated
  // duration is curriculum metadata, not a measured session duration.
  const nextProgress = synchronizeProgressDerivedState(baseNextProgress);

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
  targetWordId?: string,
  localDateKey = getLocalCalendarDateKey()
): {
  nextProgress: GameProgress;
  result: HintResult;
  attemptProgress: LevelProgress;
} {
  registerRuntimeLevel(level);
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
      words: nextWords,
      studyStats: recordActualHintEvent(progress.studyStats, reviewedAt, localDateKey)
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
  targetWordId?: string,
  localDateKey = getLocalCalendarDateKey()
) {
  registerRuntimeLevel(level);
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
    },
    studyStats: recordActualHintEvent(
      progress.studyStats,
      new Date().toISOString(),
      localDateKey
    )
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
  attempt: string,
  localDateKey = getLocalCalendarDateKey()
) {
  const reviewedAt = new Date().toISOString();
  const vocabularyWord = getRuntimeVocabularyWordById(
    canonicalizePersistedWordId(wordId)
  );
  if (!vocabularyWord) {
    return { status: "unknown-word" as const, nextProgress: progress };
  }
  const canonicalWordId = vocabularyWord.id;
  // Resolve through the caller's id first so an unmigrated legacy-keyed record
  // is carried forward before we replace the key with the canonical namespace.
  const sourceBook = getContentBookNumber(vocabularyWord.bookId);
  const contentVersion = getRuntimeVocabularyWordContentVersion(canonicalWordId);
  const currentWordProgress: WordLearningProgress = {
    ...getSavedWordProgress(progress, wordId),
    ...(sourceBook ? { sourceBook } : {}),
    contentRating: vocabularyWord.rating,
    ...(contentVersion ? { contentVersion } : {})
  };
  const migratedWords = { ...progress.words };
  if (canonicalWordId !== wordId) {
    delete migratedWords[wordId];
  }

  if (normalizeWord(attempt) !== normalizeWord(vocabularyWord.word)) {
    const nextProgress = synchronizeProgressDerivedState({
      ...progress,
      words: {
        ...migratedWords,
        [canonicalWordId]: markWordWrong(currentWordProgress, reviewedAt)
      },
      studyStats: recordLearningActivity(progress.studyStats, reviewedAt, localDateKey)
    });

    return { status: "wrong" as const, nextProgress };
  }

  const reviewedProgress = completeWordReview(currentWordProgress, reviewedAt);
  const wasDue = Boolean(
    currentWordProgress.nextReview &&
    Date.parse(currentWordProgress.nextReview) <= Date.parse(reviewedAt)
  );
  const scheduledProgress = scheduleNextReview(
    reviewedProgress,
    "correct",
    new Date(reviewedAt)
  );
  const nextProgress = synchronizeProgressDerivedState({
    ...progress,
    words: {
      ...migratedWords,
      [canonicalWordId]: scheduledProgress
    },
    studyStats: wasDue
      ? recordCompletedDueReview(progress.studyStats, reviewedAt, localDateKey)
      : recordLearningActivity(progress.studyStats, reviewedAt, localDateKey)
  });

  return { status: "correct" as const, nextProgress };
}

export function applyConfirmedPronunciationHint(
  progress: GameProgress,
  levelId: string,
  targetWordId: string,
  localDateKey = getLocalCalendarDateKey()
) {
  const level = getRuntimeLevelById(levelId);
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
    targetWordId,
    localDateKey
  );
  return { status: "applied" as const, ...result };
}
