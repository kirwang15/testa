import {
  buildGrid,
  getCellKey,
  getCellsForWord,
  isCellVisible
} from "../../lib/game";
import type {
  CellKey,
  Level,
  LevelProgress,
  TargetWord
} from "@/types/game";

export function resolveActiveClue(
  level: Level,
  progress: LevelProgress,
  preferredWordId?: string
): TargetWord | undefined {
  const unsolvedWords = level.targetWords.filter(
    (word) => !progress.foundWords.includes(word.id)
  );

  return (
    unsolvedWords.find((word) => word.id === preferredWordId) ??
    unsolvedWords[0]
  );
}

export function getClueSelectionLabel(level: Level, wordId: string) {
  const index = level.targetWords.findIndex((word) => word.id === wordId);
  const word = level.targetWords[index];

  if (!word) {
    return "Select clue";
  }

  return `Clue ${index + 1}, ${word.direction}, ${word.word.length} letters`;
}

export type CrosswordDraftEntry = {
  cellKey: CellKey;
  letter: string;
  wheelIndex: number;
};

export type CrosswordDraft = {
  wordId?: string;
  entries: CrosswordDraftEntry[];
};

export type CrosswordDraftView = {
  cellLetters: Partial<Record<CellKey, string>>;
  selectedIndexes: number[];
  displayWord: string;
  submission: string;
  complete: boolean;
  editableCellCount: number;
  filledEditableCellCount: number;
};

export function createEmptyCrosswordDraft(wordId?: string): CrosswordDraft {
  return { wordId, entries: [] };
}

function getActiveWord(level: Level, wordId: string | undefined) {
  return level.targetWords.find((word) => word.id === wordId);
}

export function reconcileCrosswordDraft(
  level: Level,
  progress: LevelProgress,
  draft: CrosswordDraft,
  activeWordId: string | undefined
): CrosswordDraft {
  const activeWord = getActiveWord(level, activeWordId);
  if (!activeWord || draft.wordId !== activeWord.id) {
    return createEmptyCrosswordDraft(activeWord?.id);
  }

  const grid = buildGrid(level);
  const activeCellKeys = new Set(
    getCellsForWord(activeWord).map((cell) => getCellKey(cell.row, cell.col))
  );
  const seenCells = new Set<CellKey>();
  const seenWheelIndexes = new Set<number>();
  const entries = draft.entries.filter((entry) => {
    const cell = grid[entry.cellKey];
    const valid =
      activeCellKeys.has(entry.cellKey) &&
      Boolean(cell) &&
      !isCellVisible(cell, progress) &&
      /^[A-Z]$/.test(entry.letter) &&
      Number.isInteger(entry.wheelIndex) &&
      entry.wheelIndex >= 0 &&
      !seenCells.has(entry.cellKey) &&
      !seenWheelIndexes.has(entry.wheelIndex);

    if (valid) {
      seenCells.add(entry.cellKey);
      seenWheelIndexes.add(entry.wheelIndex);
    }
    return valid;
  });

  return { wordId: activeWord.id, entries };
}

export function addCrosswordDraftLetter(
  level: Level,
  progress: LevelProgress,
  draft: CrosswordDraft,
  activeWordId: string | undefined,
  letter: string,
  wheelIndex: number
): CrosswordDraft {
  const activeWord = getActiveWord(level, activeWordId);
  const normalizedLetter = letter.toUpperCase();
  const current = reconcileCrosswordDraft(level, progress, draft, activeWordId);
  if (
    !activeWord ||
    !/^[A-Z]$/.test(normalizedLetter) ||
    current.entries.some((entry) => entry.wheelIndex === wheelIndex)
  ) {
    return current;
  }

  const grid = buildGrid(level);
  const occupiedDraftCells = new Set(current.entries.map((entry) => entry.cellKey));
  const nextCell = getCellsForWord(activeWord).find((cell) => {
    const key = getCellKey(cell.row, cell.col);
    return !isCellVisible(grid[key], progress) && !occupiedDraftCells.has(key);
  });
  if (!nextCell) {
    return current;
  }

  return {
    wordId: activeWord.id,
    entries: [
      ...current.entries,
      {
        cellKey: getCellKey(nextCell.row, nextCell.col),
        letter: normalizedLetter,
        wheelIndex
      }
    ]
  };
}

export function removeLastCrosswordDraftLetter(
  level: Level,
  progress: LevelProgress,
  draft: CrosswordDraft,
  activeWordId: string | undefined
) {
  const current = reconcileCrosswordDraft(level, progress, draft, activeWordId);
  return { ...current, entries: current.entries.slice(0, -1) };
}

export function getDraftCellLetters(
  draft: CrosswordDraft
): Partial<Record<CellKey, string>> {
  return Object.fromEntries(
    draft.entries.map((entry) => [entry.cellKey, entry.letter])
  ) as Partial<Record<CellKey, string>>;
}

export function getCrosswordDraftView(
  level: Level,
  progress: LevelProgress,
  draft: CrosswordDraft,
  activeWordId: string | undefined
): CrosswordDraftView {
  const activeWord = getActiveWord(level, activeWordId);
  const current = reconcileCrosswordDraft(level, progress, draft, activeWordId);
  if (!activeWord) {
    return {
      cellLetters: {},
      selectedIndexes: [],
      displayWord: "",
      submission: "",
      complete: false,
      editableCellCount: 0,
      filledEditableCellCount: 0
    };
  }

  const grid = buildGrid(level);
  const cellLetters = getDraftCellLetters(current);
  let editableCellCount = 0;
  const letters = getCellsForWord(activeWord).map((cell) => {
    const key = getCellKey(cell.row, cell.col);
    const gridCell = grid[key];
    if (isCellVisible(gridCell, progress)) {
      return gridCell.letter;
    }
    editableCellCount += 1;
    return cellLetters[key] ?? "";
  });
  const complete = letters.every(Boolean);

  return {
    cellLetters,
    selectedIndexes: current.entries.map((entry) => entry.wheelIndex),
    displayWord: letters.map((letter) => letter || "·").join(""),
    submission: complete ? letters.join("") : "",
    complete,
    editableCellCount,
    filledEditableCellCount: current.entries.length
  };
}
