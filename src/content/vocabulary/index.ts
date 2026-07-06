import { newConcept1Mock } from "./new-concept-1.mock";
import { newConcept2Mock } from "./new-concept-2.mock";
import { newConcept3Mock } from "./new-concept-3.mock";
import { newConcept4Mock } from "./new-concept-4.mock";
import type { VocabularyImportBook } from "@/types/game";

export const vocabularyRegistry = {
  books: [
    newConcept1Mock,
    newConcept2Mock,
    newConcept3Mock,
    newConcept4Mock
  ]
} satisfies {
  books: VocabularyImportBook[];
};

export const vocabularySources = vocabularyRegistry.books;
