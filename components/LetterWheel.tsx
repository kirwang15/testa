"use client";

import { Check, Delete, RotateCcw, X } from "lucide-react";
import { useI18n } from "@/lib/use-i18n";

type LetterWheelProps = {
  letters: string[];
  selectedIndexes: number[];
  currentWord: string;
  canSubmit?: boolean;
  disabled?: boolean;
  isSubmitting?: boolean;
  onBackspace: () => void;
  onChoose: (index: number) => void;
  onClear: () => void;
  onSubmit: () => void;
  sanitizeText?: (text: string) => string;
};

export function LetterWheel({
  letters,
  selectedIndexes,
  currentWord,
  canSubmit = false,
  disabled = false,
  isSubmitting = false,
  onBackspace,
  onChoose,
  onClear,
  onSubmit,
  sanitizeText = (text) => text
}: LetterWheelProps) {
  const { t } = useI18n();
  const radius = letters.length > 5 ? 61 : 55;
  const selectedCount = selectedIndexes.length;
  const selectedLetters = currentWord.split("");
  const canEdit = !disabled && !isSubmitting && selectedCount > 0;
  const submitEnabled = !disabled && !isSubmitting && canSubmit;

  return (
    <div className="relative mx-auto w-full max-w-[320px]">
      {selectedLetters.length > 0 ? (
        <div className="game-word-ribbon absolute left-1/2 top-[-3.1rem] z-20 min-h-11 w-[min(100%,300px)] -translate-x-1/2">
          {selectedLetters.map((letter, index) => (
            <span
              key={`${letter}-${index}`}
              className="game-ribbon-letter animate-selected-pulse"
            >
              {letter}
            </span>
          ))}
        </div>
      ) : null}

      <div className="game-wheel-shell relative mx-auto h-[184px] w-[184px] max-w-full sm:h-[212px] sm:w-[212px]">
        <div className="game-wheel-core">
          <span>{disabled ? sanitizeText(t("common.clear")) : `${selectedCount}/${letters.length}`}</span>
        </div>
        {letters.map((letter, index) => {
          const angle = (Math.PI * 2 * index) / letters.length - Math.PI / 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const selected = selectedIndexes.includes(index);
          const selectionOrder = selected ? selectedIndexes.indexOf(index) + 1 : 0;

          return (
            <button
              key={`${letter}-${index}`}
              type="button"
              onClick={() => onChoose(index)}
              disabled={disabled || selected}
              className={[
                "game-letter-button focus-ring absolute left-1/2 top-1/2 grid h-11 w-11 place-items-center text-xl font-black transition disabled:cursor-not-allowed disabled:opacity-75 sm:h-12 sm:w-12 sm:text-2xl",
                selected
                  ? "z-10 scale-105 text-white ring-4 ring-amber-100/25"
                  : "text-[#210d06] hover:brightness-110"
              ].join(" ")}
              style={{
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
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
        <button
          type="button"
          onClick={onSubmit}
          disabled={!submitEnabled}
          className="game-wheel-action game-wheel-action-submit focus-ring"
          aria-label={sanitizeText(t("game.submitWord"))}
        >
          {isSubmitting ? (
            <RotateCcw className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
