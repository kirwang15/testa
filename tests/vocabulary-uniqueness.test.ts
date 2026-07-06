import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildUniquenessIndex,
  validateVocabularyUniqueness
} from "../src/lib/vocabulary-uniqueness";
import type { VocabularyWord } from "../types/game";

const words: VocabularyWord[] = [
  {
    id: "ticket",
    bookId: "book",
    unitId: "unit-1",
    word: "ticket",
    displayText: "ticket",
    chineseMeaning: "票",
    examples: [],
    tags: [],
    learningConcept: "transportation_ticket"
  },
  {
    id: "pass",
    bookId: "book",
    unitId: "unit-2",
    word: "pass",
    displayText: "pass",
    chineseMeaning: "票",
    examples: [],
    tags: [],
    learningConcept: "transportation_ticket"
  }
];

describe("vocabulary uniqueness", () => {
  test("builds indexes for words, meanings, and concepts", () => {
    const index = buildUniquenessIndex(words);

    assert.deepEqual(index.wordIdsByNormalizedWord.get("ticket"), ["ticket"]);
    assert.deepEqual(index.wordIdsByMeaning.get("票"), ["ticket", "pass"]);
    assert.deepEqual(index.wordIdsByConcept.get("transportation_ticket"), ["ticket", "pass"]);
  });

  test("detects duplicate meanings and concepts", () => {
    const issues = validateVocabularyUniqueness(words);

    assert.equal(
      issues.some((issue) => issue.type === "duplicate-meaning"),
      true
    );
    assert.equal(
      issues.some((issue) => issue.type === "duplicate-concept"),
      true
    );
  });
});
