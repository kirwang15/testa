import { getCellKey, getCellsForWord } from "./game";
import type {
  Level,
  LevelProgress,
  TargetWord,
  VocabularyWord
} from "../types/game";

function getMeaningText(value: string | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getUnsolvedAnswers(level: Level, progress: LevelProgress) {
  return level.targetWords
    .filter(
      (word) =>
        !progress.completed && !progress.foundWords.includes(word.id)
    )
    .map((word) => word.word)
    .sort((left, right) => right.length - left.length || left.localeCompare(right));
}

export function sanitizePresentationTextForAnswers(
  text: string | undefined,
  answers: string[]
) {
  if (!text) {
    return undefined;
  }

  return [...answers]
    .sort((left, right) => right.length - left.length || left.localeCompare(right))
    .reduce(
      (safeText, answer) =>
        safeText.replace(
          new RegExp(`\\b${escapeRegExp(answer)}\\b`, "gi"),
          "•••"
        ),
      text
    );
}

export function sanitizeLevelPresentationText(
  level: Level,
  progress: LevelProgress,
  text: string | undefined
) {
  return sanitizePresentationTextForAnswers(
    text,
    getUnsolvedAnswers(level, progress)
  );
}

export function findUnsolvedAnswerCollisions(
  level: Level,
  progress: LevelProgress,
  texts: string[]
) {
  return getUnsolvedAnswers(level, progress).filter((answer) => {
    const collisionPattern = new RegExp(`\\b${escapeRegExp(answer)}\\b`, "i");
    return texts.some((text) => collisionPattern.test(text));
  });
}

export function getWordCardPresentation(
  level: Level,
  word: TargetWord,
  progress: LevelProgress,
  isFavorite: boolean
) {
  const solved = progress.completed || progress.foundWords.includes(word.id);
  const cells = getCellsForWord(word);

  return {
    solved,
    wordText: solved ? word.word : undefined,
    favoriteActionLabel: solved
      ? sanitizeLevelPresentationText(
          level,
          progress,
          isFavorite ? "Remove saved word" : "Save word"
        )
      : undefined,
    englishMeaning: sanitizeLevelPresentationText(
      level,
      progress,
      getMeaningText(word.englishMeaning) ?? getMeaningText(word.clue)
    ),
    chineseMeaning: sanitizeLevelPresentationText(
      level,
      progress,
      getMeaningText(word.chineseMeaning)
    ),
    letterTexts: word.word.split("").map((letter, index) => {
      const cell = cells[index];
      const visible = solved || progress.revealedCells.includes(getCellKey(cell.row, cell.col));
      return visible ? letter : "_";
    })
  };
}

export function buildLevelPresentation(
  level: Level,
  progress: LevelProgress,
  uiTexts: string[] = []
) {
  return {
    cards: level.targetWords.map((word) =>
      getWordCardPresentation(level, word, progress, false)
    ),
    uiTexts: uiTexts.map(
      (text) => sanitizeLevelPresentationText(level, progress, text) ?? ""
    )
  };
}

export function isVocabularyAnswerSafeToDisplay(
  wordId: string,
  levels: Level[],
  progressByLevelId: Record<string, LevelProgress>
) {
  const answerSpellings = new Set(
    levels.flatMap((level) =>
      level.targetWords
        .filter((word) => word.vocabularyWordId === wordId)
        .map((word) => word.word.trim().toUpperCase())
    )
  );

  if (answerSpellings.size === 0) {
    return true;
  }

  return levels.every((level) =>
    level.targetWords.every((word) => {
      if (!answerSpellings.has(word.word.trim().toUpperCase())) {
        return true;
      }

      const progress = progressByLevelId[level.id];
      return Boolean(
        progress?.completed || progress?.foundWords.includes(word.id)
      );
    })
  );
}

export function buildSafeVocabularyPreviews(
  words: VocabularyWord[],
  levels: Level[],
  progressByLevelId: Record<string, LevelProgress>
) {
  const unsafeAnswers = words
    .filter(
      (word) =>
        !isVocabularyAnswerSafeToDisplay(word.id, levels, progressByLevelId)
    )
    .map((word) => word.word);

  return words.map((word, index) => {
    const safe = isVocabularyAnswerSafeToDisplay(
      word.id,
      levels,
      progressByLevelId
    );
    const sanitize = (text: string | undefined) =>
      sanitizePresentationTextForAnswers(text, unsafeAnswers);

    return {
      id: word.id,
      safe,
      title: safe ? word.displayText : `Locked clue ${index + 1}`,
      wordLabel: safe ? word.displayText : undefined,
      length: word.word.length,
      englishMeaning: sanitize(word.englishMeaning),
      chineseMeaning: sanitize(word.chineseMeaning)
    };
  });
}
