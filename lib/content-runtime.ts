import type {
  ContentRating,
  CurriculumIndex,
  Level,
  LevelRuntimeBundle,
  RuntimeVocabularyWordBundle,
  RuntimeVocabularyWord,
  VocabularyWord
} from "@/types/game";
import generatedIndex from "../src/content/vocabulary/generated/curriculum-index.json";

const levelRegistry = new Map<string, Level>();
const vocabularyRegistry = new Map<string, RuntimeVocabularyWord>();
const vocabularyVersionRegistry = new Map<string, string>();
const curriculumIndex = generatedIndex as CurriculumIndex;
const curriculumLevelById = new Map(
  curriculumIndex.levels.map((level) => [level.id, level])
);
const RATING_SEVERITY: Record<ContentRating, number> = {
  "all-ages": 0,
  "13-plus": 1,
  "parent-review": 2
};

export function toRuntimeFileKey(id: string) {
  return id.replace(/[^A-Za-z0-9._-]/g, (character) =>
    `_${character.codePointAt(0)?.toString(16) ?? "0"}_`
  );
}

export function toRuntimeLevelId(levelId: string) {
  return /^nce-[1-4]-u\d+-level-\d+$/.test(levelId)
    ? `legacy:${levelId}`
    : levelId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isLevelRuntimeBundleShape(value: unknown): value is LevelRuntimeBundle {
  if (!isRecord(value) || !isRecord(value.level)) return false;
  return (
    typeof value.contentVersion === "string" &&
    value.contentVersion.length > 0 &&
    typeof value.level.id === "string" &&
    typeof value.level.bookId === "string" &&
    typeof value.level.unitId === "string" &&
    Array.isArray(value.level.letters) &&
    Array.isArray(value.level.targetWords) &&
    value.level.targetWords.every(
      (target) =>
        isRecord(target) &&
        typeof target.id === "string" &&
        typeof target.word === "string" &&
        typeof target.clue === "string" &&
        isRecord(target.start) &&
        typeof target.start.row === "number" &&
        typeof target.start.col === "number" &&
        ["across", "down"].includes(String(target.direction))
    ) &&
    isRecord(value.level.grid) &&
    typeof value.level.grid.rows === "number" &&
    typeof value.level.grid.cols === "number" &&
    Array.isArray(value.vocabulary) &&
    value.vocabulary.every(isRuntimeVocabularyWord) &&
    ["demo-reviewed", "automated-beta", "licensed-production"].includes(
      String(value.releaseStatus)
    ) &&
    ["all-ages", "13-plus", "parent-review"].includes(String(value.rating))
  );
}

function isRuntimeVocabularyWord(value: unknown): value is RuntimeVocabularyWord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.word === "string" &&
    typeof value.bookId === "string" &&
    typeof value.unitId === "string" &&
    Array.isArray(value.examples) &&
    ["all-ages", "13-plus", "parent-review"].includes(String(value.rating))
  );
}

export function validateRuntimeVocabularyWordBundle(
  value: unknown,
  expectedWordId: string,
  expectedContentVersion: string
): value is RuntimeVocabularyWordBundle {
  return Boolean(
    isRecord(value) &&
    value.contentVersion === expectedContentVersion &&
    expectedContentVersion === curriculumIndex.contentVersion &&
    isRuntimeVocabularyWord(value.word) &&
    value.word.id === expectedWordId
  );
}

function highestContentRating(words: readonly RuntimeVocabularyWord[]) {
  return words.reduce<ContentRating>(
    (highest, word) =>
      RATING_SEVERITY[word.rating] > RATING_SEVERITY[highest]
        ? word.rating
        : highest,
    "all-ages"
  );
}

/**
 * Runtime content is untrusted network input. Validate all three independent
 * rating declarations (word, bundle, answer-free index) before touching the
 * registries so a stale or tampered package cannot weaken parental controls.
 */
export function validateLevelRuntimeBundle(
  value: unknown,
  expectedLevelId?: string,
  expectedContentVersion?: string
): value is LevelRuntimeBundle {
  if (!isLevelRuntimeBundleShape(value)) return false;
  if (expectedLevelId && value.level.id !== expectedLevelId) return false;
  if (
    expectedContentVersion &&
    value.contentVersion !== expectedContentVersion
  ) {
    return false;
  }
  if (
    expectedContentVersion &&
    expectedContentVersion !== curriculumIndex.contentVersion
  ) {
    return false;
  }
  if (value.rating !== highestContentRating(value.vocabulary)) return false;

  const vocabularyById = new Map(value.vocabulary.map((word) => [word.id, word]));
  if (vocabularyById.size !== value.vocabulary.length) return false;
  const targetVocabularyIds = value.level.targetWords
    .map((target) => target.vocabularyWordId)
    .filter((wordId): wordId is string => typeof wordId === "string");
  if (targetVocabularyIds.length > 0) {
    if (
      targetVocabularyIds.length !== value.level.targetWords.length ||
      new Set(targetVocabularyIds).size !== targetVocabularyIds.length ||
      targetVocabularyIds.length !== value.vocabulary.length
    ) {
      return false;
    }
    for (const target of value.level.targetWords) {
      const word = target.vocabularyWordId
        ? vocabularyById.get(target.vocabularyWordId)
        : undefined;
      if (
        !word ||
        word.word.toLocaleLowerCase("en") !==
          target.word.toLocaleLowerCase("en") ||
        word.bookId !== value.level.bookId ||
        word.unitId !== value.level.unitId
      ) {
        return false;
      }
    }
  } else if (value.vocabulary.length > 0) {
    return false;
  }

  const expected = curriculumLevelById.get(value.level.id);
  if (
    expected &&
    (expected.rating !== value.rating ||
      expected.releaseStatus !== value.releaseStatus ||
      expected.wordCount !== value.level.targetWords.length ||
      expected.layoutRevision !== value.level.layoutRevision)
  ) {
    return false;
  }
  return true;
}

export function registerLevelRuntimeBundle(bundle: LevelRuntimeBundle) {
  if (!validateLevelRuntimeBundle(bundle, bundle.level.id, bundle.contentVersion)) {
    throw new Error("Level runtime failed validation.");
  }
  registerRuntimeLevel(bundle.level);
  for (const word of bundle.vocabulary) {
    vocabularyRegistry.set(word.id, word);
    vocabularyVersionRegistry.set(word.id, bundle.contentVersion);
  }
}

export function registerRuntimeLevel(level: Level) {
  levelRegistry.set(level.id, level);
}

export function registerRuntimeVocabularyWord(
  word: VocabularyWord,
  rating: ContentRating = "all-ages"
) {
  vocabularyRegistry.set(word.id, { ...word, rating });
  vocabularyVersionRegistry.delete(word.id);
}

export function getRuntimeLevelById(levelId: string) {
  return levelRegistry.get(levelId);
}

export function getRuntimeVocabularyWordById(wordId: string) {
  return vocabularyRegistry.get(wordId);
}

export function getRuntimeVocabularyWordContentVersion(wordId: string) {
  return vocabularyVersionRegistry.get(wordId);
}

export async function loadLevelRuntimeBundle(
  levelId: string,
  contentVersion: string,
  signal?: AbortSignal
) {
  const runtimeLevelId = toRuntimeLevelId(levelId);
  const response = await fetch(
    `/content/runtime/levels/${toRuntimeFileKey(runtimeLevelId)}.json?v=${encodeURIComponent(contentVersion)}`,
    { credentials: "same-origin", signal }
  );
  if (!response.ok) {
    throw new Error(`Level runtime unavailable (${response.status}).`);
  }
  const candidate: unknown = await response.json();
  if (!validateLevelRuntimeBundle(candidate, runtimeLevelId, contentVersion)) {
    throw new Error("Level runtime failed validation.");
  }
  registerLevelRuntimeBundle(candidate);
  return candidate;
}

export async function loadRuntimeVocabularyWord(
  wordId: string,
  contentVersion: string
) {
  if (contentVersion !== curriculumIndex.contentVersion) {
    return undefined;
  }
  const cached = vocabularyRegistry.get(wordId);
  const cachedVersion = vocabularyVersionRegistry.get(wordId);
  if (cached && cachedVersion === contentVersion) {
    return cached;
  }
  try {
    const response = await fetch(
      `/content/runtime/words/${toRuntimeFileKey(wordId)}.json?v=${encodeURIComponent(contentVersion)}`,
      { credentials: "same-origin" }
    );
    if (!response.ok) return undefined;
    const candidate: unknown = await response.json();
    if (!validateRuntimeVocabularyWordBundle(candidate, wordId, contentVersion)) {
      return undefined;
    }
    vocabularyRegistry.set(candidate.word.id, candidate.word);
    vocabularyVersionRegistry.set(candidate.word.id, candidate.contentVersion);
    return candidate.word;
  } catch {
    return undefined;
  }
}

export async function loadRuntimeVocabularyWords(
  wordIds: readonly string[],
  contentVersion: string
) {
  const uniqueIds = Array.from(new Set(wordIds));
  const words = await Promise.all(
    uniqueIds.map((wordId) => loadRuntimeVocabularyWord(wordId, contentVersion))
  );
  return words.filter((word): word is RuntimeVocabularyWord => Boolean(word));
}

export function resetRuntimeContentForTests() {
  levelRegistry.clear();
  vocabularyRegistry.clear();
  vocabularyVersionRegistry.clear();
}
