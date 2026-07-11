import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createEmptyLevelProgress } from "../src/lib/game-engine";
import {
  buildLevelPresentation,
  buildSafeVocabularyPreviews,
  findUnsolvedAnswerCollisions,
  getWordCardPresentation,
  isVocabularyAnswerSafeToDisplay,
  sanitizePresentationTextForAnswers
} from "../lib/word-card-presentation";
import type { Level, TargetWord } from "../types/game";

const targetWord: TargetWord = {
  id: "cat",
  word: "CAT",
  clue: "a small animal",
  start: { row: 0, col: 0 },
  direction: "across",
  vocabularyWordId: "v-cat"
};

const level: Level = {
  id: "presentation-level",
  bookId: "book",
  unitId: "unit",
  title: "Presentation",
  letters: ["C", "A", "T"],
  targetWords: [targetWord],
  grid: { rows: 1, cols: 3 },
  rewardCoins: 20
};

describe("word card presentation", () => {
  test("sanitizes an arbitrary cross-page prompt against unresolved spellings", () => {
    assert.equal(
      sanitizePresentationTextForAnswers("A cat and a car", ["CAT"]),
      "A ••• and a car"
    );
  });

  test("keeps an unsolved target out of visible text and action labels", () => {
    const presentation = getWordCardPresentation(
      level,
      targetWord,
      createEmptyLevelProgress(),
      false
    );

    assert.equal(presentation.wordText, undefined);
    assert.deepEqual(presentation.letterTexts, ["_", "_", "_"]);
    assert.equal(presentation.favoriteActionLabel, undefined);
  });

  test("reveals the target after it is solved", () => {
    const presentation = getWordCardPresentation(
      level,
      targetWord,
      {
        ...createEmptyLevelProgress(),
        foundWords: [targetWord.id]
      },
      true
    );

    assert.equal(presentation.wordText, "CAT");
    assert.deepEqual(presentation.letterTexts, ["C", "A", "T"]);
    assert.equal(presentation.favoriteActionLabel, "Remove saved word");
  });

  test("removes every unsolved answer collision from the whole level presentation", () => {
    const collisionLevel: Level = {
      ...level,
      letters: ["U", "S", "E", "T", "O", "R", "Y", "N", "V", "L", "W", "D"],
      grid: { rows: 4, cols: 5 },
      targetWords: [
        { ...targetWord, id: "use", word: "USE", clue: "put into action", start: { row: 0, col: 0 } },
        { ...targetWord, id: "story", word: "STORY", clue: "a tale", start: { row: 1, col: 0 } },
        {
          ...targetWord,
          id: "novel",
          word: "NOVEL",
          clue: "a long story in book form",
          englishMeaning: "a long story in book form",
          start: { row: 2, col: 0 }
        },
        { ...targetWord, id: "word", word: "WORD", clue: "a unit of language", start: { row: 3, col: 0 } }
      ]
    };
    const presentation = buildLevelPresentation(
      collisionLevel,
      createEmptyLevelProgress(),
      ["Use a free hint", "Save word"]
    );
    const visibleAndAccessibleTexts = [
      ...presentation.uiTexts,
      ...presentation.cards.flatMap((card) => [
        card.wordText,
        card.englishMeaning,
        card.chineseMeaning,
        card.favoriteActionLabel,
        ...card.letterTexts
      ])
    ].filter((text): text is string => Boolean(text));

    assert.deepEqual(
      findUnsolvedAnswerCollisions(
        collisionLevel,
        createEmptyLevelProgress(),
        visibleAndAccessibleTexts
      ),
      []
    );
    assert.equal(presentation.cards.every((card) => card.favoriteActionLabel === undefined), true);
    assert.equal(presentation.uiTexts[0]?.includes("Use"), false);
    assert.equal(presentation.cards[2]?.englishMeaning?.includes("story"), false);
  });

  test("keeps home word lists from revealing an answer until that target is solved", () => {
    const levels = [level];

    assert.equal(
      isVocabularyAnswerSafeToDisplay("v-cat", levels, {}),
      false
    );
    assert.equal(
      isVocabularyAnswerSafeToDisplay("v-cat", levels, {
        [level.id]: {
          ...createEmptyLevelProgress(),
          foundWords: [targetWord.id]
        }
      }),
      true
    );
    assert.equal(
      isVocabularyAnswerSafeToDisplay("v-unrelated", levels, {}),
      true
    );
  });

  test("keeps a repeated spelling hidden until every instance with that spelling is solved", () => {
    const repeatedLevel: Level = {
      ...level,
      id: "repeated-cat-level",
      targetWords: [
        {
          ...targetWord,
          id: "another-cat",
          vocabularyWordId: "v-another-cat"
        }
      ]
    };

    assert.equal(
      isVocabularyAnswerSafeToDisplay("v-cat", [level, repeatedLevel], {
        [level.id]: {
          ...createEmptyLevelProgress(),
          foundWords: [targetWord.id]
        }
      }),
      false
    );
    assert.equal(
      isVocabularyAnswerSafeToDisplay("v-cat", [level, repeatedLevel], {
        [level.id]: {
          ...createEmptyLevelProgress(),
          foundWords: [targetWord.id]
        },
        [repeatedLevel.id]: {
          ...createEmptyLevelProgress(),
          foundWords: ["another-cat"]
        }
      }),
      true
    );
  });

  test("builds answer-safe unit previews without headwords or aria labels", () => {
    const previews = buildSafeVocabularyPreviews(
      [{
        id: "v-cat",
        bookId: "book",
        unitId: "unit",
        word: "CAT",
        displayText: "CAT",
        englishMeaning: "a cat kept as a pet",
        examples: [],
        tags: []
      }],
      [level],
      {}
    );

    assert.equal(previews[0]?.safe, false);
    assert.equal(previews[0]?.title, "Locked clue 1");
    assert.equal(previews[0]?.wordLabel, undefined);
    assert.equal(previews[0]?.englishMeaning?.includes("CAT"), false);
  });
});
