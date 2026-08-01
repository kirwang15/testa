"use client";

import { useCallback } from "react";
import { translate, type TranslationKey } from "./i18n";
import { selectActiveProfile, useGameStore } from "../store/gameStore";

type TranslationParams = Record<string, string | number>;

export function useI18n() {
  const language = useGameStore(selectActiveProfile).preferences.uiLanguage;
  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) =>
      translate(language, key, params),
    [language]
  );

  return { language, t };
}
