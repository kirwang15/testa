import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  getBookProgress,
  getLevelById,
  getRecommendedLevel,
  getFirstLevel,
  getUnitProgress
} from "../lib/levelLoader";
import {
  applyHintUsage,
  applyPronunciationHintUsage,
  applyWordSubmission,
  createInitialGameProgress,
  mergePersistedGameProgress,
  normalizeGameProgress,
  restartLevelAttempt
} from "../lib/progress";
import {
  buildGrid,
  createGameState,
  createReplayLevelProgress
} from "../src/lib/game-engine";
import {
  deserializePersistedGameProgress,
  getPersistedGameProgress,
  serializePersistedGameProgress
} from "../lib/storage";
import { createEmptyLevelProgress } from "../src/lib/game-engine";
import {
  createInitialLearningStatistics,
  recordLearningActivity
} from "../src/lib/learning-engine";
import type { GameProgress, Level } from "../types/game";

function getTestLevel(levelId = "nce-1-u1-level-1"): Level {
  const level = getLevelById(levelId);
  assert.ok(level, `Expected level ${levelId} to exist`);
  return level;
}

describe("progress and persistence", () => {
  test("starts with all levels open and the first recommended level selected", () => {
    const progress = createInitialGameProgress();

    assert.equal(progress.coins, 100);
    assert.equal(progress.unlockedLevelIds.length > 1, true);
    assert.equal(progress.currentLevelId, "nce-1997-b1-level-001");
    assert.equal(progress.currentBookId, "nce-1997-b1");
    assert.equal(progress.currentUnitId, "nce-1997-b1-u1");
  });

  test("keeps coins and tracks hint usage and difficult vocabulary", () => {
    const level = getTestLevel();
    const progress = createInitialGameProgress();
    const { nextProgress, result } = applyHintUsage(progress, level);

    assert.equal(result.status, "revealed");
    assert.equal(nextProgress.coins, createGameState(level, undefined, progress.coins).coins);
    assert.equal(nextProgress.levels[level.id]?.hintsUsed, 1);
    assert.equal(result.status, "revealed");
    if (result.status !== "revealed") {
      assert.fail("Expected a revealed hint");
    }
    assert.deepEqual(nextProgress.levels[level.id]?.revealedCells, [result.cellKey]);
    assert.equal(result.vocabularyWordId, "legacy:nce-1-u1-cat");
    assert.equal(nextProgress.words["legacy:nce-1-u1-cat"]?.difficult, true);
    assert.equal(nextProgress.studyStats.actualHintEvents, 1);
  });

  test("reveals a hint even when the coin balance is zero", () => {
    const level = getTestLevel();
    const progress = {
      ...createInitialGameProgress(),
      coins: 0
    };
    const { nextProgress, result } = applyHintUsage(progress, level);

    assert.equal(result.status, "revealed");
    assert.equal(nextProgress.coins, 0);
    assert.equal(nextProgress.levels[level.id]?.hintsUsed, 1);
  });

  test("counts a pronunciation hint without revealing cells or changing coins", () => {
    const level = getTestLevel();
    const progress = createInitialGameProgress();
    const result = applyPronunciationHintUsage(progress, level);

    assert.equal(result.attemptProgress.hintsUsed, 1);
    assert.deepEqual(result.attemptProgress.revealedCells, []);
    assert.equal(result.nextProgress.coins, progress.coins);
    assert.deepEqual(result.nextProgress.words, {});
    assert.equal(result.nextProgress.studyStats.actualHintEvents, 1);
  });

  test("records vocabulary learning and study stats on level completion", () => {
    const level = getFirstLevel();
    assert.ok(level);
    let progress = createInitialGameProgress();

    for (const word of level.targetWords) {
      const submission = applyWordSubmission(progress, level, word.word);
      progress = submission.nextProgress;
    }

    assert.equal(progress.levels[level.id]?.completed, true);
    assert.equal(progress.unlockedLevelIds.includes(level.id), true);
    assert.equal(
      progress.coins,
      100 + level.rewardCoins + (level.perfectBonusCoins ?? 0)
    );
    const firstVocabularyWordId = level.targetWords[0]?.vocabularyWordId;
    assert.ok(firstVocabularyWordId);
    assert.equal(progress.words[firstVocabularyWordId]?.correctCount, 1);
    assert.equal(progress.studyStats.totalWordsLearned > 0, true);
    assert.equal(progress.studyStats.totalStudyMinutes, 0);
    assert.equal(progress.studyStats.firstTryCorrectWords, level.targetWords.length);
    assert.equal(progress.studyStats.activeDateKeys?.length, 1);
    assert.equal(getRecommendedLevel(progress.levels)?.id, "nce-1997-b1-level-002");
  });

  test("uses the explicit browser-local date key across a UTC+8 midnight", () => {
    const stats = recordLearningActivity(
      createInitialLearningStatistics(),
      "2026-07-17T16:30:00.000Z",
      "2026-07-18"
    );
    assert.deepEqual(stats.activeDateKeys, ["2026-07-18"]);
    assert.equal(stats.lastStudyDate, "2026-07-18");
  });

  test("preserves migrated study minutes without adding estimated level time", () => {
    const level = getFirstLevel();
    assert.ok(level);
    let progress = createInitialGameProgress();
    progress.studyStats.totalStudyMinutes = 30;
    for (const word of level.targetWords) {
      progress = applyWordSubmission(progress, level, word.word).nextProgress;
    }
    assert.equal(progress.studyStats.totalStudyMinutes, 30);
  });

  test("records a related wrong word and always counts a failed attempt", () => {
    const level = getTestLevel();
    const progress = createInitialGameProgress();
    const relatedFailure = applyWordSubmission(progress, level, "CTA");

    assert.equal(relatedFailure.result.status, "not-target");
    assert.equal(relatedFailure.nextProgress.levels[level.id]?.wrongAttempts, 1);
    assert.equal(relatedFailure.nextProgress.words["legacy:nce-1-u1-cat"]?.wrongCount, 1);
    assert.equal(relatedFailure.nextProgress.words["legacy:nce-1-u1-cat"]?.difficult, true);

    const unrelatedFailure = applyWordSubmission(
      relatedFailure.nextProgress,
      level,
      "ZZZ"
    );

    assert.equal(unrelatedFailure.nextProgress.levels[level.id]?.wrongAttempts, 2);
    assert.equal(Object.keys(unrelatedFailure.nextProgress.words).length, 1);
    assert.equal(unrelatedFailure.nextProgress.studyStats.totalWordsLearned, 0);
  });

  test("attributes a unique nearest ordinary misspelling but leaves ties unassigned", () => {
    const level = getTestLevel();
    const uniqueFailure = applyWordSubmission(
      createInitialGameProgress(),
      { ...level, targetWords: [...level.targetWords].reverse() },
      "CT"
    );

    assert.equal(uniqueFailure.nextProgress.words["legacy:nce-1-u1-cat"]?.wrongCount, 1);

    const ambiguousFailure = applyWordSubmission(
      createInitialGameProgress(),
      level,
      "CAN"
    );

    assert.equal(Object.keys(ambiguousFailure.nextProgress.words).length, 0);
    assert.equal(ambiguousFailure.nextProgress.levels[level.id]?.wrongAttempts, 1);
  });

  test("softens mastery only when the submitted word owns a revealed cell", () => {
    const level = getTestLevel();
    const hinted = applyHintUsage(createInitialGameProgress(), level);
    const unhintedWord = level.targetWords.find((word) => word.word === "CAR");
    const hintedWord = level.targetWords.find((word) => word.word === "CAT");
    assert.ok(unhintedWord);
    assert.ok(hintedWord);
    assert.ok(unhintedWord.vocabularyWordId);
    assert.ok(hintedWord.vocabularyWordId);

    const unhintedSubmission = applyWordSubmission(
      hinted.nextProgress,
      level,
      unhintedWord.word,
      hinted.attemptProgress
    );
    const hintedSubmission = applyWordSubmission(
      unhintedSubmission.nextProgress,
      level,
      hintedWord.word,
      unhintedSubmission.attemptProgress
    );

    assert.equal(
      unhintedSubmission.nextProgress.words[unhintedWord.vocabularyWordId]?.masteryLevel,
      1
    );
    assert.equal(
      hintedSubmission.nextProgress.words[hintedWord.vocabularyWordId]?.masteryLevel,
      0
    );
  });

  test("softens only the requested word when a hint cell belongs to two words", () => {
    const crossingLevel: Level = {
      ...getTestLevel(),
      id: "crossing-progress-hint",
      letters: ["C", "A", "T", "R"],
      grid: { rows: 3, cols: 3 },
      targetWords: [
        {
          id: "cat",
          word: "CAT",
          clue: "animal",
          start: { row: 0, col: 0 },
          direction: "across",
          vocabularyWordId: "v-cat"
        },
        {
          id: "car",
          word: "CAR",
          clue: "vehicle",
          start: { row: 0, col: 0 },
          direction: "down",
          vocabularyWordId: "v-car"
        }
      ]
    };
    const hinted = applyHintUsage(
      createInitialGameProgress(),
      crossingLevel,
      undefined,
      "car"
    );
    const cat = crossingLevel.targetWords[0];
    const car = crossingLevel.targetWords[1];
    assert.ok(cat);
    assert.ok(car);
    const unhintedSubmission = applyWordSubmission(
      hinted.nextProgress,
      crossingLevel,
      cat.word,
      hinted.attemptProgress
    );
    const hintedSubmission = applyWordSubmission(
      unhintedSubmission.nextProgress,
      crossingLevel,
      car.word,
      unhintedSubmission.attemptProgress
    );

    assert.equal(hinted.result.status, "revealed");
    assert.equal(hinted.nextProgress.words["v-car"]?.difficult, true);
    assert.equal(hinted.nextProgress.words["v-cat"], undefined);
    assert.equal(unhintedSubmission.nextProgress.words["v-cat"]?.masteryLevel, 1);
    assert.equal(hintedSubmission.nextProgress.words["v-car"]?.masteryLevel, 0);
  });

  test("counts an already-found submission separately from wrong attempts", () => {
    const level = getTestLevel();
    const word = level.targetWords[0];
    assert.ok(word);
    const first = applyWordSubmission(createInitialGameProgress(), level, word.word);
    const duplicate = applyWordSubmission(
      first.nextProgress,
      level,
      word.word,
      first.attemptProgress
    );

    assert.equal(duplicate.result.status, "already-found");
    assert.deepEqual(duplicate.attemptProgress, {
      ...first.attemptProgress,
      duplicateAttempts: 1
    });
    assert.deepEqual(duplicate.nextProgress.levels[level.id], duplicate.attemptProgress);
    assert.equal(duplicate.attemptProgress.wrongAttempts, 0);
  });

  test("replays a completed level as a fresh attempt without duplicate rewards", () => {
    const level = getTestLevel();
    const firstCompletion = level.targetWords.reduce(
      (progress, word) => applyWordSubmission(progress, level, word.word).nextProgress,
      createInitialGameProgress()
    );
    const historicalProgress = firstCompletion.levels[level.id];
    assert.ok(historicalProgress);
    let replayProgress = createReplayLevelProgress(historicalProgress);
    assert.equal(replayProgress.completed, false);
    assert.deepEqual(replayProgress.foundWords, []);

    let progress = firstCompletion;
    let finalResult: ReturnType<typeof applyWordSubmission>["result"] | undefined;
    for (const word of level.targetWords) {
      const submission = applyWordSubmission(progress, level, word.word, replayProgress);
      progress = submission.nextProgress;
      replayProgress = submission.attemptProgress;
      finalResult = submission.result;
    }

    assert.equal(finalResult?.status, "level-complete");
    assert.equal(finalResult?.reward, 0);
    assert.equal(progress.coins, firstCompletion.coins);
    assert.equal(progress.levels[level.id]?.completed, true);
    assert.equal(progress.levels[level.id]?.completedAt, historicalProgress.completedAt);
    assert.equal(progress.levels[level.id]?.attemptCount, 2);
    assert.equal(progress.levels[level.id]?.bestStars, 3);
    assert.equal(
      progress.studyStats.firstTryCorrectWords,
      firstCompletion.studyStats.firstTryCorrectWords
    );
  });

  test("persists an in-progress replay clue stage without reopening first-pass rewards", () => {
    const level = getTestLevel();
    const completed = level.targetWords.reduce(
      (progress, word) => applyWordSubmission(progress, level, word.word).nextProgress,
      createInitialGameProgress()
    );
    const historical = completed.levels[level.id];
    const target = level.targetWords[0];
    assert.ok(historical);
    assert.ok(target);
    const replay = createReplayLevelProgress(historical);
    const hinted = applyPronunciationHintUsage(
      completed,
      level,
      replay,
      target.id
    );
    const restored = mergePersistedGameProgress(
      hinted.nextProgress,
      createInitialGameProgress()
    );
    const restoredHistorical = restored.levels[level.id];
    assert.ok(restoredHistorical);
    const resumedReplay = createReplayLevelProgress(restoredHistorical);

    assert.equal(restoredHistorical.completed, true);
    assert.equal(restored.coins, completed.coins);
    assert.equal(resumedReplay.hintStages[target.id], 1);
    assert.equal(resumedReplay.hintsUsed, 1);

    const restarted = restartLevelAttempt(restored, level.id);
    const freshReplay = createReplayLevelProgress(restarted.levels[level.id] ?? restoredHistorical);
    assert.deepEqual(freshReplay.hintStages, {});
    assert.equal(freshReplay.hintsUsed, 0);
  });

  test("does not award completion coins twice", () => {
    const level = getTestLevel();
    const baseProgress = normalizeGameProgress({
      ...createInitialGameProgress(),
      levels: {
        [level.id]: {
          ...createGameState(level).progress,
          foundWords: level.targetWords.map((word) => word.id),
          revealedCells: [],
          completed: true,
          completedAt: "2026-04-24T00:00:00.000Z",
          hintsUsed: 0
        }
      }
    });
    const { nextProgress, result } = applyWordSubmission(
      baseProgress,
      level,
      level.targetWords[0]?.word ?? ""
    );

    assert.equal(result.status, "already-found");
    assert.deepEqual(nextProgress, baseProgress);
  });

  test("serializes and restores local progress safely", () => {
    const level = getTestLevel();
    const originalProgress: GameProgress = normalizeGameProgress({
      ...createInitialGameProgress(),
      coins: 135,
      currentBookId: "nce-1",
      currentUnitId: "nce-1-u1",
      currentLevelId: "nce-1-u1-level-2",
      levels: {
        [level.id]: {
          ...createGameState(level).progress,
          foundWords: level.targetWords.map((word) => word.id),
          revealedCells: ["2:0"],
          completed: true,
          completedAt: "2026-04-24T00:00:00.000Z",
          hintsUsed: 1
        }
      },
      words: {
        "nce-1-u1-cat": {
          wordId: "nce-1-u1-cat",
          masteryLevel: 2,
          correctCount: 1,
          wrongCount: 0,
          streak: 1,
          favorite: true,
          difficult: false,
          lastReviewed: "2026-04-24T00:00:00.000Z",
          nextReview: "2026-04-25T00:00:00.000Z"
        }
      }
    });

    const serialized = serializePersistedGameProgress(
      getPersistedGameProgress(originalProgress)
    );
    const restored = deserializePersistedGameProgress(serialized);

    assert.deepEqual(restored, originalProgress);
  });

  test("normalizes invalid persisted coins on restore", () => {
    const restored = deserializePersistedGameProgress(
      JSON.stringify({
        state: {
          coins: -5,
          unlockedLevelIds: ["nce-1-u1-level-1"],
          currentLevelId: "nce-1-u1-level-1",
          levels: {},
          words: {},
          studyStats: {}
        },
        version: 0
      })
    );

    assert.equal(restored?.coins, 100);
  });

  test("normalizes malformed persisted records on restore", () => {
    const legacyLevel = getTestLevel();
    const restored = normalizeGameProgress({
      ...createInitialGameProgress(),
      coins: 75,
      currentLevelId: "nce-1-u1-level-1",
      levels: {
        "nce-1-u1-level-1": {
          foundWords: "cat",
          revealedCells: null,
          completed: "yes",
          hintsUsed: -4
        }
      },
      words: {
        "nce-1-u1-cat": {
          masteryLevel: 99,
          correctCount: "bad",
          wrongCount: -4
        }
      },
      studyStats: {
        totalWordsLearned: -2,
        totalWordsMastered: 1.5,
        totalStudyMinutes: 30.7,
        studyStreak: -1,
        firstTryCorrectWords: -3,
        completedDueReviews: Number.NaN,
        actualHintEvents: 2.8,
        activeDateKeys: ["bad", "2026-07-18", "2026-07-18", "2026-02-31"]
      }
    } as unknown as GameProgress);

    assert.deepEqual(restored.levels[legacyLevel.id], {
      layoutRevision: legacyLevel.layoutRevision,
      foundWords: [],
      revealedCells: [],
      hintedWordIds: [],
      hintStages: {},
      completed: false,
      hintsUsed: 0,
      wrongAttempts: 0,
      duplicateAttempts: 0,
      bestStars: 0,
      attemptCount: 0
    });
    assert.equal(restored.words["legacy:nce-1-u1-cat"]?.masteryLevel, 5);
    assert.equal(restored.words["legacy:nce-1-u1-cat"]?.correctCount, 0);
    assert.equal(restored.studyStats.totalStudyMinutes, 30);
    assert.equal(restored.studyStats.firstTryCorrectWords, 0);
    assert.equal(restored.studyStats.completedDueReviews, 0);
    assert.equal(restored.studyStats.actualHintEvents, 2);
    assert.deepEqual(restored.studyStats.activeDateKeys, ["2026-07-18"]);
  });

  test("drops malformed persisted grid-cell keys instead of casting them", () => {
    const level = getTestLevel();
    const validCellKey = Object.keys(buildGrid(level))[0];
    assert.ok(validCellKey);
    const restored = mergePersistedGameProgress({
      levels: {
        "nce-1-u1-level-1": {
          layoutRevision: level.layoutRevision,
          revealedCells: [validCellKey, "bad", "-1:2", "1.5:2"]
        }
      }
    }, createInitialGameProgress());

    assert.deepEqual(restored.levels[level.id]?.revealedCells, [validCellKey]);
  });

  test("normalizes known levels against their grid and target ids", () => {
    const level = getTestLevel();
    const validTarget = level.targetWords[0];
    const validCellKey = Object.keys(buildGrid(level))[0];
    assert.ok(validTarget);
    assert.ok(validCellKey);
    const restored = mergePersistedGameProgress({
      levels: {
        [level.id]: {
          layoutRevision: level.layoutRevision,
          foundWords: [validTarget.id, validTarget.id, "unknown-word"],
          revealedCells: [validCellKey, validCellKey, "99:99"],
          hintedWordIds: [validTarget.id, validTarget.id, "unknown-word"],
          hintStages: {
            [validTarget.id]: 2,
            "unknown-word": 99
          },
          completed: false
        }
      }
    }, createInitialGameProgress());
    const normalized = restored.levels[level.id];
    assert.ok(normalized);

    assert.deepEqual(normalized.foundWords, [validTarget.id]);
    assert.deepEqual(normalized.revealedCells, [validCellKey]);
    assert.deepEqual(normalized.hintedWordIds, [validTarget.id]);
    assert.deepEqual(Reflect.get(normalized, "hintStages"), {
      [validTarget.id]: 2
    });
  });

  test("clears coordinate hints when a curriculum layout revision changes", () => {
    const level = getFirstLevel();
    assert.ok(level);
    const cellKey = Object.keys(buildGrid(level))[0];
    const target = level.targetWords[0];
    assert.ok(cellKey);
    assert.ok(target);
    const restored = mergePersistedGameProgress(
      {
        coins: 77,
        levels: {
          [level.id]: {
            layoutRevision: "old-layout",
            foundWords: [],
            revealedCells: [cellKey],
            hintedWordIds: [target.id],
            hintStages: { [target.id]: 3 },
            hintsUsed: 3,
            bestStars: 2
          }
        }
      },
      createInitialGameProgress()
    );
    const normalized = restored.levels[level.id];

    assert.ok(normalized);
    assert.equal(restored.coins, 77);
    assert.equal(normalized.layoutRevision, level.layoutRevision);
    assert.deepEqual(normalized.revealedCells, []);
    assert.deepEqual(normalized.hintedWordIds, []);
    assert.deepEqual(normalized.hintStages, {});
    assert.equal(normalized.hintsUsed, 0);
    assert.equal(normalized.bestStars, 2);
  });

  test("infers current review debt from a legacy difficult wrong record", () => {
    const restored = mergePersistedGameProgress({
      words: {
        "nce-1-u1-cat": {
          wordId: "nce-1-u1-cat",
          correctCount: 1,
          wrongCount: 2,
          difficult: true
        }
      }
    }, createInitialGameProgress());

    assert.deepEqual(
      restored.words["legacy:nce-1-u1-cat"]?.reviewReasons,
      ["wrong"]
    );
  });

  test("does not let an unknown corrupted word inflate learned statistics", () => {
    const restored = mergePersistedGameProgress({
      words: {
        "unknown-corrupted-word": {
          wordId: "unknown-corrupted-word",
          correctCount: 999,
          masteryLevel: 5
        }
      }
    }, createInitialGameProgress());

    assert.equal(restored.studyStats.totalWordsLearned, 0);
    assert.equal(restored.studyStats.totalWordsMastered, 0);
  });

  test("keeps learned totals from all three curriculum namespaces during migration", () => {
    const restored = mergePersistedGameProgress({
      words: {
        "nce-1997-b1-word-known": { correctCount: 1, masteryLevel: 1 },
        "ielts-nawl-v1-word-known": { correctCount: 1, masteryLevel: 1 },
        "kaoyan-core-v1-word-known": { correctCount: 1, masteryLevel: 1 },
        "unknown-corrupted-word": { correctCount: 999, masteryLevel: 5 }
      },
      studyStats: { totalWordsLearned: 99, totalWordsMastered: 99 }
    }, createInitialGameProgress());

    assert.equal(restored.studyStats.totalWordsLearned, 3);
    assert.equal(restored.studyStats.totalWordsMastered, 0);
  });

  test("repairs an all-found incomplete save without awarding coins", () => {
    const level = getTestLevel();
    const progress = mergePersistedGameProgress({
      coins: 73,
      levels: {
        [level.id]: {
          foundWords: level.targetWords.map((word) => word.id),
          completed: false
        }
      }
    }, createInitialGameProgress());

    assert.equal(progress.levels[level.id]?.completed, true);
    assert.equal(progress.coins, 73);
  });

  test("treats a reliable completed history as completed even when found words are partial", () => {
    const level = getTestLevel();
    const restored = mergePersistedGameProgress({
      coins: 130,
      levels: {
        [level.id]: {
          foundWords: [level.targetWords[0]?.id],
          completed: true,
          completedAt: "2026-07-10T00:00:00.000Z",
          attemptCount: 1
        }
      }
    }, createInitialGameProgress());
    const historical = restored.levels[level.id];
    assert.ok(historical);
    assert.equal(historical.completed, true);
    let replay = createReplayLevelProgress(historical);
    let progress = restored;
    for (const word of level.targetWords) {
      const result = applyWordSubmission(progress, level, word.word, replay);
      progress = result.nextProgress;
      replay = result.attemptProgress;
    }

    assert.equal(progress.coins, 130);
  });

  test("persists pronunciation clue stages per target word", () => {
    const level = getTestLevel();
    const target = level.targetWords[0];
    assert.ok(target);
    const result = applyPronunciationHintUsage(
      createInitialGameProgress(),
      level,
      undefined,
      target.id
    );

    assert.deepEqual(Reflect.get(result.attemptProgress, "hintStages"), {
      [target.id]: 1
    });

    const revealed = applyHintUsage(
      result.nextProgress,
      level,
      result.attemptProgress,
      target.id
    );
    const restored = mergePersistedGameProgress(
      revealed.nextProgress,
      createInitialGameProgress()
    );

    assert.deepEqual(restored.levels[level.id]?.hintStages, {
      [target.id]: 2
    });
  });

  test("merges persisted progress safely before store hydration", () => {
    const fallback = createInitialGameProgress();
    const legacyLevel = getTestLevel();
    const merged = mergePersistedGameProgress(
      {
        coins: 80,
        levels: {
          "nce-1-u1-level-1": {
            foundWords: "cat",
            revealedCells: null,
            completed: "yes",
            hintsUsed: -4
          }
        },
        words: {
          "nce-1-u1-cat": {
            masteryLevel: 2,
            correctCount: 1
          }
        }
      },
      fallback
    );

    assert.equal(merged.coins, 80);
    assert.deepEqual(merged.levels[legacyLevel.id], {
      layoutRevision: legacyLevel.layoutRevision,
      foundWords: [],
      revealedCells: [],
      hintedWordIds: [],
      hintStages: {},
      completed: false,
      hintsUsed: 0,
      wrongAttempts: 0,
      duplicateAttempts: 0,
      bestStars: 0,
      attemptCount: 0
    });
    assert.equal(merged.words["legacy:nce-1-u1-cat"]?.masteryLevel, 2);
    assert.deepEqual(merged.unlockedLevelIds, fallback.unlockedLevelIds);
    assert.equal(merged.currentLevelId, fallback.currentLevelId);
  });

  test("normalizes legacy numeric current level ids back to the generated path", () => {
    const restored = normalizeGameProgress({
      ...createInitialGameProgress(),
      currentLevelId: "1"
    });
    const firstLevel = getFirstLevel();

    assert.equal(getLevelById("1"), undefined);
    assert.equal(restored.currentLevelId, firstLevel?.id);
    assert.equal(restored.currentLevelId, "nce-1997-b1-level-001");
  });

  test("derives book and unit progress from saved level and word completion", () => {
    const level = getFirstLevel();
    assert.ok(level);
    const levels = {
      [level.id]: {
        ...createGameState(level).progress,
        foundWords: level.targetWords.map((word) => word.id),
        revealedCells: [],
        completed: true,
        completedAt: "2026-04-24T00:00:00.000Z",
        hintsUsed: 0
      }
    };
    const firstVocabularyWordId = level.targetWords[0]?.vocabularyWordId;
    assert.ok(firstVocabularyWordId);
    const words = {
      [firstVocabularyWordId]: {
        wordId: firstVocabularyWordId,
        masteryLevel: 4,
        correctCount: 2,
        wrongCount: 0,
        streak: 2,
        favorite: false,
        difficult: false
      }
    };

    const bookProgress = getBookProgress("nce-1997-b1", levels, words);
    const unitProgress = getUnitProgress("nce-1997-b1-u1", levels, words);

    assert.equal(bookProgress.completedLevels, 1);
    assert.equal(bookProgress.totalLevels, 50);
    assert.equal(bookProgress.masteredWords, 1);
    assert.equal(unitProgress.completedLevels, 1);
    assert.equal(unitProgress.totalLevels, 10);
  });
});
