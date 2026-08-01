"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/lib/use-i18n";
import {
  selectActiveProfile,
  selectIsReadOnly,
  useGameStore
} from "@/store/gameStore";

type LanguageSwitcherProps = {
  inverse?: boolean;
};

export function LanguageSwitcher({ inverse = false }: LanguageSwitcherProps) {
  const profile = useGameStore(selectActiveProfile);
  const updatePreferences = useGameStore((state) => state.updatePreferences);
  const isReadOnly = useGameStore(selectIsReadOnly);
  const { t } = useI18n();
  const current = profile.preferences.uiLanguage;
  const next = current === "en" ? "zh-CN" : "en";

  return (
    <button
      type="button"
      onClick={() => updatePreferences({ uiLanguage: next })}
      disabled={isReadOnly}
      className={[
        "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0",
        inverse
          ? "border-amber-100/25 bg-black/30 text-amber-50"
          : "border-2 border-ink bg-white text-ink shadow-crisp"
      ].join(" ")}
      aria-label={
        next === "en" ? t("language.switchEnglish") : t("language.switchChinese")
      }
    >
      <Languages className="h-4 w-4" aria-hidden="true" />
      <span>{next === "en" ? "EN" : "中文"}</span>
    </button>
  );
}
