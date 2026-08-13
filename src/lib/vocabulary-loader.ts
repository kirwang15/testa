import {
  contentManifest,
  LEGACY_CONTENT_PREFIX,
  legacyVocabularySources,
  vocabularySources
} from "../content/vocabulary";
import provenanceReport from "../content/vocabulary/generated/nce-1997-provenance.json";
import {
  createEmptyWordLearningProgress,
  summarizeWordProgress
} from "./learning-engine";
import {
  analyzeCrosswordLayout,
  generateLevelFromWords,
  generateLevelsFromUnit,
  type GenerateLevelsOptions
} from "./level-generator";
import { validateVocabularyUniqueness } from "./vocabulary-uniqueness";
import type {
  BookProgress,
  Level,
  LevelProgress,
  NceVocabularySource,
  UnitProgress,
  VocabularyBook,
  VocabularyColorTheme,
  VocabularyImportBook,
  VocabularyImportLevel,
  VocabularyUnit,
  VocabularyWord,
  WordDetailViewModel,
  WordLearningProgress
} from "@/types/game";

const CURRICULUM_LESSON_LIMITS: Record<1 | 2 | 3 | 4, number> = {
  1: 144,
  2: 96,
  3: 60,
  4: 48
};
const REVIEW_STATUS_VALUES = new Set(["automated", "human-reviewed"]);
const VERIFIED_PROVENANCE_IDS = new Set(contentManifest.provenanceIds ?? []);
const MANIFEST_SOURCE_IDS = new Set(
  (contentManifest.sources ?? []).map((source) => source.id)
);
const PROVENANCE_BY_WORD_ID = new Map(
  provenanceReport.entries.map((entry) => [entry.wordId, entry] as const)
);
const EXPECTED_CURRICULUM_BOOK_IDS = [
  "nce-1997-b1",
  "nce-1997-b2",
  "nce-1997-b3",
  "nce-1997-b4"
] as const;
const GENERIC_EXAMPLE_PATTERN =
  /after this lesson|own sentence|practice word|example sentence/i;

function isNceVocabularySource(
  source: VocabularyWord["source"]
): source is NceVocabularySource {
  return Boolean(source && "book" in source && "lesson" in source);
}

export type VocabularyValidationIssue = {
  type:
    | "duplicate-book-id"
    | "duplicate-unit-id"
    | "duplicate-word-id"
    | "invalid-word"
    | "empty-unit"
    | "duplicate-word"
    | "duplicate-meaning"
    | "duplicate-concept"
    | "duplicate-level-id"
    | "invalid-level"
    | "invalid-source"
    | "placeholder-content";
  message: string;
  bookId?: string;
  unitId?: string;
  wordId?: string;
  word?: string;
  relatedWordIds?: string[];
  levelId?: string;
};

type VocabularyData = {
  books: VocabularyBook[];
  units: VocabularyUnit[];
  words: VocabularyWord[];
  booksById: Map<string, VocabularyBook>;
  unitsById: Map<string, VocabularyUnit>;
  wordsById: Map<string, VocabularyWord>;
  unitIdsByBookId: Map<string, string[]>;
  wordIdsByUnitId: Map<string, string[]>;
  issues: VocabularyValidationIssue[];
};

function normalizeText(value: string | undefined) {
  return value?.trim() ?? "";
}

function normalizeStringList(value: string[] | undefined) {
  return Array.isArray(value)
    ? value
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : [];
}

function getAnswerForms(spelling: string) {
  const forms = new Set([spelling]);
  if (/[^aeiou]y$/i.test(spelling)) {
    forms.add(`${spelling.slice(0, -1)}ies`);
    forms.add(`${spelling.slice(0, -1)}ied`);
  } else {
    forms.add(
      /(?:s|x|z|ch|sh|o)$/i.test(spelling) ? `${spelling}es` : `${spelling}s`
    );
    forms.add(/e$/i.test(spelling) ? `${spelling}d` : `${spelling}ed`);
  }
  if (/ie$/i.test(spelling)) {
    forms.add(`${spelling.slice(0, -2)}ying`);
  } else if (/e$/i.test(spelling) && !/ee$/i.test(spelling)) {
    forms.add(`${spelling.slice(0, -1)}ing`);
  } else {
    forms.add(`${spelling}ing`);
  }
  return [...forms];
}

function normalizeColorTheme(
  colorTheme: VocabularyColorTheme | undefined
) {
  return colorTheme;
}

function normalizeWordEntry(
  bookId: string,
  unitId: string,
  unit: VocabularyImportBook["units"][number],
  word: VocabularyImportBook["units"][number]["words"][number],
  requireCurriculumMetadata: boolean,
  expectedBookNumber?: 1 | 2 | 3 | 4
): { normalizedWord?: VocabularyWord; issue?: VocabularyValidationIssue } {
  const normalizedId = normalizeText(word.id);
  const normalizedWord = normalizeText(word.word);
  const normalizedEnglishMeaning =
    normalizeText(word.englishMeaning) || normalizeText(word.meaning) || undefined;

  if (!normalizedId || !normalizedWord) {
    return {
      issue: {
        type: "invalid-word",
        bookId,
        unitId,
        wordId: normalizedId || undefined,
        word: normalizedWord || undefined,
        message: `Ignored an invalid word entry in ${bookId}/${unitId}.`
      }
    };
  }

  const source = isNceVocabularySource(word.source) ? word.source : undefined;
  const sourceBaseIsValid = Boolean(
    source &&
      [1, 2, 3, 4].includes(source.book) &&
      Number.isInteger(source.lesson) &&
      source.lesson > 0 &&
      source.edition === "1997" &&
      source.verification === "double-source" &&
      normalizeText(source.provenanceId)
  );
  const sourceIsValid = Boolean(
    sourceBaseIsValid &&
      source &&
      (!requireCurriculumMetadata ||
        (expectedBookNumber !== undefined &&
          source.book === expectedBookNumber &&
          source.lesson <= CURRICULUM_LESSON_LIMITS[expectedBookNumber] &&
          VERIFIED_PROVENANCE_IDS.has(normalizeText(source.provenanceId)) &&
          (() => {
            const reportEntry = PROVENANCE_BY_WORD_ID.get(normalizedId);
            return Boolean(
              reportEntry &&
                reportEntry.word === normalizedWord &&
                reportEntry.book === source.book &&
                reportEntry.lesson === source.lesson &&
                reportEntry.provenanceId === normalizeText(source.provenanceId) &&
                reportEntry.sourceIds.length >= 2 &&
                reportEntry.sourceIds.every((sourceId) =>
                  MANIFEST_SOURCE_IDS.has(sourceId)
                )
            );
          })()))
  );
  const reviewStatusIsValid = REVIEW_STATUS_VALUES.has(
    String(word.reviewStatus ?? "")
  );

  if (requireCurriculumMetadata && (!sourceIsValid || !reviewStatusIsValid)) {
    return {
      issue: {
        type: "invalid-source",
        bookId,
        unitId,
        wordId: normalizedId,
        word: normalizedWord,
        message: `Curriculum word "${normalizedId}" is missing verified 1997 source metadata or review status.`
      }
    };
  }

  const contentFields = [
    normalizedEnglishMeaning,
    normalizeText(word.chineseMeaning),
    ...normalizeStringList(word.examples)
  ];
  const normalizedExamples = normalizeStringList(word.examples);
  const hasPlaceholder = contentFields.some((field) =>
    /placeholder|practice word|no explanation available/i.test(field ?? "")
  );
  const hasDirtyTranslation = /^(?:\.|。)|校少|挡风\s+玻璃/.test(
    normalizeText(word.chineseMeaning)
  );

  if (requireCurriculumMetadata && (hasPlaceholder || hasDirtyTranslation)) {
    return {
      issue: {
        type: "placeholder-content",
        bookId,
        unitId,
        wordId: normalizedId,
        word: normalizedWord,
        message: `Curriculum word "${normalizedId}" contains placeholder content.`
      }
    };
  }

  if (
    requireCurriculumMetadata &&
    (!normalizedEnglishMeaning ||
      !normalizeText(word.chineseMeaning) ||
      !normalizeText(word.phonetic) ||
      !normalizeText(word.partOfSpeech) ||
      normalizedExamples.length === 0)
  ) {
    return {
      issue: {
        type: "placeholder-content",
        bookId,
        unitId,
        wordId: normalizedId,
        word: normalizedWord,
        message: `Curriculum word "${normalizedId}" is missing a required clue, translation, phonetic, part of speech, or example.`
      }
    };
  }

  if (requireCurriculumMetadata) {
    const example = normalizedExamples[0] ?? "";
    const exampleWordCount =
      example.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)?.length ?? 0;
    const escapedSpelling = normalizedWord.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
    const exampleIsValid =
      normalizedExamples.length === 1 &&
      exampleWordCount >= 4 &&
      exampleWordCount <= 16 &&
      new RegExp(`\\b${escapedSpelling}\\b`, "i").test(example) &&
      !/[\u3400-\u9fff]/u.test(example) &&
      !GENERIC_EXAMPLE_PATTERN.test(example) &&
      /[.!?]$/.test(example);

    if (!exampleIsValid) {
      return {
        issue: {
          type: "placeholder-content",
          bookId,
          unitId,
          wordId: normalizedId,
          word: normalizedWord,
          message: `Curriculum word "${normalizedId}" needs one original 4-16 word example containing the exact spelling.`
        }
      };
    }
  }

  return {
    normalizedWord: {
      id: normalizedId,
      bookId,
      unitId,
      word: normalizedWord,
      displayText: normalizeText(word.displayText) || normalizedWord,
      englishMeaning: normalizedEnglishMeaning,
      chineseMeaning: normalizeText(word.chineseMeaning) || undefined,
      phonetic: normalizeText(word.phonetic) || undefined,
      partOfSpeech: normalizeText(word.partOfSpeech) || undefined,
      difficulty:
        typeof word.difficulty === "number" && Number.isFinite(word.difficulty)
          ? Math.max(1, Math.floor(word.difficulty))
          : undefined,
      cefrLevel: word.cefrLevel ?? unit.difficulty,
      frequencyRank:
        typeof word.frequencyRank === "number" && Number.isFinite(word.frequencyRank)
          ? Math.max(1, Math.floor(word.frequencyRank))
          : undefined,
      examples: normalizedExamples,
      tags: normalizeStringList(word.tags),
      learningConcept: normalizeText(word.learningConcept) || undefined,
      reviewStatus: word.reviewStatus,
      source: sourceBaseIsValid && source
        ? {
            book: source.book,
            lesson: source.lesson,
            edition: source.edition,
            verification: source.verification,
            provenanceId: normalizeText(source.provenanceId)
          }
        : undefined
    }
  };
}

function mapUniquenessIssue(issue: ReturnType<typeof validateVocabularyUniqueness>[number]) {
  return {
    type: issue.type,
    message: issue.message,
    wordId: issue.wordIds[0],
    relatedWordIds: issue.wordIds
  } satisfies VocabularyValidationIssue;
}

function buildVocabularyData(
  sources: VocabularyImportBook[] = vocabularySources,
  strictCurriculum = false,
  throwOnFatal = strictCurriculum
): VocabularyData {
  const issues: VocabularyValidationIssue[] = [];
  const books: VocabularyBook[] = [];
  const units: VocabularyUnit[] = [];
  const words: VocabularyWord[] = [];
  const booksById = new Map<string, VocabularyBook>();
  const unitsById = new Map<string, VocabularyUnit>();
  const wordsById = new Map<string, VocabularyWord>();
  const unitIdsByBookId = new Map<string, string[]>();
  const wordIdsByUnitId = new Map<string, string[]>();
  const seenBookIds = new Set<string>();
  const seenWordIds = new Set<string>();
  const seenLevelIds = new Set<string>();

  if (
    strictCurriculum &&
    (!Array.isArray(contentManifest.sources) ||
      contentManifest.sources.length < 2 ||
      !contentManifest.sources.every(
        (source) =>
          source.id.trim().length > 0 &&
          /^https:\/\//.test(source.url) &&
          /^\d{4}-\d{2}-\d{2}$/.test(source.snapshotDate) &&
          /^sha256:[0-9a-f]{64}$/.test(source.sha256) &&
          ["unknown-reference-only", "licensed", "public-domain"].includes(
            source.licenseStatus
          ) &&
          source.version.trim().length > 0
      ) ||
      VERIFIED_PROVENANCE_IDS.size === 0 ||
      contentManifest.mappingReport?.entries !== 800)
  ) {
    issues.push({
      type: "invalid-source",
      message: "Curriculum content manifest is missing structured sources, provenance ids, or its 800-entry mapping report."
    });
  }

  for (const book of sources) {
    const bookId = normalizeText(book.id);

    if (!bookId || seenBookIds.has(bookId)) {
      issues.push({
        type: "duplicate-book-id",
        bookId,
        message: `Duplicate book id "${bookId}" was found and later entries are ignored.`
      });
      continue;
    }

    seenBookIds.add(bookId);
    const requireCurriculumMetadata =
      strictCurriculum || book.contentKind === "curriculum";
    const bookNumberMatch = /^nce-1997-b([1-4])$/.exec(bookId);
    const expectedBookNumber = bookNumberMatch
      ? (Number(bookNumberMatch[1]) as 1 | 2 | 3 | 4)
      : undefined;
    if (strictCurriculum && book.contentKind !== "curriculum") {
      issues.push({
        type: "invalid-source",
        bookId,
        message: `Primary book "${bookId}" must declare contentKind="curriculum".`
      });
    }
    const seenUnitIds = new Set<string>();
    const unitIds: string[] = [];

    for (const unit of book.units) {
      const unitId = normalizeText(unit.id);

      if (!unitId || seenUnitIds.has(unitId)) {
        issues.push({
          type: "duplicate-unit-id",
          bookId,
          unitId,
          message: `Duplicate unit id "${unitId}" was found in book "${bookId}".`
        });
        continue;
      }

      seenUnitIds.add(unitId);
      const unitWordIds: string[] = [];

      for (const word of unit.words) {
        const result = normalizeWordEntry(
          bookId,
          unitId,
          unit,
          word,
          requireCurriculumMetadata,
          expectedBookNumber
        );

        if (result.issue) {
          issues.push(result.issue);
          continue;
        }

        const normalizedWord = result.normalizedWord;

        if (!normalizedWord) {
          continue;
        }

        if (seenWordIds.has(normalizedWord.id)) {
          issues.push({
            type: "duplicate-word-id",
            bookId,
            unitId,
            wordId: normalizedWord.id,
            message: `Duplicate word id "${normalizedWord.id}" was found and later entries are ignored.`
          });
          continue;
        }

        seenWordIds.add(normalizedWord.id);
        words.push(normalizedWord);
        wordsById.set(normalizedWord.id, normalizedWord);
        unitWordIds.push(normalizedWord.id);
      }

      if (unitWordIds.length === 0) {
        issues.push({
          type: "empty-unit",
          bookId,
          unitId,
          message: `Unit "${unitId}" in book "${bookId}" has no usable words and is skipped.`
        });
        continue;
      }

      const normalizedLevels: VocabularyImportLevel[] = [];
      let previousLessonAnchor = 0;

      for (const level of unit.levels ?? []) {
        const levelId = normalizeText(level.id);
        const wordIds = level.wordIds
          .map((wordId) => normalizeText(wordId))
          .filter(Boolean);
        const lessonAnchor = level.lessonAnchor;
        const validWordIds = new Set(unitWordIds);
        const validLevel =
          levelId.length > 0 &&
          !seenLevelIds.has(levelId) &&
          wordIds.length >= 3 &&
          wordIds.length <= 5 &&
          new Set(wordIds).size === wordIds.length &&
          wordIds.every((wordId) => validWordIds.has(wordId)) &&
          (!requireCurriculumMetadata ||
            (Number.isInteger(lessonAnchor) &&
              Number(lessonAnchor) > 0 &&
              expectedBookNumber !== undefined &&
              Number(lessonAnchor) <=
                CURRICULUM_LESSON_LIMITS[expectedBookNumber] &&
              Number(lessonAnchor) >= previousLessonAnchor));

        if (!validLevel) {
          issues.push({
            type: seenLevelIds.has(levelId)
              ? "duplicate-level-id"
              : "invalid-level",
            bookId,
            unitId,
            levelId: levelId || undefined,
            message: `Invalid explicit level "${levelId || "(missing id)"}" in ${bookId}/${unitId}.`
          });
          continue;
        }

        seenLevelIds.add(levelId);
        previousLessonAnchor = Number(lessonAnchor ?? previousLessonAnchor);
        normalizedLevels.push({
          id: levelId,
          title: normalizeText(level.title) || undefined,
          wordIds,
          lessonAnchor
        });
      }

      if (requireCurriculumMetadata) {
        for (const level of normalizedLevels) {
          const levelWords = level.wordIds
            .map((wordId) => wordsById.get(wordId))
            .filter((word): word is VocabularyWord => Boolean(word));
          for (const clueOwner of levelWords) {
            for (const answer of levelWords) {
              const leakedForm = getAnswerForms(answer.word).find((form) => {
                const escapedAnswer = form.replace(
                  /[.*+?^${}()|[\]\\]/g,
                  "\\$&"
                );
                return new RegExp(`\\b${escapedAnswer}\\b`, "i").test(
                  clueOwner.englishMeaning ?? ""
                );
              });
              if (leakedForm) {
                issues.push({
                  type: "placeholder-content",
                  bookId,
                  unitId,
                  wordId: clueOwner.id,
                  word: clueOwner.word,
                  levelId: level.id,
                  message: `Curriculum clue for "${clueOwner.id}" leaks inflected level answer "${leakedForm}" from "${answer.word}".`
                });
              }
            }
          }
        }
      }

      if (requireCurriculumMetadata && normalizedLevels.length === 0) {
        issues.push({
          type: "invalid-level",
          bookId,
          unitId,
          message: `Curriculum unit "${unitId}" has no explicit levels.`
        });
      }

      const normalizedUnit: VocabularyUnit = {
        id: unitId,
        bookId,
        title: normalizeText(unit.title) || unitId,
        lessonRange: normalizeText(unit.lessonRange) || undefined,
        difficulty: unit.difficulty,
        estimatedMinutes:
          typeof unit.estimatedMinutes === "number" && Number.isFinite(unit.estimatedMinutes)
            ? Math.max(1, Math.floor(unit.estimatedMinutes))
            : undefined,
        wordIds: unitWordIds,
        levels: normalizedLevels
      };

      units.push(normalizedUnit);
      unitsById.set(unitId, normalizedUnit);
      wordIdsByUnitId.set(unitId, unitWordIds);
      unitIds.push(unitId);
    }

    if (requireCurriculumMetadata) {
      const bookUnits = unitIds
        .map((unitId) => unitsById.get(unitId))
        .filter((unit): unit is VocabularyUnit => Boolean(unit));
      const curriculumLevels = bookUnits.flatMap((unit) => unit.levels ?? []);
      const curriculumWordIds = bookUnits.flatMap((unit) => unit.wordIds);
      const anchors = curriculumLevels.map((level) => level.lessonAnchor ?? 0);
      const expectedSizes = [
        ...Array(15).fill(3),
        ...Array(20).fill(4),
        ...Array(15).fill(5)
      ];
      const referencedWordIds = curriculumLevels.flatMap(
        (level) => level.wordIds
      );
      const referencedWordIdSet = new Set(referencedWordIds);
      const curriculumWordIdSet = new Set(curriculumWordIds);
      const exactWordCoverage =
        referencedWordIds.length === curriculumWordIds.length &&
        referencedWordIdSet.size === curriculumWordIdSet.size &&
        curriculumWordIds.every((wordId) => referencedWordIdSet.has(wordId));
      const shapeIsValid =
        curriculumLevels.length === 50 &&
        curriculumWordIds.length === 200 &&
        curriculumLevels.every(
          (level, index) => level.wordIds.length === expectedSizes[index]
        ) &&
        exactWordCoverage &&
        anchors.every(
          (anchor, index) => index === 0 || anchor >= anchors[index - 1]
        );

      if (!shapeIsValid) {
        issues.push({
          type: "invalid-level",
          bookId,
          message: `Curriculum book "${bookId}" must contain 50 ordered levels and 200 words in the 3/4/5-word progression.`
        });
      }
    }

    const normalizedBook: VocabularyBook = {
      id: bookId,
      title: normalizeText(book.title) || bookId,
      subtitle: normalizeText(book.subtitle),
      description: normalizeText(book.description) || undefined,
      level: book.level,
      estimatedWordCount:
        typeof book.estimatedWordCount === "number" && Number.isFinite(book.estimatedWordCount)
          ? Math.max(0, Math.floor(book.estimatedWordCount))
          : unitIds.reduce((sum, unitId) => sum + (wordIdsByUnitId.get(unitId)?.length ?? 0), 0),
      colorTheme: normalizeColorTheme(book.colorTheme),
      contentKind: book.contentKind,
      unitIds
    };

    books.push(normalizedBook);
    booksById.set(bookId, normalizedBook);
    unitIdsByBookId.set(bookId, unitIds);
  }

  issues.push(...validateVocabularyUniqueness(words).map(mapUniquenessIssue));

  if (strictCurriculum) {
    const actualBookIds = books.map((book) => book.id).sort();
    const expectedBookIds = [...EXPECTED_CURRICULUM_BOOK_IDS].sort();
    const totalLevels = units.reduce(
      (total, unit) => total + (unit.levels?.length ?? 0),
      0
    );
    if (
      sources.length !== 4 ||
      books.length !== 4 ||
      JSON.stringify(actualBookIds) !== JSON.stringify(expectedBookIds) ||
      words.length !== 800 ||
      totalLevels !== 200
    ) {
      issues.push({
        type: "invalid-source",
        message:
          "Strict curriculum must contain exactly nce-1997-b1..b4, 200 levels, and 800 words."
      });
    }
  }

  if (throwOnFatal) {
    const fatalTypes = new Set<VocabularyValidationIssue["type"]>([
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
    ]);
    const fatalIssues = issues.filter((issue) => fatalTypes.has(issue.type));

    if (fatalIssues.length > 0) {
      throw new Error(
        `Curriculum validation failed: ${fatalIssues
          .map((issue) => issue.message)
          .join(" | ")}`
      );
    }
  }

  return {
    books,
    units,
    words,
    booksById,
    unitsById,
    wordsById,
    unitIdsByBookId,
    wordIdsByUnitId,
    issues
  };
}

const vocabularyData = buildVocabularyData(vocabularySources, true);
const legacyVocabularyData = buildVocabularyData(legacyVocabularySources);

export function normalizeVocabularySources(
  sources: VocabularyImportBook[] = vocabularySources
) {
  return buildVocabularyData(sources);
}

function getCompletedLevelCount(
  levelIds: string[],
  progressByLevelId: Record<string, LevelProgress>
) {
  return levelIds.filter((levelId) => progressByLevelId[levelId]?.completed).length;
}

function getFoundWordCount(
  levelIds: string[],
  progressByLevelId: Record<string, LevelProgress>
) {
  return levelIds.reduce((sum, levelId) => {
    return sum + (progressByLevelId[levelId]?.foundWords.length ?? 0);
  }, 0);
}

function countWordProgress(
  wordIds: string[],
  progressByWordId: Record<string, WordLearningProgress>
) {
  return summarizeWordProgress(
    wordIds.flatMap((wordId) => {
      const progress = progressByWordId[wordId];
      return progress ? [progress] : [];
    })
  );
}

export function validateVocabularySources(
  sources: VocabularyImportBook[] = vocabularySources,
  strictCurriculum = false
) {
  return buildVocabularyData(sources, strictCurriculum, false).issues;
}

export function getVocabularyValidationIssues() {
  return vocabularyData.issues;
}

export function getAllBooks() {
  return vocabularyData.books;
}

export function getBookById(bookId: string) {
  const canonicalLegacyBookId = bookId.startsWith(LEGACY_CONTENT_PREFIX)
    ? bookId
    : `${LEGACY_CONTENT_PREFIX}${bookId}`;
  return (
    vocabularyData.booksById.get(bookId) ??
    legacyVocabularyData.booksById.get(bookId) ??
    legacyVocabularyData.booksById.get(canonicalLegacyBookId)
  );
}

export function getAllUnits() {
  return vocabularyData.units;
}

export function getUnitsForBook(bookId: string) {
  const canonicalLegacyBookId = bookId.startsWith(LEGACY_CONTENT_PREFIX)
    ? bookId
    : `${LEGACY_CONTENT_PREFIX}${bookId}`;
  const sourceData = vocabularyData.unitIdsByBookId.has(bookId)
    ? vocabularyData
    : legacyVocabularyData;
  const resolvedBookId = sourceData === vocabularyData
    ? bookId
    : canonicalLegacyBookId;
  const unitIds = sourceData.unitIdsByBookId.get(resolvedBookId) ?? [];
  return unitIds
    .map((unitId) => sourceData.unitsById.get(unitId))
    .filter((unit): unit is VocabularyUnit => Boolean(unit));
}

export function getUnitById(bookId: string, unitId: string) {
  const primaryUnit = vocabularyData.unitsById.get(unitId);
  if (primaryUnit?.bookId === bookId) {
    return primaryUnit;
  }
  const canonicalUnitId = unitId.startsWith(LEGACY_CONTENT_PREFIX)
    ? unitId
    : `${LEGACY_CONTENT_PREFIX}${unitId}`;
  const canonicalBookId = bookId.startsWith(LEGACY_CONTENT_PREFIX)
    ? bookId
    : `${LEGACY_CONTENT_PREFIX}${bookId}`;
  const legacyUnit = legacyVocabularyData.unitsById.get(canonicalUnitId);
  return legacyUnit?.bookId === canonicalBookId ? legacyUnit : undefined;
}

export function getUnitByGlobalId(unitId: string) {
  return (
    vocabularyData.unitsById.get(unitId) ??
    legacyVocabularyData.unitsById.get(unitId) ??
    legacyVocabularyData.unitsById.get(`${LEGACY_CONTENT_PREFIX}${unitId}`)
  );
}

export function getAllWords() {
  return vocabularyData.words;
}

/** Build-time only export used to compile isolated Legacy runtime bundles. */
export function getLegacyRegistryWords() {
  return legacyVocabularyData.words;
}

export function getWordById(wordId: string) {
  return (
    vocabularyData.wordsById.get(wordId) ??
    legacyVocabularyData.wordsById.get(wordId) ??
    legacyVocabularyData.wordsById.get(`${LEGACY_CONTENT_PREFIX}${wordId}`)
  );
}

export function getLegacyRegistrySnapshot() {
  return {
    bookIds: legacyVocabularyData.books.map((book) => book.id),
    unitIds: legacyVocabularyData.units.map((unit) => unit.id),
    wordIds: legacyVocabularyData.words.map((word) => word.id)
  };
}

export function getUnitWords(bookId: string, unitId: string) {
  const unit = getUnitById(bookId, unitId);

  if (!unit) {
    return [];
  }

  const sourceData = vocabularyData.unitsById.has(unit.id)
    ? vocabularyData
    : legacyVocabularyData;

  return unit.wordIds
    .map((wordId) => sourceData.wordsById.get(wordId))
    .filter((word): word is VocabularyWord => Boolean(word));
}

export function getBookWords(bookId: string) {
  return getUnitsForBook(bookId).flatMap((unit) => getUnitWords(bookId, unit.id));
}

export function getWordDetailViewModel(
  wordId: string,
  progressByWordId: Record<string, WordLearningProgress>
): WordDetailViewModel | undefined {
  const word = getWordById(wordId);

  if (!word) {
    return undefined;
  }

  const progress = progressByWordId[wordId] ?? createEmptyWordLearningProgress(wordId);

  return {
    word,
    progress,
    isMastered: progress.masteryLevel >= 4,
    isFavorite: progress.favorite,
    isDifficult: progress.difficult
  };
}

const curriculumLevelCache = new Map<string, Level[]>();

function buildCurriculumLevelsForUnit(unit: VocabularyUnit): Level[] {
  return (unit.levels ?? []).map((definition) => {
      const words = definition.wordIds
        .map((wordId) => vocabularyData.wordsById.get(wordId))
        .filter((word): word is VocabularyWord => Boolean(word));
      const level = generateLevelFromWords(words, {
        id: definition.id,
        title: definition.title,
        bookId: unit.bookId,
        unitId: unit.id,
        mode: "learning",
        requireConnected: true,
        maxGridSize: 11,
        manifestVersion: contentManifest.version
      });

      if (!level) {
        throw new Error(`Unable to generate curriculum level ${definition.id}.`);
      }

      const analysis = analyzeCrosswordLayout({
        grid: level.grid,
        placements: level.targetWords.map((word, index) => ({
          index,
          word: word.word,
          start: word.start,
          direction: word.direction
        }))
      });

      if (
        !analysis.connected ||
        !analysis.hasAcrossAndDown ||
        analysis.conflicts.length > 0 ||
        analysis.unexpectedRuns.length > 0 ||
        !analysis.withinGrid
      ) {
        throw new Error(`Curriculum level ${definition.id} failed crossword validation.`);
      }

      return level;
    });
}

function canUseCurriculumCache(options: GenerateLevelsOptions) {
  return Object.keys(options).every((key) => key === "mode") &&
    (options.mode ?? "learning") === "learning";
}

export function resetCurriculumLevelCacheForDiagnostics() {
  curriculumLevelCache.clear();
}

export function getCurriculumLevelCacheSize() {
  return curriculumLevelCache.size;
}

export function resolveLevelsForUnit(
  unit: VocabularyUnit,
  options: GenerateLevelsOptions = {}
): Level[] {
  if ((unit.levels?.length ?? 0) > 0 && (options.mode ?? "learning") === "learning") {
    if (!canUseCurriculumCache(options)) {
      return buildCurriculumLevelsForUnit(unit);
    }
    const cached = curriculumLevelCache.get(unit.id);
    if (cached) {
      return cached;
    }
    const levels = buildCurriculumLevelsForUnit(unit);
    curriculumLevelCache.set(unit.id, levels);
    return levels;
  }

  return generateLevelsFromUnit(unit, {
    ...options,
    words: options.words ?? getUnitWords(unit.bookId, unit.id)
  });
}

export function resolveLegacyLevelsForUnit(
  unit: VocabularyUnit,
  options: GenerateLevelsOptions = {}
) {
  const wordIds = legacyVocabularyData.wordIdsByUnitId.get(unit.id) ?? [];
  const words = wordIds
    .map((wordId) => legacyVocabularyData.wordsById.get(wordId))
    .filter((word): word is VocabularyWord => Boolean(word));

  return generateLevelsFromUnit(unit, {
    ...options,
    words
  });
}

export function getLegacyResolvedLevels(options: GenerateLevelsOptions = {}) {
  return legacyVocabularyData.units.flatMap((unit) =>
    resolveLegacyLevelsForUnit(unit, options)
  );
}

export function getLevelsForUnit(
  bookId: string,
  unitId: string,
  options: GenerateLevelsOptions = {}
) {
  const unit = getUnitById(bookId, unitId);
  if (!unit) {
    return [];
  }

  return vocabularyData.unitsById.has(unit.id)
    ? resolveLevelsForUnit(unit, options)
    : resolveLegacyLevelsForUnit(unit, options);
}

export function getLevelsForBook(
  bookId: string,
  options: GenerateLevelsOptions = {}
) {
  return getUnitsForBook(bookId).flatMap((unit) =>
    vocabularyData.unitsById.has(unit.id)
      ? resolveLevelsForUnit(unit, options)
      : resolveLegacyLevelsForUnit(unit, options)
  );
}

export function getResolvedLevels(options: GenerateLevelsOptions = {}) {
  return vocabularyData.units.flatMap((unit) => resolveLevelsForUnit(unit, options));
}

export function getUnitProgress(
  unitId: string,
  progressByLevelId: Record<string, LevelProgress>,
  progressByWordId: Record<string, WordLearningProgress> = {}
): UnitProgress {
  const unit = getUnitByGlobalId(unitId);
  const unitLevels = unit
    ? vocabularyData.unitsById.has(unit.id)
      ? resolveLevelsForUnit(unit)
      : resolveLegacyLevelsForUnit(unit)
    : [];
  const levelIds = unitLevels.map((level) => level.id);
  const totalWords = unit?.wordIds.length ?? 0;
  const foundWords = getFoundWordCount(levelIds, progressByLevelId);
  const completedLevels = getCompletedLevelCount(levelIds, progressByLevelId);
  const wordCounts = countWordProgress(unit?.wordIds ?? [], progressByWordId);

  return {
    unitId,
    bookId: unit?.bookId ?? "",
    totalLevels: unitLevels.length,
    completedLevels,
    totalWords,
    foundWords,
    learnedWords: wordCounts.learnedWords,
    masteredWords: wordCounts.masteredWords,
    difficultWords: wordCounts.difficultWords,
    completionPercent:
      unitLevels.length === 0 ? 0 : Math.round((completedLevels / unitLevels.length) * 100)
  };
}

export function getBookProgress(
  bookId: string,
  progressByLevelId: Record<string, LevelProgress>,
  progressByWordId: Record<string, WordLearningProgress> = {}
): BookProgress {
  const book = getBookById(bookId);
  const bookUnits = book ? getUnitsForBook(book.id) : [];
  const bookLevels = book ? getLevelsForBook(book.id) : [];
  const bookWordIds = bookUnits.flatMap((unit) => unit.wordIds);
  const levelIds = bookLevels.map((level) => level.id);
  const completedUnits = bookUnits.filter((unit) => {
    const unitProgress = getUnitProgress(unit.id, progressByLevelId, progressByWordId);
    return unitProgress.totalLevels > 0 && unitProgress.completedLevels === unitProgress.totalLevels;
  }).length;
  const completedLevels = getCompletedLevelCount(levelIds, progressByLevelId);
  const foundWords = getFoundWordCount(levelIds, progressByLevelId);
  const wordCounts = countWordProgress(bookWordIds, progressByWordId);

  return {
    bookId,
    totalUnits: bookUnits.length,
    completedUnits,
    totalLevels: bookLevels.length,
    completedLevels,
    totalWords: bookWordIds.length,
    foundWords,
    learnedWords: wordCounts.learnedWords,
    masteredWords: wordCounts.masteredWords,
    difficultWords: wordCounts.difficultWords,
    completionPercent:
      bookLevels.length === 0 ? 0 : Math.round((completedLevels / bookLevels.length) * 100)
  };
}

export const getAllVocabularyBooks = getAllBooks;
export const getVocabularyBookById = getBookById;
export const getAllVocabularyUnits = getAllUnits;
export const getUnitsByBookId = getUnitsForBook;
export const getWordsByUnitId = getUnitWords;
