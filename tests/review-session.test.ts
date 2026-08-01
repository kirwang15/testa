import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applyReviewSubmission,
  getReviewReasonSummary
} from "../lib/progress";
import { createInitialGameProgress } from "../lib/progress";
import { markWordCorrect, markWordWrong, setWordDifficult } from "../src/lib/learning-engine";
import { getWordById } from "../src/lib/vocabulary-loader";
import { registerRuntimeVocabularyWord } from "../lib/content-runtime";

const legacyCat = getWordById("nce-1-u1-cat");
assert.ok(legacyCat);
registerRuntimeVocabularyWord(legacyCat);

describe("review session", () => {
  test("keeps the answer hidden in the prompt until a correct spelling", () => {
    const wordId = "nce-1-u1-cat";
    const base = createInitialGameProgress();
    const wrong = markWordWrong(base.words[wordId] ?? {
      wordId,
      masteryLevel: 0,
      correctCount: 0,
      wrongCount: 0,
      streak: 0,
      favorite: false,
      difficult: false
    }, "2026-07-11T00:00:00.000Z");
    const learned = markWordCorrect(wrong, "2026-07-11T00:01:00.000Z");
    const progress = {
      ...base,
      words: { [wordId]: learned }
    };
    const failed = applyReviewSubmission(
      progress,
      wordId,
      "CAR"
    );

    assert.equal(failed.status, "wrong");
    const canonicalWordId = "legacy:nce-1-u1-cat";
    assert.equal(failed.nextProgress.words[canonicalWordId]?.difficult, true);
    const passed = applyReviewSubmission(
      failed.nextProgress,
      wordId,
      "cat"
    );

    assert.equal(passed.status, "correct");
    assert.equal(passed.nextProgress.words[canonicalWordId]?.difficult, false);
    assert.equal(passed.nextProgress.words[canonicalWordId]?.wrongCount, 2);
  });

  test("resolves answers from authoritative content and rejects unknown ids", () => {
    const base = createInitialGameProgress();
    const injected = applyReviewSubmission(base, "nce-1-u1-cat", "DOG");
    const unknown = applyReviewSubmission(base, "unknown-word", "ANYTHING");

    assert.equal(injected.status, "wrong");
    assert.equal(unknown.status, "unknown-word");
    assert.deepEqual(unknown.nextProgress, base);
  });

  test("uses truthful reason labels and never says zero wrong attempts", () => {
    const clueOnly = setWordDifficult({
      wordId: "clue-only",
      masteryLevel: 0,
      correctCount: 1,
      wrongCount: 0,
      streak: 0,
      favorite: false,
      difficult: false,
      reviewReasons: ["clue"]
    });

    assert.equal(getReviewReasonSummary(clueOnly), "Used a clue");
    assert.equal(getReviewReasonSummary({
      ...clueOnly,
      wrongCount: 2,
      reviewReasons: ["wrong", "clue"]
    }), "Needs spelling practice · Used a clue");
  });

  test("counts a due review once and rejects double-submit inflation", () => {
    const wordId = "nce-1-u1-cat";
    const base = createInitialGameProgress();
    const dueProgress = {
      ...base,
      words: {
        [wordId]: {
          ...markWordCorrect(
            {
              wordId,
              masteryLevel: 1,
              correctCount: 0,
              wrongCount: 0,
              streak: 0,
              favorite: false,
              difficult: true,
              reviewReasons: ["clue" as const]
            },
            "2026-07-01T00:00:00.000Z"
          ),
          nextReview: "2026-07-02T00:00:00.000Z"
        }
      }
    };
    const first = applyReviewSubmission(dueProgress, wordId, "cat");
    const second = applyReviewSubmission(first.nextProgress, wordId, "cat");

    assert.equal(first.status, "correct");
    assert.equal(first.nextProgress.studyStats.completedDueReviews, 1);
    assert.equal(second.nextProgress.studyStats.completedDueReviews, 1);
  });
});
