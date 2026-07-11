import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  createEmptyWordLearningProgress,
  createInitialLearningStatistics,
  getDifficultWords,
  getDisplayableFavoriteWords,
  getFavoriteWords,
  getMasteredWords,
  getReviewableDifficultWords,
  markWordCorrect,
  markWordWrong,
  recordStudySession,
  synchronizeLearningStatistics,
  summarizeWordProgress,
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
        masteryLevel: 4,
        correctCount: 1
      }
    };

    assert.deepEqual(getFavoriteWords(progressByWordId).map((item) => item.wordId), ["one"]);
    assert.deepEqual(getDifficultWords(progressByWordId).map((item) => item.wordId), ["two"]);
    assert.deepEqual(getMasteredWords(progressByWordId).map((item) => item.wordId), ["three"]);
  });

  test("hides hint-only difficult words and unsolved legacy favorites from answer lists", () => {
    const hintOnly = {
      ...createEmptyWordLearningProgress("hint-only"),
      difficult: true,
      favorite: true
    };
    const answered = {
      ...createEmptyWordLearningProgress("answered"),
      difficult: true,
      favorite: true,
      wrongCount: 1,
      reviewReasons: ["wrong" as const]
    };
    const solvedFavorite = {
      ...createEmptyWordLearningProgress("solved"),
      favorite: true,
      correctCount: 1
    };
    const progress = { "hint-only": hintOnly, answered, solved: solvedFavorite };

    assert.deepEqual(
      getReviewableDifficultWords(progress).map((word) => word.wordId),
      ["answered"]
    );
    assert.deepEqual(
      getDisplayableFavoriteWords(progress).map((word) => word.wordId),
      ["solved"]
    );
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
        correctCount: 1,
        masteryLevel: 4
      },
      two: {
        ...createEmptyWordLearningProgress("two")
      }
    });
    const favorite = toggleFavoriteWord(createEmptyWordLearningProgress("fav"));

    assert.equal(nextDayStats.studyStreak, 2);
    assert.equal(nextDayStats.totalStudyMinutes, 20);
    assert.equal(syncedStats.totalWordsLearned, 1);
    assert.equal(syncedStats.totalWordsMastered, 1);
    assert.equal(favorite.favorite, true);
  });

  test("does not count a wrong-only guess as a learned word", () => {
    const syncedStats = synchronizeLearningStatistics(
      createInitialLearningStatistics(),
      {
        guessed: {
          ...createEmptyWordLearningProgress("guessed"),
          wrongCount: 2,
          difficult: true
        }
      }
    );

    assert.equal(syncedStats.totalWordsLearned, 0);
  });

  test("uses one truthful selector for learned and active review-debt metrics", () => {
    const wrongOnly = {
      ...createEmptyWordLearningProgress("wrong-only"),
      masteryLevel: 5,
      wrongCount: 2,
      difficult: true,
      reviewReasons: ["wrong" as const]
    };
    const staleDifficult = {
      ...createEmptyWordLearningProgress("stale"),
      difficult: true
    };

    assert.deepEqual(summarizeWordProgress([wrongOnly, staleDifficult]), {
      learnedWords: 0,
      masteredWords: 0,
      difficultWords: 1
    });
  });

  test("keeps review debt after a later level answer is correct", () => {
    const wrong = markWordWrong(
      createEmptyWordLearningProgress("word-1"),
      "2026-06-22T00:00:00.000Z"
    );
    const laterCorrect = markWordCorrect(
      wrong,
      "2026-06-22T00:01:00.000Z"
    );

    assert.equal(laterCorrect.difficult, true);
  });
});
