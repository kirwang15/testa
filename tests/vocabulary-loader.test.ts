import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  getAllBooks,
  getAllUnits,
  getAllWords,
  getBookById,
  getBookProgress,
  getLevelsForUnit,
  getUnitById,
  getUnitProgress,
  getUnitsForBook,
  getUnitWords,
  getWordById,
  normalizeVocabularySources,
  validateVocabularySources
} from "../src/lib/vocabulary-loader";
import { createEmptyLevelProgress } from "../src/lib/game-engine";
import type { VocabularyImportBook } from "../types/game";

describe("vocabulary loader", () => {
  test("loads the four normalized 1997 curriculum books", () => {
    const books = getAllBooks();
    const units = getAllUnits();
    const words = getAllWords();
    const book = getBookById("nce-1997-b1");
    const bookUnits = getUnitsForBook("nce-1997-b1");
    const unit = getUnitById("nce-1997-b1", "nce-1997-b1-u1");
    const unitWords = getUnitWords("nce-1997-b1", "nce-1997-b1-u1");
    const word = unitWords[0];

    assert.equal(books.length, 4);
    assert.equal(units.length, 20);
    assert.equal(words.length, 800);
    assert.equal(book?.title, "New Concept English Book 1");
    assert.equal(book?.level, "A1");
    assert.equal(book?.colorTheme, "mint");
    assert.equal(book?.estimatedWordCount, 200);
    assert.equal(bookUnits.length, 5);
    assert.equal(unit?.title.startsWith("Trail 1:"), true);
    assert.equal(unit?.difficulty, "A1");
    assert.equal(unit?.estimatedMinutes, 30);
    assert.equal(unitWords[0]?.displayText, unitWords[0]?.word);
    assert.equal(Boolean(word?.englishMeaning), true);
    assert.equal(Boolean(word?.chineseMeaning), true);
    assert.equal(word?.source?.edition, "1997");
    assert.equal(unitWords.length > 0, true);
  });

  test("derives book and unit progress from completed levels", () => {
    const unitLevels = getLevelsForUnit("nce-1997-b1", "nce-1997-b1-u1");
    const firstLevel = unitLevels[0];
    assert.ok(firstLevel, "Expected nce-1-u1 to have a generated level");

    const progress = {
      [firstLevel.id]: {
        ...createEmptyLevelProgress(),
        foundWords: firstLevel.targetWords.map((word) => word.id),
        completed: true
      }
    };
    const firstVocabularyWordId = firstLevel.targetWords[0]?.vocabularyWordId;
    assert.ok(firstVocabularyWordId);
    const wordProgress = {
      [firstVocabularyWordId]: {
        wordId: firstVocabularyWordId,
        masteryLevel: 4,
        correctCount: 2,
        wrongCount: 0,
        streak: 2,
        favorite: true,
        difficult: false
      }
    };
    const bookProgress = getBookProgress("nce-1997-b1", progress, wordProgress);
    const unitProgress = getUnitProgress("nce-1997-b1-u1", progress, wordProgress);

    assert.equal(bookProgress.totalUnits, 5);
    assert.equal(bookProgress.completedLevels, 1);
    assert.equal(bookProgress.masteredWords, 1);
    assert.equal(unitProgress.completedLevels, 1);
    assert.equal(unitProgress.totalLevels, 10);
    assert.equal(unitProgress.learnedWords, 1);
  });

  test("keeps wrong-only words out of book and unit learned metrics", () => {
    const wordId = getUnitWords("nce-1997-b1", "nce-1997-b1-u1")[0]?.id;
    assert.ok(wordId);
    const wrongOnly = {
      [wordId]: {
        wordId,
        masteryLevel: 0,
        correctCount: 0,
        wrongCount: 2,
        streak: 0,
        favorite: false,
        difficult: true,
        reviewReasons: ["wrong" as const]
      }
    };

    const bookProgress = getBookProgress("nce-1997-b1", {}, wrongOnly);
    const unitProgress = getUnitProgress("nce-1997-b1-u1", {}, wrongOnly);

    assert.equal(bookProgress.learnedWords, 0);
    assert.equal(unitProgress.learnedWords, 0);
    assert.equal(bookProgress.difficultWords, 1);
    assert.equal(unitProgress.difficultWords, 1);
  });

  test("generates level clues from vocabulary meanings when available", () => {
    const levels = getLevelsForUnit("nce-1", "nce-1-u2");
    const fishWord = levels
      .flatMap((level) => level.targetWords)
      .find((word) => word.word === "FISH");
    const fanWord = levels
      .flatMap((level) => level.targetWords)
      .find((word) => word.word === "FAN");
    const bookWord = levels[0]?.targetWords.find((word) => word.word === "BOOK");

    assert.deepEqual(
      levels.map((level) => level.id),
      [
        "legacy:nce-1-u2-level-1",
        "legacy:nce-1-u2-level-2",
        "legacy:nce-1-u2-level-3"
      ]
    );
    assert.equal(fishWord?.clue, "an animal that lives in water");
    assert.equal(fishWord?.vocabularyWordId, "legacy:nce-1-u2-fish");
    assert.equal(fishWord?.englishMeaning, "an animal that lives in water");
    assert.equal(fishWord?.chineseMeaning, "鱼");
    assert.equal(fanWord?.clue, "a device that moves air");
    assert.equal(bookWord?.clue, "a set of written or printed pages");
  });

  test("falls back from legacy meaning when englishMeaning is missing", () => {
    const normalizedData = normalizeVocabularySources([
      {
        id: "legacy-book",
        title: "Legacy Book",
        subtitle: "Legacy",
        level: "A1",
        units: [
          {
            id: "legacy-unit",
            title: "Legacy Unit",
            difficulty: "A1",
            words: [
              {
                id: "legacy-word",
                word: "ticket",
                meaning: "a paper pass for travel or entry",
                chineseMeaning: "票",
                source: {
                  book: 1,
                  lesson: 7,
                  edition: "1997",
                  verification: "double-source",
                  provenanceId: "legacy-test"
                }
              }
            ]
          }
        ]
      }
    ] satisfies VocabularyImportBook[]);

    assert.equal(normalizedData.words[0]?.englishMeaning, "a paper pass for travel or entry");
    assert.equal(normalizedData.words[0]?.chineseMeaning, "票");
    assert.deepEqual(normalizedData.words[0]?.source, {
      book: 1,
      lesson: 7,
      edition: "1997",
      verification: "double-source",
      provenanceId: "legacy-test"
    });
  });

  test("reports duplicate ids and skips invalid or empty units safely", () => {
    const issues = validateVocabularySources([
      {
        id: "demo",
        title: "Demo Book",
        subtitle: "Demo",
        level: "A1",
        units: [
          {
            id: "unit-a",
            title: "Unit A",
            difficulty: "A1",
            estimatedMinutes: 10,
            words: [
              { id: "unit-a-alpha", word: "alpha" },
              { id: "unit-a-empty", word: " " }
            ]
          },
          {
            id: "unit-a",
            title: "Duplicate Unit",
            difficulty: "A1",
            estimatedMinutes: 10,
            words: [{ id: "unit-a-beta", word: "beta" }]
          },
          {
            id: "unit-b",
            title: "Empty Unit",
            difficulty: "A1",
            estimatedMinutes: 10,
            words: [{ id: "unit-b-empty", word: "   " }]
          }
        ]
      },
      {
        id: "demo",
        title: "Demo Book Copy",
        subtitle: "Demo",
        level: "A1",
        units: []
      }
    ] satisfies VocabularyImportBook[]);

    assert.equal(
      issues.some((issue) => issue.type === "duplicate-book-id"),
      true
    );
    assert.equal(
      issues.some((issue) => issue.type === "duplicate-unit-id"),
      true
    );
    assert.equal(
      issues.some((issue) => issue.type === "invalid-word"),
      true
    );
    assert.equal(
      issues.some((issue) => issue.type === "empty-unit"),
      true
    );
  });
});
