"use client";

import { useI18n } from "@/lib/use-i18n";
import type { ClueLanguage } from "@/types/game";

type WordMeaningToggleProps = {
  englishMeaning?: string;
  chineseMeaning?: string;
  fallbackMeaning?: string;
  wordLabel?: string;
  className?: string;
  sanitizeText?: (text: string) => string;
  language: ClueLanguage;
  onToggle: () => void;
};

function normalizeMeaning(value: string | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

export function WordMeaningToggle({
  englishMeaning,
  chineseMeaning,
  fallbackMeaning,
  wordLabel,
  className,
  sanitizeText = (text) => text,
  language,
  onToggle
}: WordMeaningToggleProps) {
  const { t } = useI18n();
  const normalizedEnglishMeaning =
    normalizeMeaning(englishMeaning) ?? normalizeMeaning(fallbackMeaning);
  const normalizedChineseMeaning = normalizeMeaning(chineseMeaning);
  const canToggle =
    Boolean(normalizedEnglishMeaning) &&
    Boolean(normalizedChineseMeaning) &&
    normalizedEnglishMeaning !== normalizedChineseMeaning;

  const activeMeaning = canToggle
    ? language === "zh-CN"
      ? normalizedChineseMeaning
      : normalizedEnglishMeaning
    : normalizedEnglishMeaning ??
      normalizedChineseMeaning ??
      sanitizeText(t("common.noExplanation"));

  const activeLanguage =
    !normalizedEnglishMeaning && normalizedChineseMeaning
      ? "中文"
      : canToggle && language === "zh-CN"
        ? "中文"
        : "EN";

  const buttonLabel = wordLabel ? `meaning for ${wordLabel}` : "word meaning";

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <span className="rounded-md border-2 border-current/20 px-2 py-1 text-[11px] font-black leading-none">
          {activeLanguage}
        </span>
        {canToggle ? (
          <span className="text-xs font-medium opacity-70">
            {sanitizeText(language === "en" ? t("language.showChineseClue") : t("language.showEnglishClue"))}
          </span>
        ) : null}
      </div>
      {canToggle ? (
        <button
          type="button"
          aria-label={sanitizeText(
            `${language === "zh-CN" ? t("language.showEnglishClue") : t("language.showChineseClue")} ${buttonLabel}`
          )}
          aria-pressed={language === "zh-CN"}
          onClick={onToggle}
          className="focus-ring mt-2 block min-h-11 rounded-lg px-2 py-2 text-left text-sm font-semibold leading-6 text-current transition hover:bg-white/10 hover:opacity-90"
        >
          {activeMeaning}
        </button>
      ) : (
        <p className="mt-2 text-sm font-semibold leading-6 text-current">
          {activeMeaning}
        </p>
      )}
    </div>
  );
}
