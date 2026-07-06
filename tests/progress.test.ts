import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  getBookProgress,
  getLevelById,
  getRecommendedLevel,
  getUnitProgress
} from "../lib/levelLoader";
import {
  applyHintUsage,
  applyWordSubmission,
  createInitialGameProgress,
  mergePersistedGameProgress,
  normalizeGameProgress
} from "../lib/progress";
import { createGameState } from "../src/lib/game-engine";
import {
  deserializePersistedGameProgress,
  getPersistedGameProgress,
  serializePersistedGameProgress
} from "../lib/storage";
import type { GameProgress, Level } from "../types/game";

function getTestLevel(levelId = "1"): Level {
  const level = getLevelById(levelId);
  assert.ok(level, `Expected level ${levelId} to exist`);
  return level;
}

describe("progress and persistence", () => {
  test("starts with all levels open and the first recommended level selected", () => {
    const progress = createInitialGameProgress();

    assert.equal(progress.coins, 100);
    assert.equal(progress.unlockedLevelIds.length > 1, true);
    assert.equal(progress.currentLevelId, "1");
    assert.equal(progress.currentBookId, "nce-1");
    assert.equal(progress.currentUnitId, "nce-1-u1");
  });

  test("updates coins, revealed cells, and difficult-word tracking after a paid hint", () => {
    const level = getTestLevel();
    const progress = createInitialGameProgress();
    const { nextProgress, result } = applyHintUsage(progress, level);

    assert.equal(result.status, "revealed");
    assert.equal(
      nextProgress.coins,
      createGameState(level, undefined, progress.coins).coins - level.hintCost
    );
    assert.equal(nextProgress.levels[level.id]?.hintsUsed, 1);
    assert.deepEqual(nextProgress.levels[level.id]?.revealedCells, ["2:0"]);
    assert.equal(result.vocabularyWordId, "nce-1-u1-cat");
    assert.equal(nextProgress.words["nce-1-u1-cat"]?.difficult, true);
  });

  test("does not change progress when hint coins are insufficient", () => {
    const level = getTestLevel();
    const progress = {
      ...createInitialGameProgress(),
      coins: level.hintCost - 1
    };
    const { nextProgress, result } = applyHintUsage(progress, level);

    assert.equal(result.status, "not-enough-coins");
    assert.deepEqual(nextProgress, progress);
  });

  test("records vocabulary learning and study stats on level completion", () => {
    const level = getTestLevel();
    let progress = createInitialGameProgress();

    for (const word of level.targetWords) {
      const submission = applyWordSubmission(progress, level, word.word);
      progress = submission.nextProgress;
    }

    assert.equal(progress.levels[level.id]?.completed, true);
    assert.equal(progress.unlockedLevelIds.includes("1"), true);
    assert.equal(
      progress.coins,
      100 + level.rewardCoins + (level.perfectBonusCoins ?? 0)
    );
    assert.equal(progress.words["nce-1-u1-cat"]?.correctCount, 1);
    assert.equal(progress.studyStats.totalWordsLearned > 0, true);
    assert.equal(progress.studyStats.totalStudyMinutes > 0, true);
    assert.equal(getRecommendedLevel(progress.levels)?.id, "2");
  });

  test("does not award completion coins twice", () => {
    const level = getTestLevel();
    const baseProgress = normalizeGameProgress({
      ...createInitialGameProgress(),
      levels: {
        [level.id]: {
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
      currentLevelId: "2",
      levels: {
        [level.id]: {
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
          unlockedLevelIds: ["1"],
          currentLevelId: "1",
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
    const restored = normalizeGameProgress({
      ...createInitialGameProgress(),
      coins: 75,
      currentLevelId: "1",
      levels: {
        "1": {
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
        studyStreak: -1
      }
    } as unknown as GameProgress);

    assert.deepEqual(restored.levels["1"], {
      foundWords: [],
      revealedCells: [],
      completed: false,
      hintsUsed: 0
    });
    assert.equal(restored.words["nce-1-u1-cat"]?.masteryLevel, 5);
    assert.equal(restored.words["nce-1-u1-cat"]?.correctCount, 0);
    assert.equal(restored.studyStats.totalStudyMinutes, 30);
  });

  test("merges persisted progress safely before store hydration", () => {
    const fallback = createInitialGameProgress();
    const merged = mergePersistedGameProgress(
      {
        coins: 80,
        levels: {
          "1": {
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
    assert.deepEqual(merged.levels["1"], {
      foundWords: [],
      revealedCells: [],
      completed: false,
      hintsUsed: 0
    });
    assert.equal(merged.words["nce-1-u1-cat"]?.masteryLevel, 2);
    assert.deepEqual(merged.unlockedLevelIds, fallback.unlockedLevelIds);
    assert.equal(merged.currentLevelId, fallback.currentLevelId);
  });

  test("derives book and unit progress from saved level and word completion", () => {
    const level = getTestLevel();
    const levels = {
      [level.id]: {
        foundWords: level.targetWords.map((word) => word.id),
        revealedCells: [],
        completed: true,
        completedAt: "2026-04-24T00:00:00.000Z",
        hintsUsed: 0
      }
    };
    const words = {
      "nce-1-u1-cat": {
        wordId: "nce-1-u1-cat",
        masteryLevel: 4,
        correctCount: 2,
        wrongCount: 0,
        streak: 2,
        favorite: false,
        difficult: false
      }
    };

    const bookProgress = getBookProgress("nce-1", levels, words);
    const unitProgress = getUnitProgress("nce-1-u1", levels, words);

    assert.equal(bookProgress.completedLevels, 1);
    assert.equal(bookProgress.totalLevels, 6);
    assert.equal(bookProgress.masteredWords, 1);
    assert.equal(unitProgress.completedLevels, 1);
    assert.equal(unitProgress.totalLevels, 3);
  });
});
