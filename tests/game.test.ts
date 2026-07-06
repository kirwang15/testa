import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applyHint,
  applyWordSubmission,
  checkLevelComplete,
  createEmptyLevelProgress,
  createGameState,
  DEFAULT_HINT_COST,
  getCompletionReward,
  STARTING_COINS,
  getNextHint,
  validateWord
} from "../src/lib/game-engine";
import {
  getAllBooks,
  getBookById,
  getBookProgress,
  getInitialUnlockedLevelIds,
  getLevelById,
  getNextLevel,
  getNextUnlockedLevel,
  getProgressSummary,
  getUnitById,
  getUnitProgress,
  getUnitsByBookId,
  getLevelsByUnitId,
  getUnlockedLevelIdsFromProgress,
  levelExists
} from "../lib/levelLoader";
import type { Level } from "../types/game";

function getTestLevel(): Level {
  const level = getLevelById("1");
  assert.ok(level, "Expected level 1 to exist");
  return level;
}

describe("game engine", () => {
  test("validates a correct target word", () => {
    const level = getTestLevel();
    const result = validateWord(level, " cat ");

    assert.equal(result?.id, "cat");
    assert.equal(result?.word, "CAT");
  });

  test("rejects a duplicate target word", () => {
    const level = getTestLevel();
    const state = createGameState(level, {
      ...createEmptyLevelProgress(),
      foundWords: ["cat"]
    });

    const result = applyWordSubmission(state, "CAT");

    assert.equal(result.status, "already-found");
    assert.equal(result.word.id, "cat");
  });

  test("rejects a word that is not in the level", () => {
    const level = getTestLevel();
    const result = applyWordSubmission(
      createGameState(level, createEmptyLevelProgress()),
      "CART"
    );

    assert.equal(result.status, "not-target");
    assert.equal(result.attempt, "CART");
  });

  test("detects level completion when the final target word is found", () => {
    const level = getTestLevel();
    const finalWord = level.targetWords[level.targetWords.length - 1];
    assert.ok(finalWord, "Expected the test level to have a final word");

    const foundBeforeFinalWord = level.targetWords
      .slice(0, -1)
      .map((word) => word.id);
    const state = createGameState(level, {
      ...createEmptyLevelProgress(),
      foundWords: foundBeforeFinalWord
    });

    const result = applyWordSubmission(state, finalWord.word, {
      completedAt: "2026-04-27T00:00:00.000Z"
    });

    assert.equal(result.status, "level-complete");
    assert.equal(result.baseReward, level.rewardCoins);
    assert.equal(result.bonusReward, level.perfectBonusCoins ?? 0);
    assert.equal(
      result.reward,
      level.rewardCoins + (level.perfectBonusCoins ?? 0)
    );
    assert.equal(
      checkLevelComplete(result.state),
      true
    );
  });

  test("does not award the no-hint bonus after using a hint", () => {
    const level = getTestLevel();
    const reward = getCompletionReward(
      createGameState(level, {
        ...createEmptyLevelProgress(),
        hintsUsed: 1
      })
    );

    assert.equal(reward.baseReward, level.rewardCoins);
    assert.equal(reward.bonusReward, 0);
    assert.equal(reward.totalReward, level.rewardCoins);
  });

  test("reveals the next hidden hint cell", () => {
    const level = getTestLevel();
    const state = createGameState(level, createEmptyLevelProgress(), STARTING_COINS);

    const nextHint = getNextHint(state);
    assert.equal(nextHint?.letter, "C");

    const firstHint = applyHint(state);

    assert.equal(firstHint.status, "revealed");
    assert.equal(firstHint.cellKey, "2:0");
    assert.equal(firstHint.letter, "C");
    assert.equal(firstHint.cost, level.hintCost);

    const secondHint = applyHint(firstHint.state);

    assert.equal(secondHint.status, "revealed");
    if (firstHint.status === "revealed" && secondHint.status === "revealed") {
      assert.equal(secondHint.state.coins, STARTING_COINS - DEFAULT_HINT_COST * 2);
      assert.notEqual(secondHint.cellKey, firstHint.cellKey);
    }
  });

  test("blocks hints when coins are too low", () => {
    const level = getTestLevel();
    const result = applyHint(
      createGameState(level, createEmptyLevelProgress(), level.hintCost - 1)
    );

    assert.deepEqual(result, {
      action: "use-hint",
      status: "not-enough-coins",
      cost: level.hintCost,
      state: createGameState(level, createEmptyLevelProgress(), level.hintCost - 1)
    });
  });

  test("returns no hint when all cells are already visible", () => {
    const level = getTestLevel();
    const result = applyHint(
      createGameState(level, {
        ...createEmptyLevelProgress(),
        foundWords: level.targetWords.map((word) => word.id),
        completed: true
      })
    );

    assert.equal(result.status, "no-hints-left");
  });

  test("loads levels and vocabulary progress through developer helpers", () => {
    const books = getAllBooks();
    const book = getBookById("nce-1");
    const unit = getUnitById("nce-1-u1");
    const bookUnits = getUnitsByBookId("nce-1");
    const unitLevels = getLevelsByUnitId("nce-1-u1");
    const nextLevel = getNextLevel("1");
    const bookProgress = getBookProgress("nce-1", {
      "1": {
        ...createEmptyLevelProgress(),
        foundWords: unitLevels[0]?.targetWords.map((word) => word.id) ?? [],
        completed: true
      }
    });
    const unitProgress = getUnitProgress("nce-1-u1", {
      "1": {
        ...createEmptyLevelProgress(),
        foundWords: unitLevels[0]?.targetWords.map((word) => word.id) ?? [],
        completed: true
      }
    });

    assert.equal(books.length, 4);
    assert.equal(book?.id, "nce-1");
    assert.equal(unit?.id, "nce-1-u1");
    assert.equal(levelExists("1"), true);
    assert.equal(levelExists("missing"), false);
    assert.equal(getLevelById("missing"), undefined);
    assert.equal(bookUnits.length, 2);
    assert.equal(unitLevels.length, 3);
    assert.equal(nextLevel?.id, "2");
    assert.equal(getNextLevel("missing"), undefined);
    assert.equal(bookProgress.totalLevels, 6);
    assert.equal(bookProgress.completedLevels, 1);
    assert.equal(unitProgress.totalLevels, 3);
    assert.equal(unitProgress.completedLevels, 1);
  });

  test("derives the recommended flow from completed levels", () => {
    const unitLevels = getLevelsByUnitId("nce-1-u1");
    const levelOne = unitLevels[0];
    assert.ok(levelOne, "Expected level 1 to exist");

    const initialUnlockedLevelIds = getInitialUnlockedLevelIds();
    assert.equal(initialUnlockedLevelIds.length > 1, true);
    assert.equal(getNextUnlockedLevel({}, initialUnlockedLevelIds)?.id, "1");

    const progress = {
      "1": {
        ...createEmptyLevelProgress(),
        foundWords: levelOne.targetWords.map((word) => word.id),
        completed: true
      }
    };
    const unlockedAfterLevelOne = getUnlockedLevelIdsFromProgress(progress);
    const summary = getProgressSummary(progress);

    assert.equal(unlockedAfterLevelOne.length, initialUnlockedLevelIds.length);
    assert.equal(getNextUnlockedLevel(progress, unlockedAfterLevelOne)?.id, "2");
    assert.equal(summary.completedLevels, 1);
    assert.equal(summary.completionRate, 4);
  });
});
