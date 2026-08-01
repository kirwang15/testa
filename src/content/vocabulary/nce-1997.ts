import generatedContent from "./generated/nce-1997.json";
import generatedContentManifest from "./generated/content-manifest.json";
import {
  applyEditorialOverrides,
  EDITORIAL_OVERRIDE_VERSION
} from "./editorial-overrides";
import type {
  ContentManifest,
  VocabularyImportBook
} from "@/types/game";

type GeneratedVocabularyContent = {
  manifest: ContentManifest;
  books: VocabularyImportBook[];
};

const content = generatedContent as GeneratedVocabularyContent;
const contentIdentity = generatedContentManifest as ContentManifest & {
  contentVersion: string;
};

export const nce1997ContentManifest = {
  ...content.manifest,
  ...contentIdentity,
  version: contentIdentity.contentVersion,
  generatorVersion: contentIdentity.generatorVersion
};
export const nce1997Books = applyEditorialOverrides(content.books);
