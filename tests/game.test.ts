import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applyHint,
  applyWordSubmission,
  buildGrid,
  checkLevelComplete,
  createEmptyLevelProgress,
  createGameState,
  getCompletionReward,
  STARTING_COINS,
  getNextHint,
  scoreLevelAttempt,
  validateWord
} from "../src/lib/game-engine";
import {
  getClueSelectionLabel,
  resolveActiveClue
} from "../src/lib/crossword-session";
import {
  getAllBooks,
  getAllLevelIds,
  getBookById,
  getBookProgress,
  getFirstLevel,
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

function getTestLevel(levelId = "nce-1-u1-level-1"): Level {
  const level = getLevelById(levelId);
  assert.ok(level, `Expected level ${levelId} to exist`);
  return level;
}

describe("game engine", () => {
  test("rejects conflicting and same-direction word overlaps", () => {
    const baseLevel = getTestLevel();
    const conflictingLevel: Level = {
      ...baseLevel,
      id: "conflict",
      grid: { rows: 3, cols: 3 },
      targetWords: [
        {
          id: "cat",
          word: "CAT",
          clue: "animal",
          start: { row: 0, col: 0 },
          direction: "across"
        },
        {
          id: "dog",
          word: "DOG",
          clue: "animal",
          start: { row: 0, col: 0 },
          direction: "down"
        }
      ]
    };
    const overlappingLevel: Level = {
      ...conflictingLevel,
      id: "overlap",
      targetWords: [
        conflictingLevel.targetWords[0],
        {
          id: "cab",
          word: "CAB",
          clue: "vehicle",
          start: { row: 0, col: 0 },
          direction: "across"
        }
      ]
    };

    assert.throws(() => buildGrid(conflictingLevel), /conflicts at 0:0/);
    assert.throws(() => buildGrid(overlappingLevel), /same direction/);
  });

  test("keeps the selected unsolved clue active and advances after it is solved", () => {
    const level = getTestLevel();
    const secondWord = level.targetWords[1];
    assert.ok(secondWord);

    const selected = resolveActiveClue(level, createEmptyLevelProgress(), secondWord.id);
    assert.equal(selected?.id, secondWord.id);
    assert.equal(
      getClueSelectionLabel(level, secondWord.id),
      `Clue 2, ${secondWord.direction}, ${secondWord.word.length} letters`
    );
    assert.equal(getClueSelectionLabel(level, secondWord.id).includes(secondWord.word), false);

    const afterSolve = resolveActiveClue(
      level,
      {
        ...createEmptyLevelProgress(),
        foundWords: [secondWord.id]
      },
      secondWord.id
    );
    assert.notEqual(afterSolve?.id, secondWord.id);
  });

  test("does not solve a different valid answer while another clue is selected", () => {
    const level = getTestLevel();
    const selectedWord = level.targetWords[0];
    const otherWord = level.targetWords[1];
    assert.ok(selectedWord);
    assert.ok(otherWord);

    const result = applyWordSubmission(
      createGameState(level),
      otherWord.word,
      { targetWordId: selectedWord.id }
    );

    assert.equal(result.status, "not-target");
    assert.equal(result.state.progress.wrongAttempts, 1);
  });

  test("creates level attempts with scoring metadata", () => {
    const progress = createEmptyLevelProgress();

    assert.equal(progress.bestStars, 0);
    assert.equal(progress.attemptCount, 0);
    assert.equal(progress.wrongAttempts, 0);
  });

  test("scores completion, low hints, and low errors as three independent stars", () => {
    assert.equal(
      scoreLevelAttempt({
        ...createEmptyLevelProgress(),
        completed: true,
        hintsUsed: 1,
        wrongAttempts: 1
      }),
      3
    );
    assert.equal(
      scoreLevelAttempt({
        ...createEmptyLevelProgress(),
        completed: true,
        hintsUsed: 2,
        wrongAttempts: 2
      }),
      1
    );
    assert.equal(scoreLevelAttempt(createEmptyLevelProgress()), 0);
  });

  test("validates a correct target word", () => {
    const level = getTestLevel();
    const result = validateWord(level, " cat ");

    assert.equal(result?.id, "legacy:nce-1-u1-cat");
    assert.equal(result?.word, "CAT");
  });

  test("rejects a duplicate target word", () => {
    const level = getTestLevel();
    const state = createGameState(level, {
      ...createEmptyLevelProgress(),
      foundWords: ["legacy:nce-1-u1-cat"]
    });

    const result = applyWordSubmission(state, "CAT");

    assert.equal(result.status, "already-found");
    assert.equal(result.word.id, "legacy:nce-1-u1-cat");
    assert.deepEqual(result.state.progress, {
      ...state.progress,
      duplicateAttempts: 1
    });
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

  test("keeps the full completion reward after using a hint", () => {
    const level = getTestLevel();
    const withoutHint = getCompletionReward(createGameState(level));
    const withHint = getCompletionReward(
      createGameState(level, {
        ...createEmptyLevelProgress(),
        hintsUsed: 1
      })
    );

    assert.deepEqual(withHint, withoutHint);
    assert.equal(withHint.baseReward, level.rewardCoins);
    assert.equal(withHint.bonusReward, level.perfectBonusCoins ?? 0);
  });

  test("reveals the next hidden hint cell", () => {
    const level = getTestLevel();
    const state = createGameState(level, createEmptyLevelProgress(), STARTING_COINS);

    const nextHint = getNextHint(state);
    assert.equal(nextHint?.letter, "C");

    const firstHint = applyHint(state);

    assert.equal(firstHint.status, "revealed");
    if (firstHint.status !== "revealed" || !nextHint) {
      assert.fail("Expected a visible first hint");
    }
    assert.equal(firstHint.cellKey, `${nextHint.row}:${nextHint.col}`);
    assert.equal(firstHint.letter, "C");

    const secondHint = applyHint(firstHint.state);

    assert.equal(secondHint.status, "revealed");
    if (firstHint.status === "revealed" && secondHint.status === "revealed") {
      assert.equal(secondHint.state.coins, STARTING_COINS);
      assert.notEqual(secondHint.cellKey, firstHint.cellKey);
    }
  });

  test("keeps hints available when the player has no coins", () => {
    const level = getTestLevel();
    const result = applyHint(
      createGameState(level, createEmptyLevelProgress(), 0)
    );

    assert.equal(result.status, "revealed");
    assert.equal(result.state.coins, 0);
    assert.equal(result.state.progress.hintsUsed, 1);
  });

  test("reveals the first hidden letter for the requested clue", () => {
    const level = getTestLevel();
    const requestedWord = level.targetWords[1];
    assert.ok(requestedWord);
    const result = applyHint(createGameState(level), requestedWord.id);

    assert.equal(result.status, "revealed");
    assert.equal(result.cellKey, `${requestedWord.start.row}:${requestedWord.start.col}`);
    assert.equal(result.letter, requestedWord.word[0]);
  });

  test("attributes an intersecting hint to the explicitly requested word", () => {
    const crossingLevel: Level = {
      ...getTestLevel(),
      id: "crossing-hint",
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

    const result = applyHint(createGameState(crossingLevel), "car");

    assert.equal(result.status, "revealed");
    if (result.status === "revealed") {
      assert.equal(result.vocabularyWordId, "v-car");
    }
  });

  test("exposes no paid-hint cost contract", () => {
    const result = applyHint(createGameState(getTestLevel()));

    assert.equal(result.status, "revealed");
    if (result.status === "revealed") {
      assert.equal("cost" in result, false);
    }
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
    const book = getBookById("nce-1997-b1");
    const unit = getUnitById("nce-1997-b1-u1");
    const bookUnits = getUnitsByBookId("nce-1997-b1");
    const unitLevels = getLevelsByUnitId("nce-1997-b1-u1");
    const firstLevel = getFirstLevel();
    const firstLevelId = firstLevel?.id ?? "";
    const nextLevel = getNextLevel(firstLevelId);
    const bookProgress = getBookProgress("nce-1997-b1", {
      [firstLevelId]: {
        ...createEmptyLevelProgress(),
        foundWords: unitLevels[0]?.targetWords.map((word) => word.id) ?? [],
        completed: true
      }
    });
    const unitProgress = getUnitProgress("nce-1997-b1-u1", {
      [firstLevelId]: {
        ...createEmptyLevelProgress(),
        foundWords: unitLevels[0]?.targetWords.map((word) => word.id) ?? [],
        completed: true
      }
    });

    assert.equal(books.length, 4);
    assert.equal(book?.id, "nce-1997-b1");
    assert.equal(unit?.id, "nce-1997-b1-u1");
    assert.equal(firstLevelId, "nce-1997-b1-level-001");
    assert.equal(levelExists(firstLevelId), true);
    assert.equal(levelExists("1"), false);
    assert.equal(getLevelById("1"), undefined);
    assert.equal(levelExists("missing"), false);
    assert.equal(getLevelById("missing"), undefined);
    assert.equal(bookUnits.length, 5);
    assert.equal(unitLevels.length, 10);
    assert.equal(nextLevel?.id, "nce-1997-b1-level-002");
    assert.equal(getNextLevel("missing"), undefined);
    assert.equal(bookProgress.totalLevels, 50);
    assert.equal(bookProgress.completedLevels, 1);
    assert.equal(unitProgress.totalLevels, 10);
    assert.equal(unitProgress.completedLevels, 1);
  });

  test("derives the recommended flow from completed levels", () => {
    const unitLevels = getLevelsByUnitId("nce-1997-b1-u1");
    const levelOne = unitLevels[0];
    assert.ok(levelOne, "Expected first level to exist");

    const initialUnlockedLevelIds = getInitialUnlockedLevelIds();
    assert.equal(initialUnlockedLevelIds.length > 1, true);
    assert.deepEqual(initialUnlockedLevelIds, getAllLevelIds());
    assert.equal(getNextUnlockedLevel({}, initialUnlockedLevelIds)?.id, "nce-1997-b1-level-001");

    const progress = {
      [levelOne.id]: {
        ...createEmptyLevelProgress(),
        foundWords: levelOne.targetWords.map((word) => word.id),
        completed: true
      }
    };
    const unlockedAfterLevelOne = getUnlockedLevelIdsFromProgress(progress);
    const summary = getProgressSummary(progress);

    assert.equal(unlockedAfterLevelOne.length, initialUnlockedLevelIds.length);
    assert.equal(getNextUnlockedLevel(progress, unlockedAfterLevelOne)?.id, "nce-1997-b1-level-002");
    assert.equal(summary.completedLevels, 1);
    assert.equal(summary.completionRate, 1);
  });
});
