export type Direction = "across" | "down";

export type Coordinate = {
  row: number;
  col: number;
};

export type GridSize = {
  rows: number;
  cols: number;
};

export type CellKey = `${number}:${number}`;

export type LevelDifficulty = "easy" | "medium";
export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type VocabularyDifficulty = CEFRLevel;
export type VocabularyColorTheme = "mint" | "coral" | "leaf" | "gold";
export type VocabularyTheme = VocabularyColorTheme;
export type VocabularyGenerationMode = "learning" | "review";

export type TargetWord = {
  id: string;
  word: string;
  clue: string;
  englishMeaning?: string;
  chineseMeaning?: string;
  start: Coordinate;
  direction: Direction;
  vocabularyWordId?: string;
  learningConcept?: string;
};

export type Level = {
  id: string;
  bookId: string;
  unitId: string;
  title?: string;
  letters: string[];
  targetWords: TargetWord[];
  grid: GridSize;
  rewardCoins: number;
  hintCost: number;
  perfectBonusCoins?: number;
  difficulty?: LevelDifficulty;
  mode?: VocabularyGenerationMode;
};

export type VocabularyBook = {
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  level: CEFRLevel;
  estimatedWordCount?: number;
  colorTheme?: VocabularyColorTheme;
  unitIds: string[];
};

export type VocabularyUnit = {
  id: string;
  bookId: string;
  title: string;
  lessonRange?: string;
  difficulty: CEFRLevel;
  estimatedMinutes?: number;
  wordIds: string[];
};

export type VocabularyWord = {
  id: string;
  bookId: string;
  unitId: string;
  word: string;
  displayText: string;
  englishMeaning?: string;
  chineseMeaning?: string;
  phonetic?: string;
  partOfSpeech?: string;
  difficulty?: number;
  cefrLevel?: CEFRLevel;
  frequencyRank?: number;
  examples: string[];
  tags: string[];
  learningConcept?: string;
};

export type VocabularyImportWord = {
  id: string;
  word: string;
  displayText?: string;
  englishMeaning?: string;
  meaning?: string;
  chineseMeaning?: string;
  phonetic?: string;
  partOfSpeech?: string;
  difficulty?: number;
  cefrLevel?: CEFRLevel;
  frequencyRank?: number;
  examples?: string[];
  tags?: string[];
  learningConcept?: string;
};

export type VocabularyImportUnit = {
  id: string;
  title: string;
  lessonRange?: string;
  difficulty: CEFRLevel;
  estimatedMinutes?: number;
  words: VocabularyImportWord[];
};

export type VocabularyImportBook = {
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  level: CEFRLevel;
  estimatedWordCount?: number;
  colorTheme?: VocabularyColorTheme;
  units: VocabularyImportUnit[];
};

export type GridCell = {
  row: number;
  col: number;
  letter: string;
  wordIds: string[];
};

export type LevelProgress = {
  foundWords: string[];
  revealedCells: CellKey[];
  completed: boolean;
  completedAt?: string;
  hintsUsed: number;
};

export type WordLearningProgress = {
  wordId: string;
  masteryLevel: number;
  correctCount: number;
  wrongCount: number;
  streak: number;
  favorite: boolean;
  difficult: boolean;
  lastReviewed?: string;
  nextReview?: string;
};

export type LearningStatistics = {
  totalWordsLearned: number;
  totalWordsMastered: number;
  totalStudyMinutes: number;
  studyStreak: number;
  lastStudyDate?: string;
};

export type LearningSnapshot = {
  words: Record<string, WordLearningProgress>;
  studyStats: LearningStatistics;
};

export type GameProgress = {
  coins: number;
  unlockedLevelIds: string[];
  currentBookId?: string;
  currentUnitId?: string;
  currentLevelId?: string;
  levels: Record<string, LevelProgress>;
  words: Record<string, WordLearningProgress>;
  studyStats: LearningStatistics;
};

export type BookProgress = {
  bookId: string;
  totalUnits: number;
  completedUnits: number;
  totalLevels: number;
  completedLevels: number;
  totalWords: number;
  foundWords: number;
  learnedWords: number;
  masteredWords: number;
  difficultWords: number;
  completionPercent: number;
};

export type UnitProgress = {
  unitId: string;
  bookId: string;
  totalLevels: number;
  completedLevels: number;
  totalWords: number;
  foundWords: number;
  learnedWords: number;
  masteredWords: number;
  difficultWords: number;
  completionPercent: number;
};

export type WordDetailViewModel = {
  word: VocabularyWord;
  progress: WordLearningProgress;
  isMastered: boolean;
  isFavorite: boolean;
  isDifficult: boolean;
};

export type SubmitWordResult =
  | {
      status: "correct";
      attempt: string;
      word: TargetWord;
      reward: 0;
      baseReward: 0;
      bonusReward: 0;
    }
  | {
      status: "level-complete";
      attempt: string;
      word: TargetWord;
      reward: number;
      baseReward: number;
      bonusReward: number;
    }
  | {
      status: "already-found";
      attempt: string;
      word: TargetWord;
    }
  | {
      status: "not-target";
      attempt: string;
      word?: undefined;
      reward?: undefined;
      baseReward?: undefined;
      bonusReward?: undefined;
    };

export type HintResult =
  | {
      status: "revealed";
      cellKey: CellKey;
      letter: string;
      cost: number;
      vocabularyWordId?: string;
    }
  | {
      status: "not-enough-coins";
      cost: number;
    }
  | {
      status: "no-hints-left";
    };
