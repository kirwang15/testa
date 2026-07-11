import {
  normalizeConceptKey,
  normalizeMeaningKey,
  normalizeWordKey
} from "./vocabulary-uniqueness";
import type {
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

function createTargetWords(words: PreparedWord[]): TargetWord[] {
  return words.map((word, index) => ({
    id: word.id,
    word: word.normalizedWord,
    clue: createWordClue(word),
    englishMeaning: word.englishMeaning,
    chineseMeaning: word.chineseMeaning,
    start: { row: index, col: 0 },
    direction: "across",
    vocabularyWordId: word.id,
    learningConcept: word.learningConcept
  }));
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
  const targetWords = createTargetWords(preparedWords);
  const longestWord = Math.max(...targetWords.map((word) => word.word.length));

  return {
    id: options.id ?? "generated-level",
    bookId: options.bookId ?? preparedWords[0]?.bookId ?? "",
    unitId: options.unitId ?? preparedWords[0]?.unitId ?? "",
    title: options.title ?? "Generated Level",
    letters: createLetterPool(targetWords.map((word) => word.word)),
    targetWords,
    grid: {
      rows: targetWords.length,
      cols: longestWord
    },
    difficulty,
    rewardCoins: options.rewardCoins ?? getRewardCoins(preparedWords, difficulty),
    perfectBonusCoins:
      options.perfectBonusCoins ?? getPerfectBonusCoins(difficulty),
    mode: options.mode ?? "learning"
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
