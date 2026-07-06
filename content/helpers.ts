import type { Level, LevelDifficulty, TargetWord } from "@/types/game";

type MockLevelInput = {
  id: string;
  bookId: string;
  unitId: string;
  title: string;
  difficulty: LevelDifficulty;
  rewardCoins: number;
  hintCost: number;
  perfectBonusCoins?: number;
  mainWord: string;
  miniWords: string[];
};

function createMockClue(word: string) {
  return `Practice word: ${word.toLowerCase()}`;
}

function buildLetterBank(words: string[]) {
  const letterCounts = new Map<string, number>();

  for (const word of words.map((entry) => entry.toUpperCase())) {
    const currentCounts = new Map<string, number>();

    for (const letter of word.split("")) {
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

function createTargetWords(mainWord: string, miniWords: string[]): TargetWord[] {
  const acrossWord = mainWord.toUpperCase();
  const downWords = miniWords.map((word) => word.toUpperCase());

  return [
    {
      id: acrossWord.toLowerCase(),
      word: acrossWord,
      clue: createMockClue(acrossWord),
      start: { row: 2, col: 0 },
      direction: "across"
    },
    ...downWords.map((word, index) => ({
      id: word.toLowerCase(),
      word,
      clue: createMockClue(word),
      start: { row: 2, col: index },
      direction: "down" as const
    }))
  ];
}

export function createMockLevel({
  id,
  bookId,
  unitId,
  title,
  difficulty,
  rewardCoins,
  hintCost,
  perfectBonusCoins,
  mainWord,
  miniWords
}: MockLevelInput): Level {
  const letters = buildLetterBank([mainWord, ...miniWords]);
  const targetWords = createTargetWords(mainWord, miniWords);
  const tallestWord = Math.max(...targetWords.map((word) => word.word.length));

  return {
    id,
    bookId,
    unitId,
    title,
    letters,
    targetWords,
    grid: {
      rows: 2 + tallestWord,
      cols: letters.length
    },
    difficulty,
    rewardCoins,
    hintCost,
    perfectBonusCoins
  };
}
