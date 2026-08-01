"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getDocumentLanguage } from "@/lib/profile-state";
import { selectActiveProfile, useGameStore } from "@/store/gameStore";

export function AppLanguageSync() {
  const pathname = usePathname();
  const profile = useGameStore(selectActiveProfile);
  const language = profile.preferences.uiLanguage;

  useEffect(() => {
    const expectedLanguage = getDocumentLanguage(language);
    const expectedTitle =
      language === "zh-CN"
        ? "Word Trail · 单词冒险"
        : "Word Trail · Crossword Adventure";
    const synchronizeDocument = () => {
      if (document.documentElement.lang !== expectedLanguage) {
        document.documentElement.lang = expectedLanguage;
      }
      if (document.title !== expectedTitle) {
        document.title = expectedTitle;
      }
    };

    synchronizeDocument();
    const observer = new MutationObserver(synchronizeDocument);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true
    });

    return () => observer.disconnect();
  }, [language, pathname, profile.id]);

  return null;
}
