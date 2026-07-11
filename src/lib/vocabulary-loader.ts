import { vocabularySources } from "../content/vocabulary";
import {
  createEmptyWordLearningProgress,
  summarizeWordProgress
} from "./learning-engine";
import {
  generateLevelsFromUnit,
  type GenerateLevelsOptions
} from "./level-generator";
import { validateVocabularyUniqueness } from "./vocabulary-uniqueness";
import type {
  BookProgress,
  Level,
  LevelProgress,
  UnitProgress,
  VocabularyBook,
  VocabularyColorTheme,
  VocabularyImportBook,
  VocabularyUnit,
  VocabularyWord,
  WordDetailViewModel,
  WordLearningProgress
} from "@/types/game";

export type VocabularyValidationIssue = {
  type:
    | "duplicate-book-id"
    | "duplicate-unit-id"
    | "duplicate-word-id"
    | "invalid-word"
    | "empty-unit"
    | "duplicate-word"
    | "duplicate-meaning"
    | "duplicate-concept";
  message: string;
  bookId?: string;
  unitId?: string;
  wordId?: string;
  word?: string;
  relatedWordIds?: string[];
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

function normalizeColorTheme(
  colorTheme: VocabularyColorTheme | undefined
) {
  return colorTheme;
}

function normalizeWordEntry(
  bookId: string,
  unitId: string,
  unit: VocabularyImportBook["units"][number],
  word: VocabularyImportBook["units"][number]["words"][number]
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
      examples: normalizeStringList(word.examples),
      tags: normalizeStringList(word.tags),
      learningConcept: normalizeText(word.learningConcept) || undefined
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
  sources: VocabularyImportBook[] = vocabularySources
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
        const result = normalizeWordEntry(bookId, unitId, unit, word);

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
        wordIds: unitWordIds
      };

      units.push(normalizedUnit);
      unitsById.set(unitId, normalizedUnit);
      wordIdsByUnitId.set(unitId, unitWordIds);
      unitIds.push(unitId);
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
      unitIds
    };

    books.push(normalizedBook);
    booksById.set(bookId, normalizedBook);
    unitIdsByBookId.set(bookId, unitIds);
  }

  issues.push(...validateVocabularyUniqueness(words).map(mapUniquenessIssue));

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

const vocabularyData = buildVocabularyData();

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
  sources: VocabularyImportBook[] = vocabularySources
) {
  return buildVocabularyData(sources).issues;
}

export function getVocabularyValidationIssues() {
  return vocabularyData.issues;
}

export function getAllBooks() {
  return vocabularyData.books;
}

export function getBookById(bookId: string) {
  return vocabularyData.booksById.get(bookId);
}

export function getAllUnits() {
  return vocabularyData.units;
}

export function getUnitsForBook(bookId: string) {
  const unitIds = vocabularyData.unitIdsByBookId.get(bookId) ?? [];
  return unitIds
    .map((unitId) => vocabularyData.unitsById.get(unitId))
    .filter((unit): unit is VocabularyUnit => Boolean(unit));
}

export function getUnitById(bookId: string, unitId: string) {
  const unit = vocabularyData.unitsById.get(unitId);
  return unit?.bookId === bookId ? unit : undefined;
}

export function getUnitByGlobalId(unitId: string) {
  return vocabularyData.unitsById.get(unitId);
}

export function getAllWords() {
  return vocabularyData.words;
}

export function getWordById(wordId: string) {
  return vocabularyData.wordsById.get(wordId);
}

export function getUnitWords(bookId: string, unitId: string) {
  const unit = getUnitById(bookId, unitId);

  if (!unit) {
    return [];
  }

  return unit.wordIds
    .map((wordId) => vocabularyData.wordsById.get(wordId))
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

export function resolveLevelsForUnit(
  unit: VocabularyUnit,
  options: GenerateLevelsOptions = {}
): Level[] {
  return generateLevelsFromUnit(unit, {
    ...options,
    words: options.words ?? getUnitWords(unit.bookId, unit.id)
  });
}

export function getLevelsForUnit(
  bookId: string,
  unitId: string,
  options: GenerateLevelsOptions = {}
) {
  const unit = getUnitById(bookId, unitId);
  return unit ? resolveLevelsForUnit(unit, options) : [];
}

export function getLevelsForBook(
  bookId: string,
  options: GenerateLevelsOptions = {}
) {
  return getUnitsForBook(bookId).flatMap((unit) => resolveLevelsForUnit(unit, options));
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
  const unitLevels = unit ? resolveLevelsForUnit(unit) : [];
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
