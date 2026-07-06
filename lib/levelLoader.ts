import { vocabularyLevels as manualLevels } from "../content/levels";
import {
  getAllBooks as getAllRegisteredBooks,
  getAllUnits as getAllRegisteredUnits,
  getBookById as getRegisteredBookById,
  getBookProgress as getRegisteredBookProgress,
  getLevelsForBook,
  getLevelsForUnit,
  getResolvedLevels,
  getUnitByGlobalId,
  getUnitProgress as getRegisteredUnitProgress,
  getUnitsForBook,
  resolveLevelsForUnit
} from "../src/lib/vocabulary-loader";
import type {
  BookProgress,
  GameProgress,
  Level,
  LevelProgress,
  UnitProgress,
  VocabularyBook,
  VocabularyUnit,
  WordLearningProgress
} from "@/types/game";

export type ProgressSummary = {
  totalLevels: number;
  completedLevels: number;
  completionRate: number;
};

export type ProgressStatus = "completed" | "recommended" | "available";

const books = getAllRegisteredBooks();
const units = getAllRegisteredUnits();
const primaryLevels: Level[] = getResolvedLevels({ mode: "learning" });
const primaryLevelIdSet = new Set(primaryLevels.map((level) => level.id));
const addressableLevels: Level[] = [
  ...primaryLevels,
  ...manualLevels.filter((level) => !primaryLevelIdSet.has(level.id))
];

export function getAllBooks() {
  return books;
}

export function getAllUnits() {
  return units;
}

export function getAllLevels() {
  return primaryLevels;
}

export function getAllLevelIds() {
  return primaryLevels.map((level) => level.id);
}

export function getFirstLevel() {
  return primaryLevels[0];
}

export function getInitialUnlockedLevelIds() {
  return getAllLevelIds();
}

export function getBookById(bookId: string) {
  return getRegisteredBookById(bookId);
}

export function getUnitById(unitId: string) {
  return getUnitByGlobalId(unitId);
}

export function getLevelById(levelId: string) {
  return addressableLevels.find((level) => level.id === levelId);
}

export function levelExists(levelId: string) {
  return Boolean(getLevelById(levelId));
}

export function bookExists(bookId: string) {
  return Boolean(getBookById(bookId));
}

export function unitExists(unitId: string) {
  return Boolean(getUnitById(unitId));
}

export function getUnitsByBookId(bookId: string) {
  return getUnitsForBook(bookId);
}

export function getLevelsByBookId(bookId: string) {
  return getLevelsForBook(bookId, { mode: "learning" });
}

export function getLevelsByUnitId(unitId: string) {
  const unit = getUnitById(unitId);
  return unit ? resolveLevelsForUnit(unit, { mode: "learning" }) : [];
}

export function getBookForUnit(unit: VocabularyUnit) {
  return getBookById(unit.bookId);
}

export function getUnitForLevel(levelId: string) {
  const level = getLevelById(levelId);
  return level ? getUnitById(level.unitId) : undefined;
}

export function getBookForLevel(levelId: string) {
  const level = getLevelById(levelId);
  return level ? getBookById(level.bookId) : undefined;
}

export function getNextLevel(levelId: string) {
  const currentIndex = primaryLevels.findIndex((level) => level.id === levelId);

  if (currentIndex === -1) {
    return undefined;
  }

  return primaryLevels[currentIndex + 1];
}

export function getRecommendedLevel(progressByLevelId: Record<string, LevelProgress>) {
  return primaryLevels.find((level) => !progressByLevelId[level.id]?.completed);
}

export function getUnlockedLevelIdsFromProgress(
  _progressByLevelId: Record<string, LevelProgress>
) {
  return getAllLevelIds();
}

export function getNextUnlockedLevel(
  progressByLevelId: Record<string, LevelProgress>,
  _unlockedLevelIds: string[]
) {
  return getRecommendedLevel(progressByLevelId);
}

export function getRecommendedBook(
  progressByLevelId: Record<string, LevelProgress>
) {
  const recommendedLevel = getRecommendedLevel(progressByLevelId);
  return recommendedLevel ? getBookById(recommendedLevel.bookId) : undefined;
}

export function getRecommendedUnit(
  progressByLevelId: Record<string, LevelProgress>
) {
  const recommendedLevel = getRecommendedLevel(progressByLevelId);
  return recommendedLevel ? getUnitById(recommendedLevel.unitId) : undefined;
}

export function getLevelOrderIndex(levelId: string) {
  return primaryLevels.findIndex((level) => level.id === levelId);
}

export function isLevelAheadOfRecommendation(
  levelId: string,
  progressByLevelId: Record<string, LevelProgress>
) {
  const recommendedLevel = getRecommendedLevel(progressByLevelId);

  if (!recommendedLevel) {
    return false;
  }

  const currentIndex = getLevelOrderIndex(levelId);
  const recommendedIndex = getLevelOrderIndex(recommendedLevel.id);

  return currentIndex > recommendedIndex;
}

export function getLevelStatus(
  levelId: string,
  progressByLevelId: Record<string, LevelProgress>
): ProgressStatus {
  if (progressByLevelId[levelId]?.completed) {
    return "completed";
  }

  return getRecommendedLevel(progressByLevelId)?.id === levelId
    ? "recommended"
    : "available";
}

export function getUnitStatus(
  unitId: string,
  progressByLevelId: Record<string, LevelProgress>
): ProgressStatus {
  const unitLevels = getLevelsByUnitId(unitId);

  if (
    unitLevels.length > 0 &&
    unitLevels.every((level) => progressByLevelId[level.id]?.completed)
  ) {
    return "completed";
  }

  const recommendedLevel = getRecommendedLevel(progressByLevelId);

  return recommendedLevel && recommendedLevel.unitId === unitId
    ? "recommended"
    : "available";
}

export function getBookStatus(
  bookId: string,
  progressByLevelId: Record<string, LevelProgress>
): ProgressStatus {
  const bookLevels = getLevelsByBookId(bookId);

  if (
    bookLevels.length > 0 &&
    bookLevels.every((level) => progressByLevelId[level.id]?.completed)
  ) {
    return "completed";
  }

  const recommendedLevel = getRecommendedLevel(progressByLevelId);

  return recommendedLevel && recommendedLevel.bookId === bookId
    ? "recommended"
    : "available";
}

export function getProgressSummary(
  progressByLevelId: Record<string, LevelProgress>
): ProgressSummary {
  const completedLevels = primaryLevels.filter(
    (level) => progressByLevelId[level.id]?.completed
  ).length;

  return {
    totalLevels: primaryLevels.length,
    completedLevels,
    completionRate:
      primaryLevels.length === 0
        ? 0
        : Math.round((completedLevels / primaryLevels.length) * 100)
  };
}

export function getUnitProgress(
  unitId: string,
  progressByLevelId: Record<string, LevelProgress>,
  progressByWordId: Record<string, WordLearningProgress> = {}
): UnitProgress {
  return getRegisteredUnitProgress(unitId, progressByLevelId, progressByWordId);
}

export function getBookProgress(
  bookId: string,
  progressByLevelId: Record<string, LevelProgress>,
  progressByWordId: Record<string, WordLearningProgress> = {}
): BookProgress {
  return getRegisteredBookProgress(bookId, progressByLevelId, progressByWordId);
}

export function getBookProgressMap(progress: GameProgress) {
  return books.reduce<Record<string, BookProgress>>((map, book) => {
    map[book.id] = getBookProgress(book.id, progress.levels, progress.words);
    return map;
  }, {});
}

export function getUnitProgressMap(progress: GameProgress) {
  return units.reduce<Record<string, UnitProgress>>((map, unit) => {
    map[unit.id] = getUnitProgress(unit.id, progress.levels, progress.words);
    return map;
  }, {});
}

export function getPrimaryBooks() {
  return books;
}

export function getPrimaryUnitsForBook(bookId: string) {
  return getUnitsByBookId(bookId);
}

export function getPrimaryLevelsForUnit(bookId: string, unitId: string) {
  const unit = getUnitById(unitId);

  if (!unit || unit.bookId !== bookId) {
    return [];
  }

  return getLevelsForUnit(bookId, unitId, { mode: "learning" });
}

export { resolveLevelsForUnit };
