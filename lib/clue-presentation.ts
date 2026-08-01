import type { ClueLanguage, VocabularySource } from "../types/game";

export type ActiveCluePresentation = {
  language: ClueLanguage;
  text: string;
  source?: VocabularySource;
};

export function getActiveCluePresentation(
  language: ClueLanguage,
  meanings: { english?: string; chinese?: string },
  fallback: string,
  source?: VocabularySource
): ActiveCluePresentation {
  const selected = language === "zh-CN" ? meanings.chinese : meanings.english;
  return {
    language,
    text: selected?.trim() || fallback,
    ...(source ? { source } : {})
  };
}
