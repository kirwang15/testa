import { newConcept1Mock } from "./new-concept-1.mock";
import { newConcept2Mock } from "./new-concept-2.mock";
import { newConcept3Mock } from "./new-concept-3.mock";
import { newConcept4Mock } from "./new-concept-4.mock";
import { nce1997Books, nce1997ContentManifest } from "./nce-1997";
import type { VocabularyImportBook } from "@/types/game";

export const LEGACY_CONTENT_PREFIX = "legacy:";

function namespaceLegacyBook(book: VocabularyImportBook): VocabularyImportBook {
  const prefixId = (id: string) =>
    id.startsWith(LEGACY_CONTENT_PREFIX) ? id : `${LEGACY_CONTENT_PREFIX}${id}`;

  return {
    ...book,
    id: prefixId(book.id),
    contentKind: "legacy",
    units: book.units.map((unit) => ({
      ...unit,
      id: prefixId(unit.id),
      words: unit.words.map((word) => ({
        ...word,
        id: prefixId(word.id)
      })),
      levels: unit.levels?.map((level) => ({
        ...level,
        id: prefixId(level.id),
        wordIds: level.wordIds.map(prefixId)
      }))
    }))
  };
}

export const vocabularyRegistry = {
  books: nce1997Books,
  legacyBooks: [
    newConcept1Mock,
    newConcept2Mock,
    newConcept3Mock,
    newConcept4Mock
  ].map(namespaceLegacyBook),
  manifest: nce1997ContentManifest
} satisfies {
  books: VocabularyImportBook[];
  legacyBooks: VocabularyImportBook[];
  manifest: typeof nce1997ContentManifest;
};

export const vocabularySources = vocabularyRegistry.books;
export const legacyVocabularySources = vocabularyRegistry.legacyBooks;
export const contentManifest = vocabularyRegistry.manifest;
