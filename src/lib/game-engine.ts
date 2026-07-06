import type {
  CellKey,
  Coordinate,
  GridCell,
  Level,
  LevelProgress,
  TargetWord
} from "@/types/game";

export const STARTING_COINS = 100;
export const DEFAULT_HINT_COST = 25;

export type GameState = {
  level: Level;
  progress: LevelProgress;
  coins: number;
};

export type GameAction =
  | {
      type: "submit-word";
      word: string;
      completedAt?: string;
    }
  | {
      type: "use-hint";
    };

type SubmitWordGameResult =
  | {
      action: "submit-word";
      status: "correct";
      attempt: string;
      word: TargetWord;
      reward: 0;
      baseReward: 0;
      bonusReward: 0;
      state: GameState;
    }
  | {
      action: "submit-word";
      status: "level-complete";
      attempt: string;
      word: TargetWord;
      reward: number;
      baseReward: number;
      bonusReward: number;
      state: GameState;
    }
  | {
      action: "submit-word";
      status: "already-found";
      attempt: string;
      word: TargetWord;
      state: GameState;
    }
  | {
      action: "submit-word";
      status: "not-target";
      attempt: string;
      state: GameState;
    };

type HintGameResult =
  | {
      action: "use-hint";
      status: "revealed";
      cellKey: CellKey;
      letter: string;
      cost: number;
      vocabularyWordId?: string;
      state: GameState;
    }
  | {
      action: "use-hint";
      status: "not-enough-coins";
      cost: number;
      state: GameState;
    }
  | {
      action: "use-hint";
      status: "no-hints-left";
      state: GameState;
    };

export type GameResult = SubmitWordGameResult | HintGameResult;

export function createEmptyLevelProgress(): LevelProgress {
  return {
    foundWords: [],
    revealedCells: [],
    completed: false,
    hintsUsed: 0
  };
}

export function createGameState(
  level: Level,
  progress: LevelProgress = createEmptyLevelProgress(),
  coins = STARTING_COINS
): GameState {
  return {
    level,
    progress,
    coins: normalizeCoins(coins)
  };
}

export function normalizeCoins(coins: number) {
  return Number.isFinite(coins) && coins >= 0 ? Math.floor(coins) : STARTING_COINS;
}

export function normalizeWord(word: string) {
  return word.trim().toUpperCase();
}

export function getCellKey(row: number, col: number): CellKey {
  return `${row}:${col}`;
}

export function getCellsForWord(word: TargetWord): Coordinate[] {
  return word.word.split("").map((_, index) => {
    if (word.direction === "across") {
      return { row: word.start.row, col: word.start.col + index };
    }

    return { row: word.start.row + index, col: word.start.col };
  });
}

export function buildGrid(level: Level): Record<CellKey, GridCell> {
  const grid: Record<CellKey, GridCell> = {};

  for (const word of level.targetWords) {
    const letters = word.word.split("");
    const cells = getCellsForWord(word);

    cells.forEach((cell, index) => {
      if (
        cell.row < 0 ||
        cell.row >= level.grid.rows ||
        cell.col < 0 ||
        cell.col >= level.grid.cols
      ) {
        throw new Error(`Word ${word.id} is outside the grid.`);
      }

      const key = getCellKey(cell.row, cell.col);
      const existingCell = grid[key];
      const letter = letters[index];

      if (existingCell && existingCell.letter !== letter) {
        throw new Error(`Word ${word.id} conflicts at ${key}.`);
      }

      grid[key] = {
        row: cell.row,
        col: cell.col,
        letter,
        wordIds: existingCell ? [...existingCell.wordIds, word.id] : [word.id]
      };
    });
  }

  return grid;
}

export function validateWord(level: Level, word: string) {
  const attempt = normalizeWord(word);
  return level.targetWords.find((targetWord) => targetWord.word === attempt);
}

export function checkLevelComplete(state: GameState) {
  const foundWordSet = new Set(state.progress.foundWords);
  return state.level.targetWords.every((word) => foundWordSet.has(word.id));
}

export function isCellVisible(cell: GridCell, progress: LevelProgress) {
  if (progress.completed) {
    return true;
  }

  const key = getCellKey(cell.row, cell.col);
  return (
    progress.revealedCells.includes(key) ||
    cell.wordIds.some((wordId) => progress.foundWords.includes(wordId))
  );
}

export function getNextHint(state: GameState) {
  const grid = buildGrid(state.level);
  const cells = Object.values(grid).sort((a, b) => a.row - b.row || a.col - b.col);
  return cells.find((cell) => !isCellVisible(cell, state.progress));
}

export function getCompletionReward(state: GameState) {
  if (state.progress.completed) {
    return {
      baseReward: 0,
      bonusReward: 0,
      totalReward: 0
    };
  }

  const bonusReward =
    state.progress.hintsUsed === 0 ? state.level.perfectBonusCoins ?? 0 : 0;

  return {
    baseReward: state.level.rewardCoins,
    bonusReward,
    totalReward: state.level.rewardCoins + bonusReward
  };
}

export function applyWordSubmission(
  state: GameState,
  word: string,
  options?: {
    completedAt?: string;
  }
): SubmitWordGameResult {
  const attempt = normalizeWord(word);
  const targetWord = validateWord(state.level, attempt);

  if (!targetWord) {
    return {
      action: "submit-word",
      status: "not-target",
      attempt,
      state
    };
  }

  if (state.progress.foundWords.includes(targetWord.id)) {
    return {
      action: "submit-word",
      status: "already-found",
      attempt,
      word: targetWord,
      state
    };
  }

  const foundWords = [...state.progress.foundWords, targetWord.id];
  const nextProgress: LevelProgress = {
    ...state.progress,
    foundWords
  };
  const nextState = {
    ...state,
    progress: nextProgress
  };
  const completed = checkLevelComplete(nextState);

  if (!completed) {
    return {
      action: "submit-word",
      status: "correct",
      attempt,
      word: targetWord,
      reward: 0,
      baseReward: 0,
      bonusReward: 0,
      state: nextState
    };
  }

  const reward = getCompletionReward(state);
  const completedProgress: LevelProgress = {
    ...nextProgress,
    completed: true,
    completedAt: options?.completedAt ?? new Date().toISOString()
  };
  const completedState: GameState = {
    ...state,
    coins: normalizeCoins(state.coins + reward.totalReward),
    progress: completedProgress
  };

  return {
    action: "submit-word",
    status: "level-complete",
    attempt,
    word: targetWord,
    reward: reward.totalReward,
    baseReward: reward.baseReward,
    bonusReward: reward.bonusReward,
    state: completedState
  };
}

export function applyHint(state: GameState): HintGameResult {
  if (state.coins < state.level.hintCost) {
    return {
      action: "use-hint",
      status: "not-enough-coins",
      cost: state.level.hintCost,
      state
    };
  }

  const hintCell = getNextHint(state);

  if (!hintCell) {
    return {
      action: "use-hint",
      status: "no-hints-left",
      state
    };
  }

  const cellKey = getCellKey(hintCell.row, hintCell.col);
  const nextProgress: LevelProgress = {
    ...state.progress,
    revealedCells: state.progress.revealedCells.includes(cellKey)
      ? state.progress.revealedCells
      : [...state.progress.revealedCells, cellKey],
    hintsUsed: state.progress.hintsUsed + 1
  };
  const nextState: GameState = {
    ...state,
    coins: normalizeCoins(state.coins - state.level.hintCost),
    progress: nextProgress
  };
  const relatedTargetWord = state.level.targetWords.find((word) =>
    word.id === hintCell.wordIds[0]
  );

  return {
    action: "use-hint",
    status: "revealed",
    cellKey,
    letter: hintCell.letter,
    cost: state.level.hintCost,
    vocabularyWordId: relatedTargetWord?.vocabularyWordId,
    state: nextState
  };
}

export function applyGameAction(state: GameState, action: GameAction): GameResult {
  if (action.type === "submit-word") {
    return applyWordSubmission(state, action.word, {
      completedAt: action.completedAt
    });
  }

  return applyHint(state);
}
