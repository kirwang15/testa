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
export type VocabularyReviewStatus = "automated" | "human-reviewed";

export type UiLanguage = "en" | "zh-CN";
export type ClueLanguage = UiLanguage;
export type InterfaceMode = "guided" | "immersion";
export type AgeBand = "7-9" | "10-12" | "13-15";
export type HydrationStatus =
  | "loading"
  | "ready"
  | "recovered"
  | "write-failed"
  | "unsupported-version";

export type ProfileActionContext = {
  profileId: string;
  sessionId: string;
  levelId?: string;
};

export type LearningPreferences = {
  uiLanguage: UiLanguage;
  clueLanguage: ClueLanguage;
  interfaceMode: InterfaceMode;
};

export type ContentAccessLevel = ContentRating;

export type PlayerProfile = {
  id: string;
  nickname: string;
  ageBand: AgeBand;
  preferences: LearningPreferences;
  accent: "en-US" | "en-GB";
  createdAt: string;
  onboardingCompleted: boolean;
  contentAccessLevel: ContentAccessLevel;
  contentAccessOverride: boolean;
};

export type NceVocabularySource = {
  type?: "nce";
  book: 1 | 2 | 3 | 4;
  lesson: number;
  edition: "1997";
  verification: "double-source";
  listId?: never;
  rank?: never;
  provenanceId: string;
};

export type IeltsVocabularySource = {
  type: "ielts";
  listId: string;
  rank: number;
  book?: never;
  lesson?: never;
  edition?: never;
  verification?: never;
  provenanceId: string;
};

export type KaoyanVocabularySource = {
  type: "kaoyan";
  listId: string;
  rank: number;
  book?: never;
  lesson?: never;
  edition?: never;
  verification?: never;
  provenanceId: string;
};

export type VocabularySource =
  | NceVocabularySource
  | IeltsVocabularySource
  | KaoyanVocabularySource;

export type VocabularyImportLevel = {
  id: string;
  title?: string;
  wordIds: readonly string[];
  lessonAnchor?: number;
};

export type ContentManifest = {
  version: string;
  generatedAt: string;
  sourceHashes: string[];
  generatorVersion: string;
  sources?: Array<{
    id: string;
    name: string;
    url: string;
    snapshotDate: string;
    sha256: string;
    licenseStatus: "unknown-reference-only" | "licensed" | "public-domain";
    version: string;
  }>;
  provenanceIds?: string[];
  mappingReport?: {
    path: string;
    sha256: string;
    entries: number;
  };
  clueGenerator?: {
    runtime: "ollama";
    model: string;
    modelDigest: string;
    script: string;
    policyVersion: string;
  };
  exampleGenerator?: {
    runtime: "ollama";
    model: string;
    modelDigest: string;
    script: string;
    policyVersion: string;
  };
  wordnetVersion?: string;
  notice?: string;
  wordCount?: number;
  levelCount?: number;
  contentVersion?: string;
  formatVersion?: number;
  editorialOverrideHash?: string;
  contentRatingsHash?: string;
  layoutHash?: string;
  generatorHash?: string;
  contentHash?: string;
  inputHashes?: Record<string, string>;
};

export type ContentReleaseStatus =
  | "demo-reviewed"
  | "automated-beta"
  | "licensed-production";

export type ContentRating = "all-ages" | "13-plus" | "parent-review";

export type LevelRoutePayload = {
  levelId: string;
  contentVersion: string;
};

export type LevelRuntimeBundle = {
  contentVersion: string;
  level: Level;
  vocabulary: RuntimeVocabularyWord[];
  releaseStatus: ContentReleaseStatus;
  rating: ContentRating;
};

export type RuntimeVocabularyWord = VocabularyWord & {
  rating: ContentRating;
};

export type RuntimeVocabularyWordBundle = {
  contentVersion: string;
  word: RuntimeVocabularyWord;
};

export type ReviewWordMetadata = {
  sourceBook: 1 | 2 | 3 | 4;
  contentRating: ContentRating;
};

/**
 * Answer-free lookup keyed by a deterministic fingerprint of the local word
 * id. It intentionally contains neither spellings nor clear-text word ids.
 */
export type ReviewMetadataIndex = {
  contentVersion: string;
  entries: Record<string, readonly [1 | 2 | 3 | 4, ContentRating]>;
};

/**
 * Answer-free curriculum metadata. These records are safe to serialize into
 * non-game pages: they intentionally contain no spellings, word ids, clues,
 * letter bags, examples, or grid answers.
 */
export type CurriculumLevelIndex = {
  id: string;
  bookId: string;
  unitId: string;
  curriculumId?: string;
  trackId?: string;
  levelNumber?: number;
  title?: string;
  difficulty?: LevelDifficulty;
  wordCount: number;
  lessonAnchor?: number;
  layoutRevision?: string;
  releaseStatus: ContentReleaseStatus;
  rating: ContentRating;
};

export type CurriculumCourseIndex = {
  id: string;
  titleEn: string;
  titleZh: string;
  trackIds: string[];
  levelCount: number;
};

export type CurriculumTrackIndex = {
  id: string;
  curriculumId: string;
  titleEn: string;
  titleZh: string;
  order: number;
  levelIds?: string[];
};

export type CurriculumUnitIndex = {
  id: string;
  bookId: string;
  title: string;
  lessonRange?: string;
  difficulty: CEFRLevel;
  estimatedMinutes?: number;
  wordCount: number;
  levelIds?: string[];
};

export type CurriculumBookIndex = {
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  level: CEFRLevel;
  estimatedWordCount: number;
  colorTheme?: VocabularyColorTheme;
  contentKind: "curriculum";
  unitIds: string[];
};

export type CurriculumIndex = {
  contentVersion: string;
  generatedAt: string;
  curricula?: CurriculumCourseIndex[];
  tracks?: CurriculumTrackIndex[];
  books: CurriculumBookIndex[];
  units: CurriculumUnitIndex[];
  levels: CurriculumLevelIndex[];
};

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
  source?: VocabularySource;
};

export type Level = {
  id: string;
  bookId: string;
  unitId: string;
  curriculumId?: string;
  trackId?: string;
  levelNumber?: number;
  title?: string;
  letters: string[];
  targetWords: TargetWord[];
  grid: GridSize;
  rewardCoins: number;
  perfectBonusCoins?: number;
  difficulty?: LevelDifficulty;
  mode?: VocabularyGenerationMode;
  layoutRevision?: string;
};

export type VocabularyBook = {
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  level: CEFRLevel;
  estimatedWordCount?: number;
  colorTheme?: VocabularyColorTheme;
  contentKind?: "curriculum" | "legacy";
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
  levels?: VocabularyImportLevel[];
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
  reviewStatus?: VocabularyReviewStatus;
  source?: VocabularySource;
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
  reviewStatus?: VocabularyReviewStatus;
  source?: VocabularySource;
};

export type VocabularyImportUnit = {
  id: string;
  title: string;
  lessonRange?: string;
  difficulty: CEFRLevel;
  estimatedMinutes?: number;
  words: VocabularyImportWord[];
  levels?: VocabularyImportLevel[];
};

export type VocabularyImportBook = {
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  level: CEFRLevel;
  estimatedWordCount?: number;
  colorTheme?: VocabularyColorTheme;
  contentKind?: "curriculum" | "legacy";
  units: VocabularyImportUnit[];
};

export type GridCell = {
  row: number;
  col: number;
  letter: string;
  wordIds: string[];
};

export type LevelAttemptProgress = {
  foundWords: string[];
  revealedCells: CellKey[];
  hintedWordIds: string[];
  hintStages: Record<string, number>;
  hintsUsed: number;
  wrongAttempts: number;
  duplicateAttempts: number;
};

export type LevelProgress = LevelAttemptProgress & {
  layoutRevision?: string;
  completed: boolean;
  completedAt?: string;
  bestStars: number;
  attemptCount: number;
  lastPlayedAt?: string;
  activeReplayAttempt?: LevelAttemptProgress;
};

export type ReviewReason = "wrong" | "clue";

export type WordLearningProgress = {
  wordId: string;
  /** Answer-free access metadata captured when the word is first played. */
  sourceBook?: 1 | 2 | 3 | 4;
  contentRating?: ContentRating;
  contentVersion?: string;
  masteryLevel: number;
  correctCount: number;
  wrongCount: number;
  streak: number;
  favorite: boolean;
  difficult: boolean;
  reviewReasons?: ReviewReason[];
  lastReviewed?: string;
  nextReview?: string;
  firstTryCorrectRecorded?: boolean;
};

export type LearningStatistics = {
  totalWordsLearned: number;
  totalWordsMastered: number;
  totalStudyMinutes: number;
  studyStreak: number;
  lastStudyDate?: string;
  firstTryCorrectWords?: number;
  completedDueReviews?: number;
  actualHintEvents?: number;
  activeDateKeys?: string[];
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

export type ProfiledGameProgress = {
  storageVersion: 3;
  contentVersion: string;
  profiles: Record<string, PlayerProfile>;
  activeProfileId: string;
  progressByProfileId: Record<string, GameProgress>;
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
      status: "read-only";
      attempt: string;
    }
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
      status: "read-only";
    }
  | {
      status: "revealed";
      cellKey: CellKey;
      letter: string;
      vocabularyWordId?: string;
    }
  | {
      status: "no-hints-left";
    };
