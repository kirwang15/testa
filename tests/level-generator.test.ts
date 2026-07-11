import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getUnitById, resolveLevelsForUnit } from "../lib/levelLoader";
import {
  createLetterPool,
  generateLevelFromWords,
  generateLevelsFromBook,
  generateLevelsFromUnit,
  generateLevelsFromVocabularySet,
  normalizeWord
} from "../src/lib/level-generator";
import type { VocabularyBook, VocabularyUnit, VocabularyWord } from "../types/game";

function createTestWord(
  id: string,
  word: string,
  overrides: Partial<VocabularyWord> = {}
): VocabularyWord {
  return {
    id,
    bookId: overrides.bookId ?? "test-book",
    unitId: overrides.unitId ?? "test-unit",
    word,
    displayText: overrides.displayText ?? word,
    englishMeaning: overrides.englishMeaning,
    chineseMeaning: overrides.chineseMeaning,
    phonetic: overrides.phonetic,
    partOfSpeech: overrides.partOfSpeech,
    difficulty: overrides.difficulty,
    cefrLevel: overrides.cefrLevel ?? "A1",
    frequencyRank: overrides.frequencyRank,
    examples: overrides.examples ?? [],
    tags: overrides.tags ?? [],
    learningConcept: overrides.learningConcept
  };
}

describe("level generator", () => {
  test("normalizes alphabetic words and rejects invalid entries", () => {
    assert.equal(normalizeWord(" excuse "), "EXCUSE");
    assert.equal(normalizeWord("ice-cream"), "");
    assert.equal(normalizeWord("book 2"), "");
  });

  test("creates a letter pool with only the duplicates needed for playability", () => {
    assert.deepEqual(createLetterPool(["APPLE", "PEAL"]), ["A", "E", "L", "P", "P"]);
  });

  test("builds a playable level from valid words only", () => {
    const level = generateLevelFromWords([
      createTestWord("a", "a"),
      createTestWord("ant", "ant", {
        englishMeaning: "a very small insect",
        chineseMeaning: "蚂蚁"
      }),
      createTestWord("ant-2", "ant"),
      createTestWord("oar", "oar"),
      createTestWord("ice-cream", "ice-cream"),
      createTestWord("ring", "ring", { difficulty: 2 })
    ]);

    assert.ok(level, "Expected a generated level");
    assert.deepEqual(
      level.targetWords.map((word) => word.word),
      ["ANT", "OAR", "RING"]
    );
    assert.equal(level.targetWords[0]?.clue, "a very small insect");
    assert.equal(level.targetWords[0]?.vocabularyWordId, "ant");
    assert.equal(level.targetWords[0]?.englishMeaning, "a very small insect");
    assert.equal(level.targetWords[0]?.chineseMeaning, "蚂蚁");
    assert.equal(level.grid.rows, 3);
    assert.equal(level.grid.cols, 4);
    assert.equal(level.difficulty, "medium");
  });

  test("falls back to a practice clue when no meanings are available", () => {
    const level = generateLevelFromWords([
      createTestWord("ant", "ant"),
      createTestWord("oar", "oar"),
      createTestWord("ring", "ring")
    ]);

    assert.ok(level, "Expected a generated level");
    assert.equal(level.targetWords[0]?.clue, "Practice word: ant");
    assert.equal(level.targetWords[0]?.englishMeaning, undefined);
    assert.equal(level.targetWords[0]?.chineseMeaning, undefined);
  });

  test("returns no generated level when there are too few valid words", () => {
    const level = generateLevelFromWords([
      createTestWord("at", "at"),
      createTestWord("go", "go!")
    ]);

    assert.equal(level, undefined);
  });

  test("splits unit words into deterministic level groups", () => {
    const unit: VocabularyUnit = {
      id: "generated-unit",
      bookId: "generated-book",
      title: "Generated Unit",
      lessonRange: "Lessons 1-3",
      difficulty: "B1",
      estimatedMinutes: 18,
      wordIds: [
        "apple",
        "bread",
        "chair",
        "dream",
        "earth",
        "flower",
        "garden"
      ]
    };
    const words = [
      createTestWord("apple", "apple", { bookId: unit.bookId, unitId: unit.id }),
      createTestWord("bread", "bread", { bookId: unit.bookId, unitId: unit.id }),
      createTestWord("chair", "chair", { bookId: unit.bookId, unitId: unit.id }),
      createTestWord("dream", "dream", { bookId: unit.bookId, unitId: unit.id, difficulty: 2 }),
      createTestWord("earth", "earth", { bookId: unit.bookId, unitId: unit.id, difficulty: 2 }),
      createTestWord("flower", "flower", { bookId: unit.bookId, unitId: unit.id, difficulty: 2 }),
      createTestWord("garden", "garden", { bookId: unit.bookId, unitId: unit.id, difficulty: 2 })
    ];

    const firstPass = generateLevelsFromUnit(unit, { words });
    const secondPass = generateLevelsFromUnit(unit, { words });

    assert.equal(firstPass.length, 2);
    assert.deepEqual(
      firstPass.map((level) => level.id),
      ["generated-unit-level-1", "generated-unit-level-2"]
    );
    assert.deepEqual(firstPass, secondPass);
    assert.deepEqual(
      firstPass.map((level) => level.targetWords.length),
      [4, 3]
    );
  });

  test("learning mode spaces repeated meanings and concepts while review mode can repeat them", () => {
    const words = [
      createTestWord("ticket", "ticket", {
        chineseMeaning: "票",
        learningConcept: "transportation_ticket"
      }),
      createTestWord("pass", "pass", {
        chineseMeaning: "票",
        learningConcept: "transportation_ticket"
      }),
      createTestWord("voucher", "voucher", {
        chineseMeaning: "票券",
        learningConcept: "transportation_ticket"
      }),
      createTestWord("station", "station", { chineseMeaning: "车站" }),
      createTestWord("travel", "travel", { chineseMeaning: "旅行" }),
      createTestWord("window", "window", { chineseMeaning: "窗户" }),
      createTestWord("bridge", "bridge", { chineseMeaning: "桥" }),
      createTestWord("garden", "garden", { chineseMeaning: "花园" }),
      createTestWord("rocket", "rocket", { chineseMeaning: "火箭" })
    ];

    const learningLevels = generateLevelsFromVocabularySet(words, {
      mode: "learning",
      idPrefix: "learn"
    });
    const reviewLevels = generateLevelsFromVocabularySet(words, {
      mode: "review",
      idPrefix: "review"
    });

    assert.equal(learningLevels.length > 0, true);
    assert.equal(reviewLevels.length > 0, true);
    assert.equal(
      learningLevels.flatMap((level) => level.targetWords).filter((word) => word.word === "PASS").length,
      0
    );
    assert.equal(
      reviewLevels.flatMap((level) => level.targetWords).some((word) => word.word === "PASS"),
      true
    );
  });

  test("generates book levels by combining unit outputs in order", () => {
    const book: VocabularyBook = {
      id: "test-book",
      title: "Test Book",
      subtitle: "Test",
      description: "Test",
      level: "A2",
      estimatedWordCount: 8,
      colorTheme: "mint",
      unitIds: ["u1", "u2"]
    };
    const units: VocabularyUnit[] = [
      {
        id: "u1",
        bookId: book.id,
        title: "Unit 1",
        difficulty: "A2",
        estimatedMinutes: 10,
        wordIds: ["u1-1", "u1-2", "u1-3"]
      },
      {
        id: "u2",
        bookId: book.id,
        title: "Unit 2",
        difficulty: "A2",
        estimatedMinutes: 10,
        wordIds: ["u2-1", "u2-2", "u2-3"]
      }
    ];
    const wordsByUnit: Record<string, VocabularyWord[]> = {
      u1: [
        createTestWord("u1-1", "apple", { bookId: book.id, unitId: "u1" }),
        createTestWord("u1-2", "bread", { bookId: book.id, unitId: "u1" }),
        createTestWord("u1-3", "chair", { bookId: book.id, unitId: "u1" })
      ],
      u2: [
        createTestWord("u2-1", "dream", { bookId: book.id, unitId: "u2" }),
        createTestWord("u2-2", "earth", { bookId: book.id, unitId: "u2" }),
        createTestWord("u2-3", "flame", { bookId: book.id, unitId: "u2" })
      ]
    };

    const levels = generateLevelsFromBook(book, {
      units,
      getWordsForUnit: (unit) => wordsByUnit[unit.id] ?? []
    });

    assert.deepEqual(
      levels.map((level) => level.unitId),
      ["u1", "u2"]
    );
  });

  test("loader resolves registered units from generated vocabulary levels", () => {
    const registeredUnit = getUnitById("nce-1-u1");
    assert.ok(registeredUnit, "Expected registered unit to exist");

    const generatedUnitLevels = resolveLevelsForUnit(registeredUnit);
    assert.deepEqual(
      generatedUnitLevels.map((level) => level.id),
      ["nce-1-u1-level-1", "nce-1-u1-level-2", "nce-1-u1-level-3"]
    );
    assert.equal(generatedUnitLevels[0]?.targetWords[0]?.vocabularyWordId, "nce-1-u1-cat");

    const generatedLevels = resolveLevelsForUnit(
      {
        id: "fallback-unit",
        bookId: "fallback-book",
        title: "Fallback Unit",
        lessonRange: "Lessons 1-2",
        difficulty: "A2",
        estimatedMinutes: 10,
        wordIds: ["stone", "paper", "pencil", "garden"]
      },
      {
        words: [
          createTestWord("stone", "stone", { bookId: "fallback-book", unitId: "fallback-unit" }),
          createTestWord("paper", "paper", { bookId: "fallback-book", unitId: "fallback-unit" }),
          createTestWord("pencil", "pencil", { bookId: "fallback-book", unitId: "fallback-unit" }),
          createTestWord("garden", "garden", { bookId: "fallback-book", unitId: "fallback-unit" })
        ]
      }
    );

    assert.equal(generatedLevels.length, 1);
    assert.equal(generatedLevels[0]?.id, "fallback-unit-level-1");
  });
});
