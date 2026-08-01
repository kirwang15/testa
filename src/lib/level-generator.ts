import {
  normalizeConceptKey,
  normalizeMeaningKey,
  normalizeWordKey
} from "./vocabulary-uniqueness";
import type {
  Coordinate,
  Direction,
  GridSize,
  Level,
  LevelDifficulty,
  TargetWord,
  VocabularyBook,
  VocabularyGenerationMode,
  VocabularyUnit,
  VocabularyWord
} from "@/types/game";

const MIN_WORD_LENGTH = 3;
const MIN_WORDS_PER_LEVEL = 3;
const MAX_WORDS_PER_LEVEL = 5;
const DEFAULT_WORDS_PER_LEVEL = 4;
const DEFAULT_UNIQUENESS_WINDOW = 2;

type PreparedWord = VocabularyWord & {
  normalizedWord: string;
  normalizedMeaning: string;
  normalizedConcept: string;
  difficultyValue: number;
};

export type GenerateLevelsOptions = {
  mode?: VocabularyGenerationMode;
  words?: VocabularyWord[];
  idPrefix?: string;
  titlePrefix?: string;
  difficulty?: LevelDifficulty;
  rewardCoins?: number;
  perfectBonusCoins?: number;
  uniquenessWindow?: number;
  units?: VocabularyUnit[];
  getWordsForUnit?: (unit: VocabularyUnit) => VocabularyWord[];
};

type GenerateSingleLevelOptions = Omit<
  GenerateLevelsOptions,
  "words" | "units" | "getWordsForUnit"
> & {
  id?: string;
  bookId?: string;
  unitId?: string;
  title?: string;
  requireConnected?: boolean;
  maxGridSize?: number;
  manifestVersion?: string;
};

export function normalizeWord(word: string) {
  const compactWord = word.trim().replace(/\s+/g, "");

  if (!/^[A-Za-z]+$/.test(compactWord)) {
    return "";
  }

  return compactWord.toUpperCase();
}

function createWordClue(word: VocabularyWord) {
  return word.englishMeaning || `Practice word: ${word.displayText.toLowerCase()}`;
}

function prepareWords(words: VocabularyWord[]) {
  return words.reduce<PreparedWord[]>((preparedWords, word) => {
    const normalizedWord = normalizeWord(word.word);

    if (!normalizedWord || normalizedWord.length < MIN_WORD_LENGTH) {
      return preparedWords;
    }

    preparedWords.push({
      ...word,
      normalizedWord,
      normalizedMeaning: normalizeMeaningKey(word.chineseMeaning),
      normalizedConcept: normalizeConceptKey(word.learningConcept),
      difficultyValue: word.difficulty ?? 1
    });
    return preparedWords;
  }, []);
}

function getLevelDifficulty(words: PreparedWord[]): LevelDifficulty {
  const highestDifficulty = Math.max(...words.map((word) => word.difficultyValue), 1);
  return highestDifficulty >= 2 ? "medium" : "easy";
}

function getRewardCoins(words: PreparedWord[], difficulty: LevelDifficulty) {
  return 20 + (words.length - MIN_WORDS_PER_LEVEL) * 5 + (difficulty === "medium" ? 5 : 0);
}

function getPerfectBonusCoins(difficulty: LevelDifficulty) {
  return difficulty === "medium" ? 8 : 5;
}

export type CrosswordPlacement = {
  index: number;
  word: string;
  start: Coordinate;
  direction: Direction;
};

export type CrosswordLayout = {
  placements: CrosswordPlacement[];
  grid: GridSize;
};

export type CrosswordLayoutAnalysis = {
  connected: boolean;
  componentCount: number;
  crossingCount: number;
  hasAcrossAndDown: boolean;
  conflicts: string[];
  unexpectedRuns: string[];
  withinGrid: boolean;
};

type OccupiedLayoutCell = {
  letter: string;
  directions: Set<Direction>;
};

type PlacementCandidate = CrosswordPlacement & {
  crossings: number;
  area: number;
};

type LayoutSearchState = {
  placements: CrosswordPlacement[];
  remaining: Array<{ index: number; word: string }>;
  crossings: number;
  disconnectedCount: number;
};

const MAX_LAYOUT_SEARCH_STATES = 320;
const MAX_CANDIDATES_PER_WORD = 24;
const MAX_CONNECTED_SEARCH_VISITS = 100_000;

function getLayoutCellKey(row: number, col: number) {
  return `${row}:${col}`;
}

function getPlacementCells(placement: CrosswordPlacement) {
  return placement.word.split("").map((letter, offset) => ({
    row: placement.start.row + (placement.direction === "down" ? offset : 0),
    col: placement.start.col + (placement.direction === "across" ? offset : 0),
    letter
  }));
}

function buildOccupiedLayout(placements: CrosswordPlacement[]) {
  const occupied = new Map<string, OccupiedLayoutCell>();

  for (const placement of placements) {
    for (const cell of getPlacementCells(placement)) {
      const key = getLayoutCellKey(cell.row, cell.col);
      const existing = occupied.get(key);

      if (existing) {
        existing.directions.add(placement.direction);
      } else {
        occupied.set(key, {
          letter: cell.letter,
          directions: new Set([placement.direction])
        });
      }
    }
  }

  return occupied;
}

function getLayoutBounds(placements: CrosswordPlacement[]) {
  const cells = placements.flatMap(getPlacementCells);
  const rows = cells.map((cell) => cell.row);
  const cols = cells.map((cell) => cell.col);

  return {
    minRow: Math.min(...rows),
    maxRow: Math.max(...rows),
    minCol: Math.min(...cols),
    maxCol: Math.max(...cols)
  };
}

function placementFits(
  placement: CrosswordPlacement,
  occupied: Map<string, OccupiedLayoutCell>
) {
  const cells = getPlacementCells(placement);
  const before = placement.direction === "across"
    ? { row: placement.start.row, col: placement.start.col - 1 }
    : { row: placement.start.row - 1, col: placement.start.col };
  const afterCell = cells[cells.length - 1];
  const after = placement.direction === "across"
    ? { row: afterCell.row, col: afterCell.col + 1 }
    : { row: afterCell.row + 1, col: afterCell.col };

  if (
    occupied.has(getLayoutCellKey(before.row, before.col)) ||
    occupied.has(getLayoutCellKey(after.row, after.col))
  ) {
    return false;
  }

  for (const cell of cells) {
    const key = getLayoutCellKey(cell.row, cell.col);
    const existing = occupied.get(key);

    if (existing) {
      if (
        existing.letter !== cell.letter ||
        existing.directions.has(placement.direction)
      ) {
        return false;
      }
      continue;
    }

    const sideCells = placement.direction === "across"
      ? [
          { row: cell.row - 1, col: cell.col },
          { row: cell.row + 1, col: cell.col }
        ]
      : [
          { row: cell.row, col: cell.col - 1 },
          { row: cell.row, col: cell.col + 1 }
        ];

    if (sideCells.some((side) => occupied.has(getLayoutCellKey(side.row, side.col)))) {
      return false;
    }
  }

  return true;
}

function scoreCandidate(
  placement: CrosswordPlacement,
  placements: CrosswordPlacement[],
  occupied: Map<string, OccupiedLayoutCell>
): PlacementCandidate {
  const crossings = getPlacementCells(placement).filter((cell) =>
    occupied.has(getLayoutCellKey(cell.row, cell.col))
  ).length;
  const bounds = getLayoutBounds([...placements, placement]);

  return {
    ...placement,
    crossings,
    area:
      (bounds.maxRow - bounds.minRow + 1) *
      (bounds.maxCol - bounds.minCol + 1)
  };
}

function compareCandidates(left: PlacementCandidate, right: PlacementCandidate) {
  return (
    right.crossings - left.crossings ||
    left.area - right.area ||
    left.start.row - right.start.row ||
    left.start.col - right.start.col ||
    left.direction.localeCompare(right.direction)
  );
}

function findCrossingPlacements(
  entry: { index: number; word: string },
  placements: CrosswordPlacement[]
) {
  const occupied = buildOccupiedLayout(placements);
  const occupiedEntries = [...occupied.entries()]
    .map(([key, cell]) => {
      const [row, col] = key.split(":").map(Number);
      return { row, col, cell };
    })
    .sort((left, right) => left.row - right.row || left.col - right.col);
  const candidates = new Map<string, PlacementCandidate>();

  entry.word.split("").forEach((letter, offset) => {
    for (const occupiedEntry of occupiedEntries) {
      if (occupiedEntry.cell.letter !== letter) {
        continue;
      }

      const availableDirections: Direction[] = (["across", "down"] as const)
        .filter((direction) => !occupiedEntry.cell.directions.has(direction));

      for (const direction of availableDirections) {
        const placement: CrosswordPlacement = {
          ...entry,
          direction,
          start: {
            row: occupiedEntry.row - (direction === "down" ? offset : 0),
            col: occupiedEntry.col - (direction === "across" ? offset : 0)
          }
        };

        if (!placementFits(placement, occupied)) {
          continue;
        }

        const key = `${placement.start.row}:${placement.start.col}:${direction}`;
        candidates.set(key, scoreCandidate(placement, placements, occupied));
      }
    }
  });

  return [...candidates.values()].sort(compareCandidates);
}

function toCrosswordPlacement(candidate: CrosswordPlacement): CrosswordPlacement {
  return {
    index: candidate.index,
    word: candidate.word,
    start: candidate.start,
    direction: candidate.direction
  };
}

function compareLayoutSearchStates(
  left: LayoutSearchState,
  right: LayoutSearchState
) {
  const leftBounds = getLayoutBounds(left.placements);
  const rightBounds = getLayoutBounds(right.placements);
  const leftArea =
    (leftBounds.maxRow - leftBounds.minRow + 1) *
    (leftBounds.maxCol - leftBounds.minCol + 1);
  const rightArea =
    (rightBounds.maxRow - rightBounds.minRow + 1) *
    (rightBounds.maxCol - rightBounds.minCol + 1);
  const leftSignature = left.placements
    .map((placement) =>
      `${placement.index}:${placement.start.row}:${placement.start.col}:${placement.direction}`
    )
    .join("|");
  const rightSignature = right.placements
    .map((placement) =>
      `${placement.index}:${placement.start.row}:${placement.start.col}:${placement.direction}`
    )
    .join("|");

  return (
    left.disconnectedCount - right.disconnectedCount ||
    right.crossings - left.crossings ||
    leftArea - rightArea ||
    leftSignature.localeCompare(rightSignature)
  );
}

function createDisconnectedPlacement(
  entry: { index: number; word: string },
  placements: CrosswordPlacement[]
) {
  const occupied = buildOccupiedLayout(placements);
  const bounds = getLayoutBounds(placements);
  const direction: Direction = placements.length % 2 === 1 ? "down" : "across";
  let placement: CrosswordPlacement = direction === "down"
    ? {
        ...entry,
        direction,
        start: { row: bounds.minRow, col: bounds.maxCol + 2 }
      }
    : {
        ...entry,
        direction,
        start: { row: bounds.maxRow + 2, col: bounds.minCol }
      };

  while (!placementFits(placement, occupied)) {
    placement = {
      ...placement,
      start: direction === "down"
        ? { row: placement.start.row, col: placement.start.col + 1 }
        : { row: placement.start.row + 1, col: placement.start.col }
    };
  }

  return placement;
}

function allWordsCanShareOneComponent(
  entries: Array<{ index: number; word: string }>
) {
  const connected = new Set<number>([entries[0]?.index]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const entry of entries) {
      if (connected.has(entry.index)) {
        continue;
      }

      const sharesLetter = entries.some(
        (candidate) =>
          connected.has(candidate.index) &&
          entry.word.split("").some((letter) => candidate.word.includes(letter))
      );

      if (sharesLetter) {
        connected.add(entry.index);
        changed = true;
      }
    }
  }

  return connected.size === entries.length;
}

function getNormalizedPlacementSignature(
  placements: CrosswordPlacement[],
  remaining: Array<{ index: number; word: string }>
) {
  const bounds = getLayoutBounds(placements);
  const placementSignature = [...placements]
    .sort((left, right) => left.index - right.index)
    .map(
      (placement) =>
        `${placement.index}:${placement.start.row - bounds.minRow}:${placement.start.col - bounds.minCol}:${placement.direction}`
    )
    .join("|");
  const remainingSignature = remaining
    .map((entry) => entry.index)
    .sort((left, right) => left - right)
    .join(",");

  return `${placementSignature}#${remainingSignature}`;
}

function placementsFitGridLimit(
  placements: CrosswordPlacement[],
  maxGridSize?: number
) {
  if (!maxGridSize || placements.length === 0) {
    return true;
  }
  const bounds = getLayoutBounds(placements);
  return (
    bounds.maxRow - bounds.minRow + 1 <= maxGridSize &&
    bounds.maxCol - bounds.minCol + 1 <= maxGridSize
  );
}

function findFullyConnectedLayout(
  entries: Array<{ index: number; word: string }>,
  maxGridSize?: number
) {
  if (!allWordsCanShareOneComponent(entries)) {
    return undefined;
  }

  const visited = new Set<string>();
  let visits = 0;
  const visitLimit = entries.length <= 4
    ? Number.POSITIVE_INFINITY
    : MAX_CONNECTED_SEARCH_VISITS;

  const search = (
    placements: CrosswordPlacement[],
    remaining: Array<{ index: number; word: string }>
  ): CrosswordPlacement[] | undefined => {
    visits += 1;
    if (visits > visitLimit) {
      return undefined;
    }
    if (!placementsFitGridLimit(placements, maxGridSize)) {
      return undefined;
    }
    if (remaining.length === 0) {
      return placements;
    }

    const signature = getNormalizedPlacementSignature(placements, remaining);
    if (visited.has(signature)) {
      return undefined;
    }
    visited.add(signature);

    const nextOptions = remaining.flatMap((entry) =>
      findCrossingPlacements(entry, placements).map((candidate) => ({
        entry,
        candidate
      }))
    );
    nextOptions.sort(
      (left, right) =>
        compareCandidates(left.candidate, right.candidate) ||
        left.entry.index - right.entry.index
    );

    for (const option of nextOptions) {
      const result = search(
        [...placements, toCrosswordPlacement(option.candidate)],
        remaining.filter((entry) => entry.index !== option.entry.index)
      );
      if (result) {
        return result;
      }
    }

    return undefined;
  };

  for (const seed of entries) {
    const result = search(
      [
        {
          ...seed,
          start: { row: 0, col: 0 },
          direction: "across"
        }
      ],
      entries.filter((entry) => entry.index !== seed.index)
    );
    if (result) {
      return result;
    }
  }

  return undefined;
}

function normalizeLayoutPlacements(
  placements: CrosswordPlacement[]
): CrosswordLayout {
  if (placements.length === 0) {
    return { placements: [], grid: { rows: 0, cols: 0 } };
  }

  const bounds = getLayoutBounds(placements);

  return {
    placements: placements
      .map((placement) => ({
        ...placement,
        start: {
          row: placement.start.row - bounds.minRow,
          col: placement.start.col - bounds.minCol
        }
      }))
      .sort((left, right) => left.index - right.index),
    grid: {
      rows: bounds.maxRow - bounds.minRow + 1,
      cols: bounds.maxCol - bounds.minCol + 1
    }
  };
}

export function createConnectedCrosswordLayout(
  words: string[],
  maxGridSize?: number
): CrosswordLayout | undefined {
  const entries = words.map((word, index) => ({
    index,
    word: normalizeWord(word)
  }));

  if (entries.length === 0 || entries.some((entry) => !entry.word)) {
    return undefined;
  }

  const orderedEntries = [...entries].sort(
    (left, right) =>
      right.word.length - left.word.length ||
      left.word.localeCompare(right.word) ||
      left.index - right.index
  );
  const placements = findFullyConnectedLayout(orderedEntries, maxGridSize);

  return placements ? normalizeLayoutPlacements(placements) : undefined;
}

export function createCrosswordLayout(words: string[]): CrosswordLayout {
  const entries = words.map((word, index) => ({
    index,
    word: normalizeWord(word)
  }));

  if (entries.length === 0 || entries.some((entry) => !entry.word)) {
    return { placements: [], grid: { rows: 0, cols: 0 } };
  }

  const orderedEntries = [...entries].sort(
    (left, right) =>
      right.word.length - left.word.length ||
      left.word.localeCompare(right.word) ||
      left.index - right.index
  );
  const connectedLayout = createConnectedCrosswordLayout(words);
  const fullyConnectedPlacements = connectedLayout?.placements;
  let searchStates: LayoutSearchState[] = fullyConnectedPlacements
    ? [
        {
          placements: fullyConnectedPlacements,
          remaining: [],
          crossings: 0,
          disconnectedCount: 0
        }
      ]
    : orderedEntries.map((seed) => ({
    placements: [
      {
        ...seed,
        start: { row: 0, col: 0 },
        direction: "across"
      }
    ],
    remaining: orderedEntries.filter((entry) => entry.index !== seed.index),
    crossings: 0,
    disconnectedCount: 0
  }));

  while (searchStates[0]?.remaining.length) {
    const nextStates: LayoutSearchState[] = [];

    for (const state of searchStates) {
      let foundCrossingCandidate = false;

      for (const entry of state.remaining) {
        const candidates = findCrossingPlacements(entry, state.placements)
          .slice(0, MAX_CANDIDATES_PER_WORD);

        if (candidates.length > 0) {
          foundCrossingCandidate = true;
        }

        for (const candidate of candidates) {
          nextStates.push({
            placements: [
              ...state.placements,
              toCrosswordPlacement(candidate)
            ],
            remaining: state.remaining.filter(
              (remainingEntry) => remainingEntry.index !== entry.index
            ),
            crossings: state.crossings + candidate.crossings,
            disconnectedCount: state.disconnectedCount
          });
        }
      }

      if (!foundCrossingCandidate) {
        for (const entry of state.remaining) {
          nextStates.push({
            placements: [
              ...state.placements,
              createDisconnectedPlacement(entry, state.placements)
            ],
            remaining: state.remaining.filter(
              (remainingEntry) => remainingEntry.index !== entry.index
            ),
            crossings: state.crossings,
            disconnectedCount: state.disconnectedCount + 1
          });
        }
      }
    }

    searchStates = nextStates
      .sort(compareLayoutSearchStates)
      .slice(0, MAX_LAYOUT_SEARCH_STATES);
  }

  const placements = searchStates.sort(compareLayoutSearchStates)[0]?.placements ?? [];

  if (placements.length === 0) {
    return { placements: [], grid: { rows: 0, cols: 0 } };
  }

  return normalizeLayoutPlacements(placements);
}

export function analyzeCrosswordLayout(
  layout: CrosswordLayout
): CrosswordLayoutAnalysis {
  const conflicts: string[] = [];
  const occupied = new Map<
    string,
    { letter: string; placements: number[]; directions: Direction[] }
  >();

  layout.placements.forEach((placement, placementIndex) => {
    for (const cell of getPlacementCells(placement)) {
      const key = getLayoutCellKey(cell.row, cell.col);
      const existing = occupied.get(key);

      if (!existing) {
        occupied.set(key, {
          letter: cell.letter,
          placements: [placementIndex],
          directions: [placement.direction]
        });
        continue;
      }

      if (existing.letter !== cell.letter) {
        conflicts.push(`letter-conflict:${key}`);
      }
      if (existing.directions.includes(placement.direction)) {
        conflicts.push(`same-direction-overlap:${key}`);
      }
      existing.placements.push(placementIndex);
      existing.directions.push(placement.direction);
    }
  });

  const connected = new Set<number>();
  if (layout.placements.length > 0) {
    connected.add(0);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const cell of occupied.values()) {
      if (!cell.placements.some((index) => connected.has(index))) {
        continue;
      }
      for (const index of cell.placements) {
        if (!connected.has(index)) {
          connected.add(index);
          changed = true;
        }
      }
    }
  }

  const unvisited = new Set(layout.placements.map((_, index) => index));
  let componentCount = 0;
  while (unvisited.size > 0) {
    componentCount += 1;
    const first = unvisited.values().next().value as number;
    const component = new Set([first]);
    unvisited.delete(first);
    let componentChanged = true;
    while (componentChanged) {
      componentChanged = false;
      for (const cell of occupied.values()) {
        if (!cell.placements.some((index) => component.has(index))) {
          continue;
        }
        for (const index of cell.placements) {
          if (unvisited.delete(index)) {
            component.add(index);
            componentChanged = true;
          }
        }
      }
    }
  }

  const actualRuns = new Set<string>();
  for (const key of occupied.keys()) {
    const [row, col] = key.split(":").map(Number);
    if (
      !occupied.has(getLayoutCellKey(row, col - 1)) &&
      occupied.has(getLayoutCellKey(row, col + 1))
    ) {
      let word = "";
      let offset = 0;
      while (occupied.has(getLayoutCellKey(row, col + offset))) {
        word += occupied.get(getLayoutCellKey(row, col + offset))?.letter ?? "";
        offset += 1;
      }
      actualRuns.add(`across:${row}:${col}:${word}`);
    }
    if (
      !occupied.has(getLayoutCellKey(row - 1, col)) &&
      occupied.has(getLayoutCellKey(row + 1, col))
    ) {
      let word = "";
      let offset = 0;
      while (occupied.has(getLayoutCellKey(row + offset, col))) {
        word += occupied.get(getLayoutCellKey(row + offset, col))?.letter ?? "";
        offset += 1;
      }
      actualRuns.add(`down:${row}:${col}:${word}`);
    }
  }
  const expectedRuns = new Set(
    layout.placements.map(
      (placement) =>
        `${placement.direction}:${placement.start.row}:${placement.start.col}:${placement.word}`
    )
  );
  const unexpectedRuns = [
    ...[...actualRuns].filter((run) => !expectedRuns.has(run)),
    ...[...expectedRuns].filter((run) => !actualRuns.has(run)).map((run) => `missing:${run}`)
  ];
  const directions = new Set(layout.placements.map((placement) => placement.direction));
  const withinGrid = [...occupied.keys()].every((key) => {
    const [row, col] = key.split(":").map(Number);
    return row >= 0 && col >= 0 && row < layout.grid.rows && col < layout.grid.cols;
  });

  return {
    connected:
      layout.placements.length > 0 && connected.size === layout.placements.length,
    componentCount,
    crossingCount: [...occupied.values()].filter(
      (cell) => new Set(cell.placements).size > 1
    ).length,
    hasAcrossAndDown: directions.has("across") && directions.has("down"),
    conflicts,
    unexpectedRuns,
    withinGrid
  };
}

export function isConnectedCrosswordLayout(layout: CrosswordLayout) {
  const analysis = analyzeCrosswordLayout(layout);
  return (
    analysis.connected &&
    analysis.hasAcrossAndDown &&
    analysis.conflicts.length === 0 &&
    analysis.unexpectedRuns.length === 0 &&
    analysis.withinGrid
  );
}

function createTargetWords(
  words: PreparedWord[],
  requireConnected = false,
  maxGridSize?: number
): {
  targetWords: TargetWord[];
  grid: GridSize;
} {
  const wordSpellings = words.map((word) => word.normalizedWord);
  const layout = requireConnected
    ? createConnectedCrosswordLayout(wordSpellings, maxGridSize)
    : createCrosswordLayout(wordSpellings);

  if (!layout) {
    throw new Error("Unable to create a fully connected crossword layout.");
  }
  const placementsByIndex = new Map(
    layout.placements.map((placement) => [placement.index, placement])
  );
  const targetWords = words.map((word, index) => {
    const placement = placementsByIndex.get(index);

    if (!placement) {
      throw new Error(`Unable to place ${word.id} in the crossword.`);
    }

    return {
    id: word.id,
    word: word.normalizedWord,
    clue: createWordClue(word),
    englishMeaning: word.englishMeaning,
    chineseMeaning: word.chineseMeaning,
    start: placement.start,
    direction: placement.direction,
    vocabularyWordId: word.id,
    learningConcept: word.learningConcept,
    source: word.source
    } satisfies TargetWord;
  });

  return { targetWords, grid: layout.grid };
}

function arrangeWordsForLearningMode(
  words: PreparedWord[],
  uniquenessWindow: number
) {
  const levels: PreparedWord[][] = [];
  const nextAllowedMeaningLevel = new Map<string, number>();
  const nextAllowedConceptLevel = new Map<string, number>();
  const usedNormalizedWords = new Set<string>();

  for (const word of words) {
    if (usedNormalizedWords.has(word.normalizedWord)) {
      continue;
    }

    usedNormalizedWords.add(word.normalizedWord);
    const blockedUntil = Math.max(
      word.normalizedMeaning
        ? nextAllowedMeaningLevel.get(word.normalizedMeaning) ?? 0
        : 0,
      word.normalizedConcept
        ? nextAllowedConceptLevel.get(word.normalizedConcept) ?? 0
        : 0
    );

    let targetLevelIndex = blockedUntil;

    while (true) {
      while (levels.length <= targetLevelIndex) {
        levels.push([]);
      }

      const currentLevel = levels[targetLevelIndex];
      const hasDuplicateWord = currentLevel.some(
        (entry) => entry.normalizedWord === word.normalizedWord
      );

      if (!hasDuplicateWord && currentLevel.length < DEFAULT_WORDS_PER_LEVEL) {
        currentLevel.push(word);
        break;
      }

      targetLevelIndex += 1;
    }

    if (word.normalizedMeaning) {
      nextAllowedMeaningLevel.set(word.normalizedMeaning, targetLevelIndex + uniquenessWindow + 1);
    }

    if (word.normalizedConcept) {
      nextAllowedConceptLevel.set(word.normalizedConcept, targetLevelIndex + uniquenessWindow + 1);
    }
  }

  return levels.filter((level) => level.length > 0);
}

function arrangeWordsForReviewMode(words: PreparedWord[]) {
  const levels: PreparedWord[][] = [];
  let currentLevel: PreparedWord[] = [];
  const usedWordsInLevel = new Set<string>();

  for (const word of words) {
    if (
      currentLevel.length >= DEFAULT_WORDS_PER_LEVEL ||
      usedWordsInLevel.has(word.normalizedWord)
    ) {
      if (currentLevel.length > 0) {
        levels.push(currentLevel);
      }

      currentLevel = [];
      usedWordsInLevel.clear();
    }

    currentLevel.push(word);
    usedWordsInLevel.add(word.normalizedWord);
  }

  if (currentLevel.length > 0) {
    levels.push(currentLevel);
  }

  return levels;
}

function normalizeLevelGroups(groups: PreparedWord[][]) {
  if (groups.length <= 1) {
    return groups.filter((group) => group.length >= MIN_WORDS_PER_LEVEL);
  }

  const normalizedGroups = groups.map((group) => [...group]);

  for (let index = normalizedGroups.length - 1; index > 0; index -= 1) {
    const group = normalizedGroups[index];

    if (group.length >= MIN_WORDS_PER_LEVEL) {
      continue;
    }

    const previousGroup = normalizedGroups[index - 1];

    while (
      group.length < MIN_WORDS_PER_LEVEL &&
      previousGroup.length > MIN_WORDS_PER_LEVEL &&
      group.length < MAX_WORDS_PER_LEVEL
    ) {
      const movedWord = previousGroup.pop();

      if (!movedWord) {
        break;
      }

      group.unshift(movedWord);
    }
  }

  return normalizedGroups.filter((group) => group.length >= MIN_WORDS_PER_LEVEL);
}

export function createLetterPool(targetWords: string[]) {
  const letterCounts = new Map<string, number>();

  for (const targetWord of targetWords) {
    const currentCounts = new Map<string, number>();

    for (const letter of normalizeWord(targetWord).split("")) {
      currentCounts.set(letter, (currentCounts.get(letter) ?? 0) + 1);
    }

    for (const [letter, count] of currentCounts.entries()) {
      letterCounts.set(letter, Math.max(letterCounts.get(letter) ?? 0, count));
    }
  }

  return Array.from(letterCounts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([letter, count]) => Array.from({ length: count }, () => letter));
}

function stableLayoutHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createLayoutRevision(input: {
  levelId: string;
  wordIds: string[];
  normalizedSpellings: string[];
  grid: GridSize;
  placements: Array<Pick<CrosswordPlacement, "index" | "start" | "direction">>;
  manifestVersion: string;
}) {
  const placementSignature = [...input.placements]
    .sort((left, right) => left.index - right.index)
    .map(
      (placement) =>
        `${placement.index}:${placement.start.row}:${placement.start.col}:${placement.direction}`
    )
    .join("|");
  return `layout-${stableLayoutHash(
    `${input.manifestVersion}#${input.levelId}#${input.grid.rows}x${input.grid.cols}#${input.wordIds.join(",")}#${input.normalizedSpellings.join(",")}#${placementSignature}`
  )}`;
}

export function generateLevelFromWords(
  words: VocabularyWord[],
  options: GenerateSingleLevelOptions = {}
): Level | undefined {
  const seenNormalizedWords = new Set<string>();
  const preparedWords = prepareWords(words)
    .filter((word) => {
      if (seenNormalizedWords.has(word.normalizedWord)) {
        return false;
      }

      seenNormalizedWords.add(word.normalizedWord);
      return true;
    })
    .slice(0, MAX_WORDS_PER_LEVEL);

  if (preparedWords.length < MIN_WORDS_PER_LEVEL) {
    return undefined;
  }

  const difficulty = options.difficulty ?? getLevelDifficulty(preparedWords);
  const { targetWords, grid } = createTargetWords(
    preparedWords,
    options.requireConnected,
    options.maxGridSize
  );

  if (
    options.maxGridSize &&
    (grid.rows > options.maxGridSize || grid.cols > options.maxGridSize)
  ) {
    throw new Error(
      `Crossword grid ${grid.rows}x${grid.cols} exceeds ${options.maxGridSize}x${options.maxGridSize}.`
    );
  }

  const levelId = options.id ?? "generated-level";
  const layoutRevision = createLayoutRevision({
    levelId,
    wordIds: preparedWords.map((word) => word.id),
    normalizedSpellings: preparedWords.map((word) => word.normalizedWord),
    grid,
    placements: targetWords.map((word, index) => ({
      index,
      start: word.start,
      direction: word.direction
    })),
    manifestVersion: options.manifestVersion ?? "unversioned"
  });

  return {
    id: levelId,
    bookId: options.bookId ?? preparedWords[0]?.bookId ?? "",
    unitId: options.unitId ?? preparedWords[0]?.unitId ?? "",
    title: options.title ?? "Generated Level",
    letters: createLetterPool(targetWords.map((word) => word.word)),
    targetWords,
    grid,
    difficulty,
    rewardCoins: options.rewardCoins ?? getRewardCoins(preparedWords, difficulty),
    perfectBonusCoins:
      options.perfectBonusCoins ?? getPerfectBonusCoins(difficulty),
    mode: options.mode ?? "learning",
    layoutRevision
  };
}

export function generateLevelsFromVocabularySet(
  words: VocabularyWord[],
  options: GenerateLevelsOptions = {}
) {
  const preparedWords = prepareWords(words);

  if (preparedWords.length < MIN_WORDS_PER_LEVEL) {
    return [];
  }

  const groups = normalizeLevelGroups(
    options.mode === "review"
      ? arrangeWordsForReviewMode(preparedWords)
      : arrangeWordsForLearningMode(
          preparedWords,
          options.uniquenessWindow ?? DEFAULT_UNIQUENESS_WINDOW
        )
  );

  return groups
    .map((group, index) =>
      generateLevelFromWords(group, {
        ...options,
        id: `${options.idPrefix ?? "generated"}-${index + 1}`,
        title: `${options.titlePrefix ?? "Word Set"} ${index + 1}`
      })
    )
    .filter((level): level is Level => Boolean(level));
}

export function generateLevelsFromUnit(
  unit: VocabularyUnit,
  options: GenerateLevelsOptions = {}
) {
  const words = options.words ?? [];

  return generateLevelsFromVocabularySet(words, {
    ...options,
    idPrefix: options.idPrefix ?? `${unit.id}-level`,
    titlePrefix: options.titlePrefix ?? "Word Set"
  }).map((level) => ({
    ...level,
    bookId: unit.bookId,
    unitId: unit.id
  }));
}

export function generateLevelsFromBook(
  book: VocabularyBook,
  options: GenerateLevelsOptions = {}
) {
  const units = options.units ?? [];
  const getWordsForUnit =
    options.getWordsForUnit ?? (() => options.words ?? []);

  return units
    .filter((unit) => unit.bookId === book.id)
    .flatMap((unit) =>
      generateLevelsFromUnit(unit, {
        ...options,
        words: getWordsForUnit(unit)
      })
    );
}
