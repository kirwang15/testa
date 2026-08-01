import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  canAccessBook,
  canAccessLevel,
  canAccessRating,
  canAccessReviewProgress,
  getDefaultContentAccessLevel,
  getEligibleBookStatus,
  getEligibleLevelStatus,
  getNextEligibleLevel,
  getRecommendedEligibleLevel,
  partitionReviewWordsByAccess
} from "../lib/content-access";
import { createDefaultPlayerProfile, normalizePlayerProfile } from "../lib/profile-state";
import { createEmptyLevelProgress } from "../src/lib/game-engine";
import { createEmptyWordLearningProgress } from "../src/lib/learning-engine";
import { curriculumContentVersion } from "../lib/curriculum-index";
import type {
  CurriculumLevelIndex,
  RuntimeVocabularyWord
} from "../types/game";

const levels: CurriculumLevelIndex[] = [
  {
    id: "all-one",
    bookId: "nce-1997-b1",
    unitId: "unit",
    wordCount: 1,
    releaseStatus: "automated-beta",
    rating: "all-ages"
  },
  {
    id: "teen-one",
    bookId: "nce-1997-b1",
    unitId: "unit",
    wordCount: 1,
    releaseStatus: "automated-beta",
    rating: "13-plus"
  },
  {
    id: "parent-one",
    bookId: "nce-1997-b1",
    unitId: "unit",
    wordCount: 1,
    releaseStatus: "automated-beta",
    rating: "parent-review"
  },
  {
    id: "all-two",
    bookId: "nce-1997-b1",
    unitId: "unit",
    wordCount: 1,
    releaseStatus: "automated-beta",
    rating: "all-ages"
  },
  {
    id: "book-two",
    bookId: "nce-1997-b2",
    unitId: "unit-two",
    wordCount: 1,
    releaseStatus: "automated-beta",
    rating: "all-ages"
  }
];

function runtimeWord(id: string, rating: RuntimeVocabularyWord["rating"]): RuntimeVocabularyWord {
  return {
    id,
    bookId: "nce-1997-b1",
    unitId: "unit",
    word: id,
    displayText: id,
    examples: [`Use ${id} here.`],
    tags: [],
    rating
  };
}

describe("central content eligibility", () => {
  test("defaults younger profiles to all-ages and teens to 13-plus", () => {
    assert.equal(getDefaultContentAccessLevel("7-9"), "all-ages");
    assert.equal(getDefaultContentAccessLevel("10-12"), "all-ages");
    assert.equal(getDefaultContentAccessLevel("13-15"), "13-plus");
    assert.equal(createDefaultPlayerProfile({ ageBand: "7-9" }).contentAccessLevel, "all-ages");
    assert.equal(createDefaultPlayerProfile({ ageBand: "13-15" }).contentAccessLevel, "13-plus");
  });

  test("requires an explicit persisted parent override for parent-review", () => {
    const rejected = normalizePlayerProfile({
      id: "child",
      ageBand: "7-9",
      contentAccessLevel: "parent-review"
    });
    assert.equal(rejected.contentAccessLevel, "all-ages");
    assert.equal(rejected.contentAccessOverride, false);

    const accepted = normalizePlayerProfile({
      id: "child",
      ageBand: "7-9",
      contentAccessLevel: "parent-review",
      contentAccessOverride: true
    });
    assert.equal(accepted.contentAccessLevel, "parent-review");
    assert.equal(accepted.contentAccessOverride, true);
  });

  test("uses one policy for recommendation, next navigation and deep-link checks", () => {
    const child = createDefaultPlayerProfile({ ageBand: "10-12" });
    const teen = createDefaultPlayerProfile({ ageBand: "13-15" });
    const parent = createDefaultPlayerProfile({
      ageBand: "10-12",
      contentAccessLevel: "parent-review",
      contentAccessOverride: true
    });
    const progress = { "all-one": { ...createEmptyLevelProgress(), completed: true } };

    assert.equal(canAccessRating(child.contentAccessLevel, "13-plus"), false);
    assert.equal(canAccessLevel(child, levels[1]), false);
    assert.equal(getRecommendedEligibleLevel(levels, progress, child)?.id, "all-two");
    assert.equal(getRecommendedEligibleLevel(levels, progress, teen)?.id, "teen-one");
    assert.equal(getNextEligibleLevel(levels, "all-one", child)?.id, "all-two");
    assert.equal(getNextEligibleLevel(levels, "teen-one", teen)?.id, "all-two");
    assert.equal(getNextEligibleLevel(levels, "teen-one", parent)?.id, "parent-one");
  });

  test("keeps age-book scope independent from the parent rating override", () => {
    const youngOverride = createDefaultPlayerProfile({
      ageBand: "7-9",
      contentAccessLevel: "parent-review",
      contentAccessOverride: true
    });
    const olderChild = createDefaultPlayerProfile({ ageBand: "10-12" });
    const teen = createDefaultPlayerProfile({ ageBand: "13-15" });
    const bookThreeLevel: CurriculumLevelIndex = {
      ...levels[0],
      id: "book-three",
      bookId: "nce-1997-b3",
      rating: "all-ages"
    };

    assert.equal(canAccessBook(youngOverride, "nce-1997-b1"), true);
    assert.equal(canAccessBook(youngOverride, "nce-1997-b2"), false);
    assert.equal(canAccessBook(olderChild, "nce-1997-b2"), true);
    assert.equal(canAccessBook(olderChild, "nce-1997-b3"), false);
    assert.equal(canAccessLevel(youngOverride, bookThreeLevel), false);
    assert.equal(canAccessLevel(teen, bookThreeLevel), true);
  });

  test("never marks an age-locked book as recommended", () => {
    const young = createDefaultPlayerProfile({ ageBand: "7-9" });
    const older = createDefaultPlayerProfile({ ageBand: "10-12" });
    const completedBookOne = Object.fromEntries(
      levels
        .filter((level) => level.bookId === "nce-1997-b1")
        .map((level) => [level.id, { ...createEmptyLevelProgress(), completed: true }])
    );
    assert.equal(
      getEligibleLevelStatus(levels, "book-two", completedBookOne, young),
      "available"
    );
    assert.equal(
      getEligibleBookStatus(levels, "nce-1997-b2", completedBookOne, young),
      "available"
    );
    assert.equal(
      getEligibleLevelStatus(levels, "book-two", completedBookOne, older),
      "recommended"
    );
  });

  test("fails closed when a due record lacks captured rating metadata", () => {
    const child = createDefaultPlayerProfile({ ageBand: "7-9" });
    const old = createEmptyWordLearningProgress("nce-1997-b1-old");
    const safe = {
      ...old,
      sourceBook: 1 as const,
      contentRating: "all-ages" as const,
      contentVersion: curriculumContentVersion
    };
    assert.equal(canAccessReviewProgress(child, old), false);
    assert.equal(canAccessReviewProgress(child, safe), true);
    assert.equal(
      canAccessReviewProgress(child, { ...safe, contentVersion: "previous-release" }),
      true
    );
  });

  test("partitions due runtime words before restricted clues can be rendered", () => {
    const entries = [
      { progress: createEmptyWordLearningProgress("safe"), word: runtimeWord("safe", "all-ages") },
      { progress: createEmptyWordLearningProgress("teen"), word: runtimeWord("teen", "13-plus") },
      { progress: createEmptyWordLearningProgress("parent"), word: runtimeWord("parent", "parent-review") }
    ];
    const childProfile = createDefaultPlayerProfile({ ageBand: "7-9" });
    const teenProfile = createDefaultPlayerProfile({ ageBand: "13-15" });
    const child = partitionReviewWordsByAccess(entries, childProfile);
    assert.deepEqual(child.available.map(({ word }) => word.id), ["safe"]);
    assert.deepEqual(child.restricted.map(({ word }) => word.id), ["teen", "parent"]);

    const teen = partitionReviewWordsByAccess(entries, teenProfile);
    assert.deepEqual(teen.available.map(({ word }) => word.id), ["safe", "teen"]);
    assert.deepEqual(teen.restricted.map(({ word }) => word.id), ["parent"]);
  });
});
