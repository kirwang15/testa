import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { curriculumContentVersion } from "../lib/curriculum-index";
import {
  loadReviewMetadataIndex,
  resetReviewMetadataForTests,
  resolveReviewWordMetadata,
  validateReviewMetadataIndex
} from "../lib/review-metadata";
import type { ReviewMetadataIndex } from "../types/game";

const generated = JSON.parse(
  readFileSync("public/content/runtime/review-metadata.json", "utf8")
) as ReviewMetadataIndex;

describe("answer-free review metadata", () => {
  test("publishes one collision-free current entry for every runtime word", () => {
    assert.equal(validateReviewMetadataIndex(generated), true);
    assert.equal(generated.contentVersion, curriculumContentVersion);
    assert.equal(Object.keys(generated.entries).length, 899);
    const serialized = JSON.stringify(generated);
    assert.doesNotMatch(serialized, /legacy:nce-|nce-1997-b/);
    assert.deepEqual(resolveReviewWordMetadata("legacy:nce-1-u1-cat", generated), {
      sourceBook: 1,
      contentRating: "all-ages"
    });
    assert.deepEqual(resolveReviewWordMetadata("nce-1997-b1-what", generated), {
      sourceBook: 1,
      contentRating: "all-ages"
    });
    assert.equal(resolveReviewWordMetadata("legacy:nce-1-u9-removed", generated), undefined);
  });

  test("refuses stale metadata instead of re-labelling it as current", async () => {
    const originalFetch = globalThis.fetch;
    try {
      resetReviewMetadataForTests();
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ ...generated, contentVersion: "previous-release" }));
      assert.equal(await loadReviewMetadataIndex(curriculumContentVersion), undefined);
      assert.equal(
        validateReviewMetadataIndex(
          { ...generated, contentVersion: "previous-release" },
          curriculumContentVersion
        ),
        false
      );
    } finally {
      globalThis.fetch = originalFetch;
      resetReviewMetadataForTests();
    }
  });
});
