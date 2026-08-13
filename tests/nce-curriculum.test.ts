import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  addCrosswordDraftLetter,
  createEmptyCrosswordDraft,
  getCrosswordDraftView,
  getDraftCellLetters
} from "../src/lib/crossword-session";
import { createEmptyLevelProgress } from "../src/lib/game-engine";
import {
  analyzeCrosswordLayout,
  createConnectedCrosswordLayout,
  createLayoutRevision,
  generateLevelFromWords,
  type CrosswordLayout
} from "../src/lib/level-generator";
import {
  getAllBooks,
  getAllUnits,
  getAllWords,
  getLevelsForBook,
  getLegacyRegistrySnapshot,
  getLegacyResolvedLevels,
  getCurriculumLevelCacheSize,
  getBookById,
  getResolvedLevels,
  getUnitByGlobalId,
  getWordById,
  resetCurriculumLevelCacheForDiagnostics,
  getUnitsForBook,
  getVocabularyValidationIssues,
  validateVocabularySources
} from "../src/lib/vocabulary-loader";
import {
  contentManifest,
  vocabularySources
} from "../src/content/vocabulary";
import provenanceReport from "../src/content/vocabulary/generated/nce-1997-provenance.json";
import senseAuditReport from "../artifacts/content-audit/nce-sense-candidates.json";
import curriculumIndex from "../src/content/vocabulary/generated/curriculum-index.json";
import {
  EDITORIAL_OVERRIDE_VERSION,
  editorialWordOverrides
} from "../src/content/vocabulary/editorial-overrides";
import type { Level, VocabularyImportBook, VocabularyWord } from "../types/game";
import { getLevelById } from "../lib/levelLoader";

function toLayout(level: ReturnType<typeof getResolvedLevels>[number]): CrosswordLayout {
  return {
    grid: level.grid,
    placements: level.targetWords.map((word, index) => ({
      index,
      word: word.word,
      start: word.start,
      direction: word.direction
    }))
  };
}

function assertLayoutWithIndependentOracle(
  level: ReturnType<typeof getResolvedLevels>[number]
) {
  const occupied = new Map<
    string,
    { letter: string; words: Set<string>; directions: Set<string> }
  >();
  const expectedRuns = new Set<string>();
  const crossingByWord = new Map<string, number>();

  for (const word of level.targetWords) {
    expectedRuns.add(
      `${word.direction}:${word.start.row}:${word.start.col}:${word.word}`
    );
    word.word.split("").forEach((letter, offset) => {
      const row = word.start.row + (word.direction === "down" ? offset : 0);
      const col = word.start.col + (word.direction === "across" ? offset : 0);
      assert.equal(row >= 0 && row < level.grid.rows, true, `${level.id} row`);
      assert.equal(col >= 0 && col < level.grid.cols, true, `${level.id} col`);
      const key = `${row}:${col}`;
      const cell = occupied.get(key);
      if (cell) {
        assert.equal(cell.letter, letter, `${level.id} letter conflict ${key}`);
        assert.equal(
          cell.directions.has(word.direction),
          false,
          `${level.id} same direction ${key}`
        );
        for (const crossedWord of cell.words) {
          crossingByWord.set(crossedWord, (crossingByWord.get(crossedWord) ?? 0) + 1);
          crossingByWord.set(word.id, (crossingByWord.get(word.id) ?? 0) + 1);
        }
        cell.words.add(word.id);
        cell.directions.add(word.direction);
      } else {
        occupied.set(key, {
          letter,
          words: new Set([word.id]),
          directions: new Set([word.direction])
        });
      }
    });
  }

  const adjacentWords = new Map(
    level.targetWords.map((word) => [word.id, new Set<string>()])
  );
  for (const cell of occupied.values()) {
    for (const left of cell.words) {
      for (const right of cell.words) {
        if (left !== right) adjacentWords.get(left)?.add(right);
      }
    }
  }
  const reached = new Set<string>();
  const pending = [level.targetWords[0]?.id].filter(Boolean) as string[];
  while (pending.length > 0) {
    const wordId = pending.pop();
    if (!wordId || reached.has(wordId)) continue;
    reached.add(wordId);
    pending.push(...(adjacentWords.get(wordId) ?? []));
  }
  assert.equal(reached.size, level.targetWords.length, `${level.id} disconnected`);
  for (const word of level.targetWords) {
    assert.equal((crossingByWord.get(word.id) ?? 0) > 0, true, `${word.id} isolated`);
  }

  const actualRuns = new Set<string>();
  for (const key of occupied.keys()) {
    const [row, col] = key.split(":").map(Number);
    if (!occupied.has(`${row}:${col - 1}`) && occupied.has(`${row}:${col + 1}`)) {
      let value = "";
      for (let cursor = col; occupied.has(`${row}:${cursor}`); cursor += 1) {
        value += occupied.get(`${row}:${cursor}`)?.letter;
      }
      actualRuns.add(`across:${row}:${col}:${value}`);
    }
    if (!occupied.has(`${row - 1}:${col}`) && occupied.has(`${row + 1}:${col}`)) {
      let value = "";
      for (let cursor = row; occupied.has(`${cursor}:${col}`); cursor += 1) {
        value += occupied.get(`${cursor}:${col}`)?.letter;
      }
      actualRuns.add(`down:${row}:${col}:${value}`);
    }
  }
  assert.deepEqual([...actualRuns].sort(), [...expectedRuns].sort(), level.id);
}

describe("New Concept English 1997 curriculum", () => {
  test("ships four books, 200 explicit levels, and 800 globally unique spellings", () => {
    const books = getAllBooks();
    const units = getAllUnits();
    const words = getAllWords();
    const levels = getResolvedLevels();
    const spellings = words.map((word) => word.word.toLowerCase());

    assert.equal(books.length, 4);
    assert.equal(units.length, 20);
    assert.equal(levels.length, 200);
    assert.equal(words.length, 800);
    assert.equal(new Set(spellings).size, 800);
    assert.equal(contentManifest.wordCount, 800);
    assert.equal(contentManifest.levelCount, 200);
    assert.equal(
      contentManifest.generatorVersion,
      `crossword-content-v1.1-sense-aligned+${EDITORIAL_OVERRIDE_VERSION}+runtime-content-v3-multi-curriculum`
    );
    assert.equal(contentManifest.clueGenerator?.runtime, "ollama");
    assert.equal(contentManifest.clueGenerator?.model, "gemma4:e4b");
    assert.match(contentManifest.clueGenerator?.modelDigest ?? "", /^sha256:/);
    assert.equal(
      contentManifest.clueGenerator?.script,
      "scripts/refine-nce-clues.cjs"
    );
    assert.equal(contentManifest.exampleGenerator?.runtime, "ollama");
    assert.equal(contentManifest.exampleGenerator?.model, "gemma4:e4b");
    assert.match(contentManifest.exampleGenerator?.modelDigest ?? "", /^sha256:/);
    assert.equal(
      contentManifest.exampleGenerator?.script,
      "scripts/refine-nce-examples.cjs"
    );

    for (const bookNumber of [1, 2, 3, 4] as const) {
      const bookId = `nce-1997-b${bookNumber}`;
      const bookLevels = getLevelsForBook(bookId);
      assert.equal(bookLevels.length, 50);
      assert.deepEqual(
        bookLevels.map((level) => level.targetWords.length),
        [
          ...Array(15).fill(3),
          ...Array(20).fill(4),
          ...Array(15).fill(5)
        ]
      );
      assert.equal(bookLevels[0]?.id, `nce-1997-b${bookNumber}-level-001`);
      assert.equal(bookLevels[49]?.id, `nce-1997-b${bookNumber}-level-050`);
    }
  });

  test("namespaces every Legacy id while preserving old URL aliases", () => {
    const legacy = getLegacyRegistrySnapshot();
    const primaryIds = new Set([
      ...getAllBooks().map((book) => book.id),
      ...getAllUnits().map((unit) => unit.id),
      ...getAllWords().map((word) => word.id),
      ...getResolvedLevels().map((level) => level.id)
    ]);
    const legacyLevels = getLegacyResolvedLevels();
    const legacyIds = [
      ...legacy.bookIds,
      ...legacy.unitIds,
      ...legacy.wordIds,
      ...legacyLevels.map((level) => level.id)
    ];

    assert.equal(legacyIds.every((id) => id.startsWith("legacy:")), true);
    assert.equal(legacyIds.some((id) => primaryIds.has(id)), false);
    assert.equal(getAllBooks().some((book) => book.id.startsWith("legacy:")), false);
    assert.deepEqual(
      getAllBooks().map((book) => book.id),
      ["nce-1997-b1", "nce-1997-b2", "nce-1997-b3", "nce-1997-b4"]
    );
    assert.equal(getBookById("nce-1997-b1")?.id, "nce-1997-b1");
    assert.equal(getBookById("nce-1")?.id, "legacy:nce-1");
    assert.equal(getUnitsForBook("nce-1997-b1")[0]?.bookId, "nce-1997-b1");
    assert.equal(getUnitsForBook("nce-1")[0]?.bookId, "legacy:nce-1");
    assert.equal(getUnitByGlobalId("nce-1-u1")?.id, "legacy:nce-1-u1");
    assert.equal(getWordById("nce-1-u1-cat")?.id, "legacy:nce-1-u1-cat");
    assert.equal(
      getLevelById("nce-1-u1-level-1")?.id,
      "legacy:nce-1-u1-level-1"
    );
  });

  test("caches formal levels without changing deterministic layouts", () => {
    resetCurriculumLevelCacheForDiagnostics();
    const cold = getResolvedLevels();
    assert.equal(getCurriculumLevelCacheSize(), 20);
    const warm = getResolvedLevels();
    assert.equal(warm[0], cold[0]);
    resetCurriculumLevelCacheForDiagnostics();
    const regenerated = getResolvedLevels();
    assert.notEqual(regenerated[0], cold[0]);
    assert.deepEqual(
      regenerated.map((level) => level.layoutRevision),
      cold.map((level) => level.layoutRevision)
    );
  });

  test("requires complete verified sources and answer-safe non-placeholder clues", () => {
    const words = getAllWords();
    const fatalIssues = getVocabularyValidationIssues().filter((issue) =>
      [
        "duplicate-book-id",
        "duplicate-unit-id",
        "duplicate-word-id",
        "duplicate-word",
        "invalid-word",
        "empty-unit",
        "duplicate-level-id",
        "invalid-level",
        "invalid-source",
        "placeholder-content"
      ].includes(issue.type)
    );

    assert.deepEqual(fatalIssues, []);
    for (const word of words) {
      assert.match(word.word, /^[a-z]{3,10}$/);
      assert.ok(word.englishMeaning);
      assert.ok(word.chineseMeaning);
      assert.ok(word.phonetic);
      assert.ok(word.partOfSpeech);
      assert.equal(word.examples.length > 0, true);
      assert.equal(word.reviewStatus, "automated");
      assert.equal(word.source?.edition, "1997");
      assert.equal(word.source?.verification, "double-source");
      assert.match(word.source?.provenanceId ?? "", /ncego-.+\|ncecom-/);
      assert.equal(Number.isInteger(word.source?.lesson), true);
      assert.equal((word.source?.lesson ?? 0) > 0, true);
      assert.doesNotMatch(
        [word.englishMeaning, word.chineseMeaning, ...word.examples].join(" "),
        /placeholder|practice word|no explanation available/i
      );
      assert.doesNotMatch(
        word.englishMeaning ?? "",
        new RegExp(`\\b${word.word}\\b`, "i")
      );
      const example = word.examples[0] ?? "";
      const exampleWordCount =
        example.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)?.length ?? 0;
      assert.equal(word.examples.length, 1, `${word.id} example count`);
      assert.equal(exampleWordCount >= 4 && exampleWordCount <= 16, true);
      assert.match(example, new RegExp(`\\b${word.word}\\b`, "i"));
      assert.doesNotMatch(
        example,
        /after this lesson|own sentence|practice word|example sentence|[\u3400-\u9fff]/iu
      );
      assert.match(example, /[.!?]$/);
    }
  });

  test("keeps every clue answer-safe and every Chinese meaning clean", () => {
    const answerForms = (spelling: string) => {
      const forms = new Set([spelling]);
      if (/[^aeiou]y$/i.test(spelling)) {
        forms.add(`${spelling.slice(0, -1)}ies`);
        forms.add(`${spelling.slice(0, -1)}ied`);
      } else {
        forms.add(
          /(?:s|x|z|ch|sh|o)$/i.test(spelling)
            ? `${spelling}es`
            : `${spelling}s`
        );
        forms.add(/e$/i.test(spelling) ? `${spelling}d` : `${spelling}ed`);
      }
      forms.add(
        /ie$/i.test(spelling)
          ? `${spelling.slice(0, -2)}ying`
          : /e$/i.test(spelling) && !/ee$/i.test(spelling)
            ? `${spelling.slice(0, -1)}ing`
            : `${spelling}ing`
      );
      return [...forms];
    };
    for (const level of getResolvedLevels()) {
      const answers = level.targetWords.map((target) => target.word);
      for (const target of level.targetWords) {
        for (const answer of answers) {
          for (const form of answerForms(answer)) {
            assert.doesNotMatch(
              target.englishMeaning ?? target.clue,
              new RegExp(`\\b${form}\\b`, "i"),
              `${level.id}/${target.id} leaks ${form} from ${answer}`
            );
          }
        }
      }
    }

    for (const word of getAllWords()) {
      assert.doesNotMatch(
        word.chineseMeaning ?? "",
        /^(?:\.|。)|校少|挡风\s+玻璃/,
        `${word.id} dirty Chinese meaning`
      );
    }
  });

  test("binds every provenance id to a structured manifest and mapping report", () => {
    assert.equal(contentManifest.sources?.length, 5);
    assert.equal(contentManifest.mappingReport?.entries, 800);
    assert.equal(provenanceReport.entries.length, 800);
    const reportBytes = readFileSync(
      "src/content/vocabulary/generated/nce-1997-provenance.json"
    );
    assert.equal(
      contentManifest.mappingReport?.sha256,
      `sha256:${createHash("sha256").update(reportBytes).digest("hex")}`
    );
    const mappingByWordId = new Map(
      provenanceReport.entries.map((entry) => [entry.wordId, entry])
    );
    const manifestProvenance = new Set(contentManifest.provenanceIds ?? []);
    for (const word of getAllWords()) {
      const mapping = mappingByWordId.get(word.id);
      assert.ok(mapping, `${word.id} missing provenance mapping`);
      assert.equal(mapping.book, word.source?.book);
      assert.equal(mapping.lesson, word.source?.lesson);
      assert.equal(mapping.provenanceId, word.source?.provenanceId);
      assert.equal(mapping.word, word.word);
      assert.equal(mapping.sourceIds.length, 2);
      assert.equal(
        mapping.sourceIds.every((sourceId) =>
          contentManifest.sources?.some((source) => source.id === sourceId)
        ),
        true
      );
      assert.equal(manifestProvenance.has(mapping.provenanceId), true);
    }
  });

  test("strict import cannot bypass curriculum, source, review, or exact coverage gates", () => {
    for (const partial of [
      vocabularySources.slice(0, 1),
      vocabularySources.slice(0, 3)
    ]) {
      assert.equal(
        validateVocabularySources(structuredClone(partial), true).some((issue) =>
          issue.message.includes("exactly nce-1997-b1..b4")
        ),
        true
      );
    }
    const missingKind = structuredClone(vocabularySources);
    delete missingKind[0].contentKind;
    assert.equal(
      validateVocabularySources(missingKind, true).some((issue) =>
        issue.message.includes('contentKind="curriculum"')
      ),
      true
    );

    const wrongSource = structuredClone(vocabularySources);
    const firstWord = wrongSource[0].units[0].words[0];
    assert.ok(firstWord.source);
    firstWord.source.book = 2;
    firstWord.source.provenanceId = "not-in-manifest";
    (firstWord as { reviewStatus?: string }).reviewStatus = "approved";
    assert.equal(
      validateVocabularySources(wrongSource, true).some(
        (issue) => issue.type === "invalid-source" && issue.wordId === firstWord.id
      ),
      true
    );

    const plausibleButWrongLesson = structuredClone(vocabularySources);
    const tamperedWord = plausibleButWrongLesson[0].units[0].words[0];
    const donorWord = plausibleButWrongLesson[0].units[0].words[1];
    assert.ok(tamperedWord.source);
    assert.ok(donorWord.source);
    tamperedWord.source.lesson = donorWord.source.lesson;
    tamperedWord.source.provenanceId = donorWord.source.provenanceId;
    assert.equal(
      validateVocabularySources(plausibleButWrongLesson, true).some(
        (issue) =>
          issue.type === "invalid-source" && issue.wordId === tamperedWord.id
      ),
      true
    );

    const invalidExample = structuredClone(vocabularySources);
    invalidExample[0].units[0].words[0].examples = [
      "After this lesson, Mia used the word in her own sentence."
    ];
    assert.equal(
      validateVocabularySources(invalidExample, true).some(
        (issue) =>
          issue.type === "placeholder-content" &&
          issue.wordId === invalidExample[0].units[0].words[0].id
      ),
      true
    );

    const duplicateAssignment = structuredClone(vocabularySources);
    const levels = duplicateAssignment[0].units[0].levels ?? [];
    const omittedWordId = levels[1].wordIds[0];
    levels[1].wordIds = [levels[0].wordIds[0], ...levels[1].wordIds.slice(1)];
    assert.notEqual(levels[1].wordIds[0], omittedWordId);
    assert.equal(
      validateVocabularySources(duplicateAssignment, true).some(
        (issue) =>
          issue.type === "invalid-level" &&
          issue.message.includes("50 ordered levels and 200 words")
      ),
      true
    );

    const leakedInflection = structuredClone(vocabularySources);
    const shopping = leakedInflection
      .flatMap((book) => book.units)
      .flatMap((unit) => unit.words)
      .find((word) => word.word === "shopping");
    assert.ok(shopping);
    shopping.englishMeaning = "the act of buying things";
    assert.equal(
      validateVocabularySources(leakedInflection, true).some(
        (issue) =>
          issue.wordId === shopping.id && issue.message.includes('"things"')
      ),
      true
    );
  });

  test("keeps lesson anchors non-decreasing inside every book", () => {
    for (const book of getAllBooks()) {
      const anchors = getUnitsForBook(book.id).flatMap((unit) =>
        (unit.levels ?? []).map((level) => level.lessonAnchor ?? 0)
      );

      assert.equal(anchors.length, 50);
      assert.deepEqual(anchors, [...anchors].sort((left, right) => left - right));
    }
  });

  test("keeps high-risk polysemous clues aligned with the supplied Chinese sense", () => {
    const words = new Map(
      getAllWords().map((word) => [word.word.toLowerCase(), word])
    );
    const expectedSense = {
      bank: /money|financial|deposit/i,
      bill: /charge|pay/i,
      call: /visit/i,
      card: /message|post/i,
      club: /group|meet|shared interest/i,
      consist: /made up|composed/i,
      goodwill: /friend|helpful|kind/i,
      mean: /unwilling|stingy|ungenerous/i,
      insoluble: /unable|dissolve|liquid/i,
      intoxicate: /excitement|delight/i,
      mum: /mother/i,
      rest: /lean|place|support/i,
      rub: /difficult part|problem/i,
      secretary: /office|assistant|records/i,
      settlement: /place|homes/i,
      speed: /rate|moves|roads/i,
      tyre: /rubber|wheel/i,
      turn: /behav/i,
      vulgar: /ordinary|taste|refinement/i,
      wasp: /insect|sting/i,
      acrobatic: /balanc|jump|tumbl/i
    } as const;

    for (const [spelling, sense] of Object.entries(expectedSense)) {
      const word = words.get(spelling);
      assert.ok(word, `${spelling} missing`);
      assert.match(word.englishMeaning ?? "", sense, `${spelling} sense drifted`);
      assert.doesNotMatch(
        word.englishMeaning ?? "",
        new RegExp(`\\b${spelling}\\b`, "i"),
        `${spelling} leaked into its clue`
      );
    }

    const confirmedSenseFixes = {
      swing: {
        partOfSpeech: "verb",
        chinese: /转向/,
        clue: /turn|direction/i,
        example: /swing.*(?:toward|left|right|direction)/i
      },
      cherish: {
        partOfSpeech: "verb",
        chinese: /期望|渴望/,
        clue: /hope|wish/i,
        example: /cherish.*hope/i
      },
      blur: {
        partOfSpeech: "verb",
        chinese: /模糊/,
        clue: /focus|unclear/i,
        example: /blur.*view/i
      },
      zip: {
        partOfSpeech: "noun",
        chinese: /拉链/,
        clue: /fastener|teeth|slider/i,
        example: /zip.*(?:bag|coat)/i
      },
      landlord: {
        partOfSpeech: "noun",
        chinese: /店主/,
        clue: /pub|property/i,
        example: /landlord.*pub/i
      }
    } as const;
    for (const [spelling, expected] of Object.entries(confirmedSenseFixes)) {
      const word = words.get(spelling);
      assert.ok(word, `${spelling} missing`);
      assert.equal(word.partOfSpeech, expected.partOfSpeech);
      assert.match(word.chineseMeaning ?? "", expected.chinese);
      assert.match(word.englishMeaning ?? "", expected.clue);
      assert.match(word.examples[0] ?? "", expected.example);
      assert.equal(word.reviewStatus, "automated");
    }
    assert.equal(senseAuditReport.unresolved, 0);
  });

  test("applies the bounded editorial correction layer without overstating review", () => {
    const correctedIds = Object.keys(editorialWordOverrides);
    const demoIds = correctedIds.filter((id) => id.startsWith("nce-1997-b1-"));
    assert.equal(demoIds.length, 16);
    assert.match(contentManifest.generatorVersion, new RegExp(EDITORIAL_OVERRIDE_VERSION));

    for (const [id, override] of Object.entries(editorialWordOverrides)) {
      const word = getWordById(id);
      assert.ok(word, id);
      assert.equal(word.reviewStatus, "automated", id);
      assert.equal(word.englishMeaning, override.englishMeaning, id);
      assert.equal(word.chineseMeaning, override.chineseMeaning, id);
      assert.equal(word.partOfSpeech, override.partOfSpeech, id);
      assert.deepEqual(word.examples, override.examples, id);
      assert.doesNotMatch(
        word.englishMeaning ?? "",
        new RegExp(`\\b${word.word}\\b`, "i"),
        `${id} leaks its answer`
      );
    }

    assert.doesNotMatch(getWordById("nce-1997-b1-armchair")?.englishMeaning ?? "", /chair/i);
    assert.doesNotMatch(getWordById("nce-1997-b1-electric")?.englishMeaning ?? "", /electric/i);
    const confirmedMorphologyLeaks = {
      "nce-1997-b1-suit": /suit/i,
      "nce-1997-b1-rusty": /rust/i,
      "nce-1997-b2-helper": /help/i,
      "nce-1997-b2-swimmer": /swim/i,
      "nce-1997-b2-villager": /villag/i,
      "nce-1997-b2-shady": /shad/i,
      "nce-1997-b2-diver": /div/i,
      "nce-1997-b3-suspension": /suspend/i,
      "nce-1997-b3-belongings": /belong/i,
      "nce-1997-b3-sticky": /stick/i,
      "nce-1997-b4-penalize": /penal/i
    } as const;
    for (const [id, forbiddenRoot] of Object.entries(confirmedMorphologyLeaks)) {
      assert.doesNotMatch(
        getWordById(id)?.englishMeaning ?? "",
        forbiddenRoot,
        `${id} leaks a confirmed answer root`
      );
      assert.equal(getWordById(id)?.reviewStatus, "automated", id);
    }
    assert.equal(getWordById("nce-1997-b4-morality")?.partOfSpeech, "noun");
    assert.equal(getWordById("nce-1997-b4-confine")?.partOfSpeech, "verb");
    assert.match(getWordById("nce-1997-b4-riot")?.englishMeaning ?? "", /display of colours/i);
    assert.equal(
      curriculumIndex.levels.every(
        (level) =>
          (level as { releaseStatus?: string }).releaseStatus === undefined ||
          (level as { releaseStatus?: string }).releaseStatus === "automated-beta"
      ),
      true
    );
    assert.equal(
      contentManifest.sources?.every(
        (source) => source.licenseStatus === "unknown-reference-only"
      ),
      true
    );
  });

  test("validates every production board as one exact bounded component", () => {
    const levels = getResolvedLevels();

    for (const level of levels) {
      const analysis = analyzeCrosswordLayout(toLayout(level));
      assert.equal(analysis.connected, true, `${level.id} disconnected`);
      assert.equal(analysis.componentCount, 1, `${level.id} component count`);
      assert.equal(analysis.hasAcrossAndDown, true, `${level.id} lacks a direction`);
      assert.equal(analysis.crossingCount >= level.targetWords.length - 1, true);
      assert.deepEqual(analysis.conflicts, [], `${level.id} conflicts`);
      assert.deepEqual(analysis.unexpectedRuns, [], `${level.id} accidental run`);
      assert.equal(analysis.withinGrid, true, `${level.id} outside grid`);
      assert.equal(level.grid.rows <= 11, true, `${level.id} too tall`);
      assert.equal(level.grid.cols <= 11, true, `${level.id} too wide`);
      assert.match(level.layoutRevision ?? "", /^layout-[0-9a-f]{8}$/);
      assert.equal(
        level.layoutRevision,
        createLayoutRevision({
          levelId: level.id,
          wordIds: level.targetWords.map(
            (word) => word.vocabularyWordId ?? word.id
          ),
          normalizedSpellings: level.targetWords.map((word) => word.word),
          grid: level.grid,
          placements: level.targetWords.map((word, index) => ({
            index,
            start: word.start,
            direction: word.direction
          })),
          manifestVersion: contentManifest.version
        })
      );
      assertLayoutWithIndependentOracle(level);
    }
  });

  test("changes layout revision when spelling or grid changes at fixed coordinates", () => {
    const base = {
      levelId: "revision-test",
      wordIds: ["word-1"],
      grid: { rows: 3, cols: 3 },
      placements: [
        {
          index: 0,
          start: { row: 0, col: 0 },
          direction: "across" as const
        }
      ],
      manifestVersion: contentManifest.version
    };
    const cat = createLayoutRevision({
      ...base,
      normalizedSpellings: ["cat"]
    });
    const bat = createLayoutRevision({
      ...base,
      normalizedSpellings: ["bat"]
    });
    const taller = createLayoutRevision({
      ...base,
      normalizedSpellings: ["cat"],
      grid: { rows: 4, cols: 3 }
    });

    assert.notEqual(cat, bat);
    assert.notEqual(cat, taller);
  });

  test("blocks disconnected curriculum generation instead of using practice fallback", () => {
    assert.equal(
      createConnectedCrosswordLayout(["CAT", "DOG", "PEN"]),
      undefined
    );

    const words = ["cat", "dog", "pen"].map((word): VocabularyWord => ({
      id: word,
      bookId: "test",
      unitId: "test",
      word,
      displayText: word,
      examples: [],
      tags: []
    }));
    assert.throws(
      () => generateLevelFromWords(words, { requireConnected: true }),
      /fully connected/
    );
  });

  test("rejects incomplete formal source metadata and placeholders at import", () => {
    const bad = [
      {
        id: "bad-book",
        title: "Bad",
        subtitle: "Bad",
        level: "A1",
        contentKind: "curriculum",
        units: [
          {
            id: "bad-unit",
            title: "Bad",
            difficulty: "A1",
            words: [
              {
                id: "bad-word",
                word: "wrong",
                englishMeaning: "placeholder meaning",
                chineseMeaning: "错误",
                phonetic: "/rɒŋ/",
                partOfSpeech: "adjective",
                examples: ["A new example."],
                reviewStatus: "automated"
              }
            ],
            levels: [
              {
                id: "bad-level",
                wordIds: ["bad-word", "missing-a", "missing-b"],
                lessonAnchor: 1
              }
            ]
          }
        ]
      }
    ] satisfies VocabularyImportBook[];
    const issues = validateVocabularySources(bad);

    assert.equal(issues.some((issue) => issue.type === "invalid-source"), true);
    assert.equal(issues.some((issue) => issue.type === "empty-unit"), true);
  });

  test("composes solved crossings, hints, and player cells into a real submission", () => {
    const level: Level = {
      id: "crossing-draft",
      bookId: "test",
      unitId: "test",
      letters: ["A", "E", "E", "H", "R", "T", "W"],
      targetWords: [
        {
          id: "what",
          word: "WHAT",
          clue: "Question term asking for a thing",
          start: { row: 0, col: 0 },
          direction: "across"
        },
        {
          id: "here",
          word: "HERE",
          clue: "In this place",
          start: { row: 0, col: 1 },
          direction: "down"
        }
      ],
      grid: { rows: 4, cols: 4 },
      difficulty: "easy",
      rewardCoins: 20
    };
    const solvedWhat = {
      ...createEmptyLevelProgress(),
      foundWords: ["what"]
    };
    let draft = createEmptyCrosswordDraft("here");
    draft = addCrosswordDraftLetter(level, solvedWhat, draft, "here", "E", 1);
    draft = addCrosswordDraftLetter(level, solvedWhat, draft, "here", "R", 4);
    draft = addCrosswordDraftLetter(level, solvedWhat, draft, "here", "E", 2);
    const view = getCrosswordDraftView(level, solvedWhat, draft, "here");

    assert.equal(view.displayWord, "HERE");
    assert.equal(view.submission, "HERE");
    assert.equal(view.complete, true);
    assert.deepEqual(view.selectedIndexes, [1, 4, 2]);
    assert.deepEqual(getDraftCellLetters(draft), {
      "1:1": "E",
      "2:1": "R",
      "3:1": "E"
    });

    const hintedMiddle = {
      ...solvedWhat,
      revealedCells: ["2:1" as const]
    };
    const hintedView = getCrosswordDraftView(
      level,
      hintedMiddle,
      draft,
      "here"
    );
    assert.equal(hintedView.submission, "HERE");
    assert.deepEqual(hintedView.selectedIndexes, [1, 2]);

    const switchedClue = getCrosswordDraftView(
      level,
      solvedWhat,
      draft,
      "what"
    );
    assert.deepEqual(switchedClue.selectedIndexes, []);

    const replay = getCrosswordDraftView(
      level,
      createEmptyLevelProgress(),
      createEmptyCrosswordDraft("here"),
      "here"
    );
    assert.equal(replay.displayWord, "····");
    assert.equal(replay.complete, false);
  });
});
