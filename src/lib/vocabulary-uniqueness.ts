import type { VocabularyWord } from "@/types/game";

export type VocabularyUniquenessIssue = {
  type:
    | "duplicate-word-id"
    | "duplicate-word"
    | "duplicate-meaning"
    | "duplicate-concept";
  key: string;
  wordIds: string[];
  message: string;
};

export type VocabularyUniquenessIndex = {
  wordIdsByNormalizedWord: Map<string, string[]>;
  wordIdsByMeaning: Map<string, string[]>;
  wordIdsByConcept: Map<string, string[]>;
};

export function normalizeWordKey(word: string | undefined) {
  return word?.trim().toLowerCase() ?? "";
}

export function normalizeMeaningKey(meaning: string | undefined) {
  return meaning?.trim().toLowerCase() ?? "";
}

export function normalizeConceptKey(concept: string | undefined) {
  return concept?.trim().toLowerCase() ?? "";
}

function appendToIndex(index: Map<string, string[]>, key: string, wordId: string) {
  if (!key) {
    return;
  }

  const existing = index.get(key);

  if (existing) {
    existing.push(wordId);
    return;
  }

  index.set(key, [wordId]);
}

function toIssues(
  type: VocabularyUniquenessIssue["type"],
  index: Map<string, string[]>,
  label: string
) {
  return Array.from(index.entries())
    .filter(([, wordIds]) => wordIds.length > 1)
    .map(([key, wordIds]) => ({
      type,
      key,
      wordIds,
      message: `Duplicate ${label} "${key}" was found in ${wordIds.join(", ")}.`
    }));
}

export function buildUniquenessIndex(words: VocabularyWord[]): VocabularyUniquenessIndex {
  const wordIdsByNormalizedWord = new Map<string, string[]>();
  const wordIdsByMeaning = new Map<string, string[]>();
  const wordIdsByConcept = new Map<string, string[]>();

  for (const word of words) {
    appendToIndex(wordIdsByNormalizedWord, normalizeWordKey(word.word), word.id);
    appendToIndex(wordIdsByMeaning, normalizeMeaningKey(word.chineseMeaning), word.id);
    appendToIndex(wordIdsByConcept, normalizeConceptKey(word.learningConcept), word.id);
  }

  return {
    wordIdsByNormalizedWord,
    wordIdsByMeaning,
    wordIdsByConcept
  };
}

export function validateVocabularyUniqueness(words: VocabularyWord[]) {
  const issues: VocabularyUniquenessIssue[] = [];
  const seenWordIds = new Set<string>();

  for (const word of words) {
    if (seenWordIds.has(word.id)) {
      issues.push({
        type: "duplicate-word-id",
        key: word.id,
        wordIds: [word.id],
        message: `Duplicate word id "${word.id}" was found.`
      });
      continue;
    }

    seenWordIds.add(word.id);
  }

  const index = buildUniquenessIndex(words);

  return [
    ...issues,
    ...toIssues("duplicate-word", index.wordIdsByNormalizedWord, "word"),
    ...toIssues("duplicate-meaning", index.wordIdsByMeaning, "meaning"),
    ...toIssues("duplicate-concept", index.wordIdsByConcept, "learning concept")
  ];
}
