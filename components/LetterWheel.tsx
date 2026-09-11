"use client";

import { Delete, X } from "lucide-react";
import { useLevelI18n } from "@/lib/level-i18n";

type LetterWheelProps = {
  letters: string[];
  selectedIndexes: number[];
  currentWord: string;
  disabled?: boolean;
  readOnlyDetail?: boolean;
  invalid?: boolean;
  isSubmitting?: boolean;
  onBackspace: () => void;
  onChoose: (index: number) => void;
  onClear: () => void;
  sanitizeText?: (text: string) => string;
};

export function LetterWheel({
  letters,
  selectedIndexes,
  currentWord,
  disabled = false,
  readOnlyDetail = false,
  invalid = false,
  isSubmitting = false,
  onBackspace,
  onChoose,
  onClear,
  sanitizeText = (text) => text
}: LetterWheelProps) {
  const { t } = useLevelI18n();
  const selectedCount = selectedIndexes.length;
  const selectedLetters = currentWord.split("");
  const canEdit = !disabled && !isSubmitting && selectedCount > 0;

  return (
    <div
      className={[
        "relative mx-auto w-full max-w-[390px] rounded-2xl transition",
        invalid ? "ring-4 ring-red-500/80" : "",
        readOnlyDetail ? "opacity-55 saturate-50" : ""
      ].join(" ")}
      role="group"
      aria-invalid={invalid || undefined}
      aria-describedby="letter-wheel-state"
      aria-label={sanitizeText(
        readOnlyDetail
          ? t("game.detailInputDisabled")
          : invalid
            ? t("game.wordNeedsCorrection")
            : t("game.letterInput")
      )}
    >
      {selectedLetters.length > 0 ? (
        <div className="game-word-ribbon absolute left-1/2 top-[-3.1rem] z-20 min-h-11 w-[min(100%,300px)] -translate-x-1/2">
          {selectedLetters.map((letter, index) => (
            <span
              key={`${letter}-${index}`}
              className={[
                "game-ribbon-letter animate-selected-pulse",
                invalid ? "border-red-200 bg-red-700 text-white" : ""
              ].join(" ")}
            >
              {letter}
            </span>
          ))}
        </div>
      ) : null}

      <div className="game-wheel-shell relative mx-auto h-[244px] w-[244px] max-w-full sm:h-[300px] sm:w-[300px] lg:h-[360px] lg:w-[360px]">
        <div className="game-wheel-core">
          <span>{disabled ? sanitizeText(t("common.clear")) : `${selectedCount}/${letters.length}`}</span>
        </div>
        {letters.map((letter, index) => {
          const angle = (Math.PI * 2 * index) / letters.length - Math.PI / 2;
          const x = 50 + Math.cos(angle) * 41;
          const y = 50 + Math.sin(angle) * 41;
          const selected = selectedIndexes.includes(index);
          const selectionOrder = selected ? selectedIndexes.indexOf(index) + 1 : 0;

          return (
            <button
              key={`${letter}-${index}`}
              type="button"
              onClick={() => onChoose(index)}
              disabled={disabled || selected}
              className={[
                "game-letter-button focus-ring absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center text-xl font-black transition disabled:cursor-not-allowed disabled:opacity-75 sm:h-12 sm:w-12 sm:text-2xl lg:h-14 lg:w-14 lg:text-[1.65rem]",
                selected
                  ? invalid
                    ? "z-10 scale-105 bg-red-700 text-white ring-4 ring-red-300/40"
                    : "z-10 scale-105 text-white ring-4 ring-amber-100/25"
                  : "text-[#210d06] hover:brightness-110"
              ].join(" ")}
              style={{
                left: `${x}%`,
                top: `${y}%`
              }}
            >
              <span>{letter}</span>
              {selected ? (
                <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border border-amber-100/60 bg-[#1d0b05] text-xs font-black text-amber-100">
                  {selectionOrder}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="game-wheel-actions">
        <button
          type="button"
          onClick={onClear}
          disabled={!canEdit}
          className="game-wheel-action focus-ring"
          aria-label={sanitizeText(t("game.clearLetters"))}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onBackspace}
          disabled={!canEdit}
          className="game-wheel-action focus-ring"
          aria-label={sanitizeText(t("game.removeLetter"))}
        >
          <Delete className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <p
        id="letter-wheel-state"
        role={invalid ? "alert" : "status"}
        className={[
          "mt-2 text-center text-[11px] font-black",
          invalid ? "text-red-200" : "text-amber-100/70"
        ].join(" ")}
        aria-live="polite"
      >
        {sanitizeText(
          readOnlyDetail
            ? t("game.detailInputDisabled")
            : invalid
            ? t("game.wordNeedsCorrection")
            : isSubmitting
              ? t("game.autoChecking")
              : t("game.autoCheckGuide")
        )}
      </p>
    </div>
  );
}
