import generatedIndex from "../src/content/vocabulary/generated/curriculum-index.json";
import {
  getContentRatingForLevelId,
  getProgressLevelById
} from "./curriculum-progress-index";
import type {
  BookProgress,
  CurriculumBookIndex,
  CurriculumCourseIndex,
  CurriculumIndex,
  CurriculumLevelIndex,
  CurriculumTrackIndex,
  CurriculumUnitIndex,
  GameProgress,
  LevelProgress,
  UnitProgress,
  WordLearningProgress
} from "../types/game";

const index = generatedIndex as CurriculumIndex;
const books = index.books as CurriculumBookIndex[];
const units = index.units as CurriculumUnitIndex[];
function hydrateLevel(level: CurriculumLevelIndex): CurriculumLevelIndex {
  const compact = getProgressLevelById(level.id);
  const nce = /^nce-1997-b([1-4])-level-(\d{3})$/.exec(level.id);
  if (nce) {
    const book = Number(nce[1]);
    const levelNumber = Number(nce[2]);
    const unit = Math.floor((((levelNumber - 1) % 50)) / 10) + 1;
    return {
      ...level,
      bookId: `nce-1997-b${book}`,
      unitId: `nce-1997-b${book}-u${unit}`,
      curriculumId: "nce-1997",
      trackId: `nce-1997-b${book}`,
      levelNumber,
      difficulty: ((levelNumber - 1) % 50) < 10 ? "easy" : "medium",
      wordCount: compact?.wordCount ?? 0,
      rating: getContentRatingForLevelId(level.id),
      releaseStatus: "automated-beta"
    };
  }
  const course = /^(ielts-nawl-v1|kaoyan-core-v1)-level-(\d{3})$/.exec(level.id);
  if (!course) return level;
  const stage = Math.ceil(Number(course[2]) / 50);
  const levelNumber = Number(course[2]);
  return {
    ...level,
    bookId: `${course[1]}-s${stage}`,
    unitId: `${course[1]}-s${stage}`,
    curriculumId: course[1],
    trackId: `${course[1]}-s${stage}`,
    levelNumber,
    difficulty: levelNumber <= 100 ? "easy" : "medium",
    wordCount: compact?.wordCount ?? 3,
    rating: getContentRatingForLevelId(level.id),
    releaseStatus: "automated-beta"
  };
}

const levels = (index.levels as CurriculumLevelIndex[]).map(hydrateLevel);
const curricula = (index.curricula ?? []) as CurriculumCourseIndex[];
const tracks = (index.tracks ?? []) as CurriculumTrackIndex[];
const booksById = new Map(books.map((book) => [book.id, book]));
const unitsById = new Map(units.map((unit) => [unit.id, unit]));
const levelsById = new Map(levels.map((level) => [level.id, level]));
const curriculaById = new Map(curricula.map((course) => [course.id, course]));
const tracksById = new Map(tracks.map((track) => [track.id, track]));

export type ProgressSummary = {
  totalLevels: number;
  completedLevels: number;
  completionRate: number;
};

export type ProgressStatus = "completed" | "recommended" | "available";

export const curriculumContentVersion = index.contentVersion;

export function getCurriculumIndex() {
  return index;
}

export function getAllBooks() {
  return books;
}

export function getAllUnits() {
  return units;
}

export function getAllLevels() {
  return levels;
}

export function getAllCurricula() {
  return curricula;
}

export function getCurriculumById(curriculumId: string) {
  return curriculaById.get(curriculumId);
}

export function getTracksByCurriculumId(curriculumId: string) {
  return tracks.filter((track) => track.curriculumId === curriculumId);
}

export function getTrackById(trackId: string) {
  return tracksById.get(trackId);
}

export function getLevelsByCurriculumId(curriculumId: string) {
  return levels.filter((level) => level.curriculumId === curriculumId);
}

export function getLevelsByTrackId(trackId: string) {
  return levels.filter((level) => level.trackId === trackId);
}

export function getAllLevelIds() {
  return levels.map((level) => level.id);
}

export function getFirstLevel() {
  return levels[0];
}

export function getBookById(bookId: string) {
  return booksById.get(bookId);
}

export function getUnitById(unitId: string) {
  return unitsById.get(unitId);
}

export function getLevelById(levelId: string) {
  return levelsById.get(levelId);
}

export function levelExists(levelId: string) {
  return levelsById.has(levelId);
}

export function isLegacyLevelRoute(levelId: string) {
  return /^(?:legacy:)?nce-[1-4]-u\d+-level-\d+$/.test(levelId);
}

export function bookExists(bookId: string) {
  return booksById.has(bookId);
}

export function unitExists(unitId: string) {
  return unitsById.has(unitId);
}

export function getUnitsByBookId(bookId: string) {
  return units.filter((unit) => unit.bookId === bookId);
}

export function getLevelsByBookId(bookId: string) {
  return levels.filter((level) => level.bookId === bookId);
}

export function getLevelsByUnitId(unitId: string) {
  return levels.filter((level) => level.unitId === unitId);
}

export function getNextLevel(levelId: string) {
  const currentIndex = levels.findIndex((level) => level.id === levelId);
  return currentIndex >= 0 ? levels[currentIndex + 1] : undefined;
}

export function getRecommendedLevel(
  progressByLevelId: Record<string, LevelProgress>
) {
  return levels.find((level) => !progressByLevelId[level.id]?.completed);
}

export function getLevelOrderIndex(levelId: string) {
  return levels.findIndex((level) => level.id === levelId);
}

export function isLevelAheadOfRecommendation(
  levelId: string,
  progressByLevelId: Record<string, LevelProgress>
) {
  const recommended = getRecommendedLevel(progressByLevelId);
  if (!recommended) return false;
  return getLevelOrderIndex(levelId) > getLevelOrderIndex(recommended.id);
}

export function getLevelStatus(
  levelId: string,
  progressByLevelId: Record<string, LevelProgress>
): ProgressStatus {
  if (progressByLevelId[levelId]?.completed) return "completed";
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
  return getRecommendedLevel(progressByLevelId)?.unitId === unitId
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
  return getRecommendedLevel(progressByLevelId)?.bookId === bookId
    ? "recommended"
    : "available";
}

export function getProgressSummary(
  progressByLevelId: Record<string, LevelProgress>
): ProgressSummary {
  return getProgressSummaryForLevels(levels, progressByLevelId);
}

export function getProgressSummaryForLevels(
  selectedLevels: readonly CurriculumLevelIndex[],
  progressByLevelId: Record<string, LevelProgress>
): ProgressSummary {
  const completedLevels = selectedLevels.filter(
    (level) => progressByLevelId[level.id]?.completed
  ).length;
  return {
    totalLevels: selectedLevels.length,
    completedLevels,
    completionRate:
      selectedLevels.length === 0
        ? 0
        : Math.round((completedLevels / selectedLevels.length) * 100)
  };
}

function summarizeLevels(
  selectedLevels: CurriculumLevelIndex[],
  progressByLevelId: Record<string, LevelProgress>
) {
  const totalWords = selectedLevels.reduce((sum, level) => sum + level.wordCount, 0);
  const completedLevels = selectedLevels.filter(
    (level) => progressByLevelId[level.id]?.completed
  ).length;
  const foundWords = selectedLevels.reduce(
    (sum, level) =>
      sum + Math.min(level.wordCount, progressByLevelId[level.id]?.foundWords.length ?? 0),
    0
  );
  return { totalWords, completedLevels, foundWords };
}

function summarizeBookWords(
  bookId: string,
  progressByWordId: Record<string, WordLearningProgress>
) {
  const prefix = `${bookId}-`;
  const progress = Object.values(progressByWordId).filter((word) =>
    word.wordId.startsWith(prefix)
  );
  return {
    learnedWords: progress.filter(
      (word) => word.correctCount > 0 || word.masteryLevel > 0
    ).length,
    masteredWords: progress.filter((word) => word.masteryLevel >= 4).length,
    difficultWords: progress.filter((word) => word.difficult).length
  };
}

export function getUnitProgress(
  unitId: string,
  progressByLevelId: Record<string, LevelProgress>,
  _progressByWordId: Record<string, WordLearningProgress> = {}
): UnitProgress {
  const unit = getUnitById(unitId);
  const unitLevels = getLevelsByUnitId(unitId);
  const summary = summarizeLevels(unitLevels, progressByLevelId);
  return {
    unitId,
    bookId: unit?.bookId ?? "",
    totalLevels: unitLevels.length,
    completedLevels: summary.completedLevels,
    totalWords: summary.totalWords,
    foundWords: summary.foundWords,
    learnedWords: summary.foundWords,
    masteredWords: 0,
    difficultWords: 0,
    completionPercent:
      unitLevels.length === 0
        ? 0
        : Math.round((summary.completedLevels / unitLevels.length) * 100)
  };
}

export function getBookProgress(
  bookId: string,
  progressByLevelId: Record<string, LevelProgress>,
  progressByWordId: Record<string, WordLearningProgress> = {}
): BookProgress {
  const book = getBookById(bookId);
  const bookUnits = getUnitsByBookId(bookId);
  const bookLevels = getLevelsByBookId(bookId);
  const summary = summarizeLevels(bookLevels, progressByLevelId);
  const wordSummary = summarizeBookWords(bookId, progressByWordId);
  const completedUnits = bookUnits.filter((unit) =>
    getLevelsByUnitId(unit.id).every((level) => progressByLevelId[level.id]?.completed)
  ).length;
  return {
    bookId,
    totalUnits: book?.unitIds.length ?? 0,
    completedUnits,
    totalLevels: bookLevels.length,
    completedLevels: summary.completedLevels,
    totalWords: summary.totalWords,
    foundWords: summary.foundWords,
    ...wordSummary,
    completionPercent:
      bookLevels.length === 0
        ? 0
        : Math.round((summary.completedLevels / bookLevels.length) * 100)
  };
}

export function getBookProgressMap(progress: GameProgress) {
  return books.reduce<Record<string, BookProgress>>((map, book) => {
    map[book.id] = getBookProgress(book.id, progress.levels, progress.words);
    return map;
  }, {});
}
