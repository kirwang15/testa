import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildReviewQueue,
  getDailyReviewList,
  getDueWords,
  scheduleNextReview
} from "../src/lib/review-engine";
import type { VocabularyWord, WordLearningProgress } from "../types/game";

const words: VocabularyWord[] = [
  {
    id: "word-1",
    bookId: "book",
    unitId: "unit",
    word: "apple",
    displayText: "apple",
    chineseMeaning: "苹果",
    examples: [],
    tags: []
  },
  {
    id: "word-2",
    bookId: "book",
    unitId: "unit",
    word: "bread",
    displayText: "bread",
    chineseMeaning: "面包",
    examples: [],
    tags: []
  }
];

describe("review engine", () => {
  test("schedules the next review based on mastery and outcome", () => {
    const progress: WordLearningProgress = {
      wordId: "word-1",
      masteryLevel: 3,
      correctCount: 2,
      wrongCount: 0,
      streak: 2,
      favorite: false,
      difficult: false
    };

    const correct = scheduleNextReview(progress, "correct", new Date("2026-06-22T00:00:00.000Z"));
    const wrong = scheduleNextReview(progress, "wrong", new Date("2026-06-22T00:00:00.000Z"));

    assert.equal(correct.nextReview, "2026-06-29T00:00:00.000Z");
    assert.equal(wrong.nextReview, "2026-06-23T00:00:00.000Z");
  });

  test("builds due review queues and daily lists", () => {
    const progressByWordId = {
      "word-1": {
        wordId: "word-1",
        masteryLevel: 2,
        correctCount: 1,
        wrongCount: 0,
        streak: 1,
        favorite: false,
        difficult: false,
        nextReview: "2026-06-20T00:00:00.000Z"
      },
      "word-2": {
        wordId: "word-2",
        masteryLevel: 4,
        correctCount: 4,
        wrongCount: 0,
        streak: 4,
        favorite: false,
        difficult: false,
        nextReview: "2026-06-25T00:00:00.000Z"
      }
    };

    const dueWords = getDueWords(progressByWordId, new Date("2026-06-22T00:00:00.000Z"));
    const reviewQueue = buildReviewQueue(words, progressByWordId, new Date("2026-06-22T00:00:00.000Z"));
    const dailyList = getDailyReviewList(words, progressByWordId, new Date("2026-06-22T00:00:00.000Z"), 1);

    assert.deepEqual(dueWords.map((entry) => entry.wordId), ["word-1"]);
    assert.deepEqual(reviewQueue.map((entry) => entry.id), ["word-1"]);
    assert.deepEqual(dailyList.map((entry) => entry.id), ["word-1"]);
  });
});
