import {
  getAllBooks,
  getLevelsByBookId,
  getUnitsByBookId
} from "./curriculum-index";
import type {
  CurriculumBookIndex,
  CurriculumLevelIndex,
  CurriculumUnitIndex,
  LevelDifficulty
} from "../types/game";

export type CurriculumPosition = {
  book: number;
  unit?: number;
  level?: number;
};

export function getBookNumber(bookId: string) {
  const index = getAllBooks().findIndex((book) => book.id === bookId);
  return index >= 0 ? index + 1 : 1;
}

export function getUnitNumber(unit: Pick<CurriculumUnitIndex, "id" | "bookId">) {
  const index = getUnitsByBookId(unit.bookId).findIndex(
    (candidate) => candidate.id === unit.id
  );
  return index >= 0 ? index + 1 : 1;
}

export function getLevelNumber(
  level: Pick<CurriculumLevelIndex, "id" | "bookId">
) {
  const index = getLevelsByBookId(level.bookId).findIndex(
    (candidate) => candidate.id === level.id
  );
  return index >= 0 ? index + 1 : 1;
}

export function getBookPosition(
  book: Pick<CurriculumBookIndex, "id">
): CurriculumPosition {
  return { book: getBookNumber(book.id) };
}

export function getUnitPosition(
  unit: Pick<CurriculumUnitIndex, "id" | "bookId">
): CurriculumPosition {
  return {
    book: getBookNumber(unit.bookId),
    unit: getUnitNumber(unit)
  };
}

export function getLevelPosition(
  level: Pick<CurriculumLevelIndex, "id" | "bookId">
): CurriculumPosition {
  return {
    book: getBookNumber(level.bookId),
    level: getLevelNumber(level)
  };
}

export function getLessonRangeLabelValue(lessonRange?: string) {
  const values = lessonRange?.match(/\d+/g);
  return values?.length ? values.join("–") : undefined;
}

export function getDifficultyTranslationKey(difficulty?: LevelDifficulty) {
  return difficulty === "medium"
    ? ("level.challenge" as const)
    : ("level.starter" as const);
}
