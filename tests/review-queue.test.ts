import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DUE_REVIEW_LIMIT_BY_AGE,
  getDueReviewCandidates,
  getDueReviewSnapshot,
  getLocalReviewDateKey,
  getRestrictedDueReviewCount,
  getReviewRuntimeStatus,
  loadReviewWordsUntilLimit,
  partitionLoadedReviewWords
} from "../lib/review-queue";
import type {
  ContentRating,
  ReviewMetadataIndex,
  RuntimeVocabularyWord,
  WordLearningProgress
} from "../types/game";
import { createDefaultPlayerProfile } from "../lib/profile-state";
import { curriculumContentVersion } from "../lib/curriculum-index";
import { createReviewWordKey } from "../src/lib/review-metadata-key";

function dueProgress(wordId: string, index: number): WordLearningProgress {
  return {
    wordId,
    sourceBook: 1,
    contentRating: "all-ages",
    contentVersion: curriculumContentVersion,
    masteryLevel: 1,
    correctCount: 0,
    wrongCount: 1,
    streak: 0,
    favorite: false,
    difficult: true,
    reviewReasons: ["wrong"],
    nextReview: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString()
  };
}

function runtimeWord(id: string): RuntimeVocabularyWord {
  return {
    id,
    bookId: "nce-1997-b1",
    unitId: "nce-1997-b1-u1",
    word: id.toUpperCase(),
    displayText: id.toUpperCase(),
    examples: [],
    tags: [],
    rating: "all-ages"
  };
}

function metadataIndex(
  entries: Array<readonly [string, 1 | 2 | 3 | 4, ContentRating]>
): ReviewMetadataIndex {
  return {
    contentVersion: curriculumContentVersion,
    entries: Object.fromEntries(
      entries.map(([id, book, rating]) => [createReviewWordKey(id), [book, rating]])
    )
  };
}

describe("due review queue safeguards", () => {
  test("caps the stable due queue by age band at 5, 8, and 12", () => {
    const records = Object.fromEntries(
      Array.from({ length: 15 }, (_, index) => {
        const id = `word-${String(index).padStart(2, "0")}`;
        return [id, dueProgress(id, index)];
      })
    );
    const now = new Date("2026-07-18T00:00:00.000Z");
    const metadata = metadataIndex(
      Object.keys(records).map((id) => [id, 1, "all-ages"] as const)
    );

    for (const ageBand of ["7-9", "10-12", "13-15"] as const) {
      const profile = createDefaultPlayerProfile({ ageBand });
      const due = getDueReviewCandidates(records, profile, metadata, now);
      assert.equal(due.length, DUE_REVIEW_LIMIT_BY_AGE[ageBand]);
      assert.deepEqual(
        due.map((item) => item.wordId),
        Object.keys(records).slice(0, DUE_REVIEW_LIMIT_BY_AGE[ageBand])
      );
    }
  });

  test("filters inaccessible due words before applying the age cap", () => {
    const profile = createDefaultPlayerProfile({ ageBand: "7-9" });
    const records = Object.fromEntries([
      ...Array.from({ length: 6 }, (_, index) => {
        const id = `nce-1997-b2-restricted-${index}`;
        return [
          id,
          {
            ...dueProgress(id, index),
            sourceBook: 2 as const,
            contentRating: "all-ages" as const
          }
        ];
      }),
      ...Array.from({ length: 5 }, (_, index) => {
        const id = `nce-1997-b1-safe-${index}`;
        return [id, dueProgress(id, index + 10)];
      })
    ]);

    const metadata = metadataIndex([
      ...Array.from({ length: 6 }, (_, index) =>
        [`nce-1997-b2-restricted-${index}`, 2, "all-ages"] as const
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        [`nce-1997-b1-safe-${index}`, 1, "all-ages"] as const
      )
    ]);
    const now = new Date("2026-07-18T00:00:00.000Z");
    const due = getDueReviewCandidates(records, profile, metadata, now);
    assert.deepEqual(
      due.map((entry) => entry.wordId),
      Array.from({ length: 5 }, (_, index) => `nce-1997-b1-safe-${index}`)
    );
    assert.equal(
      getRestrictedDueReviewCount(records, profile, metadata, now),
      6
    );
  });

  test("upgrades known Legacy and previous-release records without conflating unknown ids", () => {
    const profile = createDefaultPlayerProfile({ ageBand: "7-9" });
    const legacyId = "legacy:nce-1-u1-cat";
    const previousId = "nce-1997-b1-what";
    const restrictedId = "nce-1997-b2-age-locked";
    const unknownId = "legacy:nce-1-u9-removed";
    const records = Object.fromEntries(
      [legacyId, previousId, restrictedId, unknownId].map((id, index) => [
        id,
        {
          ...dueProgress(id, index),
          sourceBook: undefined,
          contentRating: undefined,
          contentVersion: index === 1 ? "previous-release" : undefined
        }
      ])
    );
    const metadata = metadataIndex([
      [legacyId, 1, "all-ages"],
      [previousId, 1, "all-ages"],
      [restrictedId, 2, "all-ages"]
    ]);

    const snapshot = getDueReviewSnapshot(
      records,
      profile,
      metadata,
      new Date("2026-07-18T00:00:00.000Z")
    );
    assert.deepEqual(
      snapshot.available.map((entry) => entry.wordId),
      [legacyId, previousId]
    );
    assert.equal(snapshot.available[1]?.contentVersion, curriculumContentVersion);
    assert.deepEqual(snapshot.restricted.map((entry) => entry.wordId), [restrictedId]);
    assert.deepEqual(snapshot.recoverable.map((entry) => entry.wordId), [unknownId]);
  });

  test("continues past missing early files until the healthy age-limit is full", async () => {
    const candidates = Array.from({ length: 8 }, (_, index) =>
      dueProgress(`word-${index + 1}`, index)
    );
    const attempted: string[] = [];
    const result = await loadReviewWordsUntilLimit(candidates, 3, async (progress) => {
      attempted.push(progress.wordId);
      return ["word-1", "word-2", "word-3", "word-5"].includes(progress.wordId)
        ? undefined
        : runtimeWord(progress.wordId);
    });

    assert.deepEqual(result.available.map(({ word }) => word.id), [
      "word-4",
      "word-6",
      "word-7"
    ]);
    assert.deepEqual(result.missingWordIds, ["word-1", "word-2", "word-3", "word-5"]);
    assert.deepEqual(attempted, [
      "word-1",
      "word-2",
      "word-3",
      "word-4",
      "word-5",
      "word-6",
      "word-7"
    ]);
  });

  test("quarantines missing runtime words while preserving candidate order", () => {
    const candidates = [
      dueProgress("word-a", 0),
      dueProgress("word-b", 1),
      dueProgress("word-c", 2)
    ];
    const result = partitionLoadedReviewWords(candidates, [
      runtimeWord("word-c"),
      runtimeWord("word-a")
    ]);

    assert.deepEqual(result.available.map(({ word }) => word.id), ["word-a", "word-c"]);
    assert.deepEqual(result.missingWordIds, ["word-b"]);
  });

  test("blocks an all-missing load but keeps a partial session non-blocking", () => {
    const candidates = [dueProgress("word-a", 0), dueProgress("word-b", 1)];
    const allMissing = partitionLoadedReviewWords(candidates, []);
    const partial = partitionLoadedReviewWords(candidates, [runtimeWord("word-a")]);

    assert.deepEqual(allMissing.missingWordIds, ["word-a", "word-b"]);
    assert.equal(getReviewRuntimeStatus(allMissing.available.length, false), "error");
    assert.deepEqual(partial.missingWordIds, ["word-b"]);
    assert.equal(getReviewRuntimeStatus(partial.available.length, false), "ready");
    assert.equal(getReviewRuntimeStatus(0, true), "ready");
  });

  test("uses a local calendar key so midnight changes refresh the due cutoff", () => {
    assert.equal(getLocalReviewDateKey(new Date(2026, 6, 8, 23, 59)), "2026-07-08");
    assert.equal(getLocalReviewDateKey(new Date(2026, 6, 9, 0, 1)), "2026-07-09");
  });
});
