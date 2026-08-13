import type {
  ContentRating,
  Level,
  RuntimeVocabularyWord,
  VocabularyWord
} from "@/types/game";

const levelRegistry = new Map<string, Level>();
const vocabularyRegistry = new Map<string, RuntimeVocabularyWord>();
const vocabularyVersionRegistry = new Map<string, string>();

export function registerRuntimeLevel(level: Level) {
  levelRegistry.set(level.id, level);
}

export function registerRuntimeVocabularyWord(
  word: VocabularyWord,
  rating: ContentRating = "all-ages",
  contentVersion?: string
) {
  vocabularyRegistry.set(word.id, { ...word, rating });
  if (contentVersion) vocabularyVersionRegistry.set(word.id, contentVersion);
  else vocabularyVersionRegistry.delete(word.id);
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

export function resetRuntimeRegistry() {
  levelRegistry.clear();
  vocabularyRegistry.clear();
  vocabularyVersionRegistry.clear();
}
