import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createEmptyWordLearningProgress,
  createInitialLearningStatistics,
  getDifficultWords,
  getFavoriteWords,
  getMasteredWords,
  markWordCorrect,
  markWordWrong,
  recordStudySession,
  synchronizeLearningStatistics,
  toggleFavoriteWord
} from "../src/lib/learning-engine";

describe("learning engine", () => {
  test("marks a word correct and increases mastery", () => {
    const base = createEmptyWordLearningProgress("word-1");
    const updated = markWordCorrect(base, "2026-06-22T00:00:00.000Z");

    assert.equal(updated.correctCount, 1);
    assert.equal(updated.streak, 1);
    assert.equal(updated.masteryLevel, 1);
    assert.equal(updated.lastReviewed, "2026-06-22T00:00:00.000Z");
  });

  test("marks a word wrong and lowers mastery", () => {
    const base = {
      ...createEmptyWordLearningProgress("word-1"),
      masteryLevel: 3,
      streak: 2
    };
    const updated = markWordWrong(base, "2026-06-22T00:00:00.000Z");

    assert.equal(updated.wrongCount, 1);
    assert.equal(updated.streak, 0);
    assert.equal(updated.masteryLevel, 2);
    assert.equal(updated.difficult, true);
  });

  test("filters favorite, difficult, and mastered words", () => {
    const progressByWordId = {
      one: {
        ...createEmptyWordLearningProgress("one"),
        favorite: true
      },
      two: {
        ...createEmptyWordLearningProgress("two"),
        difficult: true
      },
      three: {
        ...createEmptyWordLearningProgress("three"),
        masteryLevel: 4
      }
    };

    assert.deepEqual(getFavoriteWords(progressByWordId).map((item) => item.wordId), ["one"]);
    assert.deepEqual(getDifficultWords(progressByWordId).map((item) => item.wordId), ["two"]);
    assert.deepEqual(getMasteredWords(progressByWordId).map((item) => item.wordId), ["three"]);
  });

  test("updates learning statistics and study streak", () => {
    const stats = recordStudySession(
      createInitialLearningStatistics(),
      "2026-06-22T08:00:00.000Z",
      12
    );
    const nextDayStats = recordStudySession(
      stats,
      "2026-06-23T08:00:00.000Z",
      8
    );
    const syncedStats = synchronizeLearningStatistics(nextDayStats, {
      one: {
        ...createEmptyWordLearningProgress("one"),
        correctCount: 1
      },
      two: {
        ...createEmptyWordLearningProgress("two"),
        masteryLevel: 4
      }
    });
    const favorite = toggleFavoriteWord(createEmptyWordLearningProgress("fav"));

    assert.equal(nextDayStats.studyStreak, 2);
    assert.equal(nextDayStats.totalStudyMinutes, 20);
    assert.equal(syncedStats.totalWordsLearned, 1);
    assert.equal(syncedStats.totalWordsMastered, 1);
    assert.equal(favorite.favorite, true);
  });
});
