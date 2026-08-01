import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getParentLearningMetrics } from "../lib/parent-metrics";
import type { GameProgress } from "../types/game";

function progressWithLastDate(lastStudyDate?: string): GameProgress {
  return {
    coins: 100,
    unlockedLevelIds: [],
    levels: {
      first: {
        foundWords: [],
        revealedCells: [],
        hintedWordIds: [],
        hintStages: {},
        hintsUsed: 2,
        wrongAttempts: 99,
        duplicateAttempts: 0,
        completed: true,
        bestStars: 2,
        attemptCount: 1
      }
    },
    words: {
      one: {
        wordId: "one",
        masteryLevel: 4,
        correctCount: 4,
        wrongCount: 3,
        streak: 2,
        favorite: false,
        difficult: false
      },
      two: {
        wordId: "two",
        masteryLevel: 2,
        correctCount: 2,
        wrongCount: 1,
        streak: 1,
        favorite: false,
        difficult: false
      }
    },
    studyStats: {
      totalWordsLearned: 2,
      totalWordsMastered: 1,
      totalStudyMinutes: 999,
      studyStreak: 3,
      lastStudyDate,
      firstTryCorrectWords: 7,
      completedDueReviews: 5,
      actualHintEvents: 4,
      activeDateKeys: ["2026-07-16", "bad", "2026-07-17", "2026-07-18", "2026-07-18"]
    }
  };
}

describe("truthful parent metrics", () => {
  test("uses only directly recorded counters and omits estimated minutes", () => {
    const metrics = getParentLearningMetrics(
      progressWithLastDate("2026-07-18"),
      "2026-07-18"
    );

    assert.deepEqual(metrics, {
      completedLevels: 1,
      masteredWords: 1,
      firstTryCorrectWords: 7,
      completedDueReviews: 5,
      actualHintEvents: 4,
      recordedWrongAttempts: 4,
      activeDays: 3,
      studyStreak: 3,
      lastActiveDate: "2026-07-18"
    });
    assert.equal("totalStudyMinutes" in metrics, false);
    assert.equal("firstAttemptAccuracy" in metrics, false);
  });

  test("recomputes the live streak against the current local date", () => {
    const progress = progressWithLastDate("2026-07-18");
    assert.equal(getParentLearningMetrics(progress, "2026-07-19").studyStreak, 3);
    assert.equal(getParentLearningMetrics(progress, "2026-07-20").studyStreak, 0);
  });

  test("derives last activity from validated date keys instead of a corrupt cache", () => {
    assert.equal(
      getParentLearningMetrics(progressWithLastDate("not-a-date")).lastActiveDate,
      "2026-07-18"
    );
    assert.equal(
      getParentLearningMetrics(progressWithLastDate("2026-02-31")).lastActiveDate,
      "2026-07-18"
    );
  });
});
