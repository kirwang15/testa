import type { FeedbackType } from "@/components/FeedbackBanner";

type CurrentWordProps = {
  currentWord: string;
  disabled?: boolean;
  feedbackType?: FeedbackType;
  isSubmitting?: boolean;
  onClear: () => void;
  onSubmit: () => void;
};

export function CurrentWord({
  currentWord,
  disabled = false,
  feedbackType = "neutral",
  isSubmitting = false,
  onClear,
  onSubmit
}: CurrentWordProps) {
  const canSubmit = !disabled && !isSubmitting && currentWord.length > 0;
  const selectedLetters = currentWord.split("");
  const panelState =
    feedbackType === "wrong" || feedbackType === "duplicate"
      ? "border-coral bg-white animate-feedback-shake"
      : feedbackType === "correct" || feedbackType === "complete"
        ? "border-leaf bg-white animate-feedback-pop"
        : "border-ink bg-white";

  return (
    <div className={["rounded-lg border-2 p-4 shadow-crisp", panelState].join(" ")}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black uppercase text-mint">Current word</p>
        <p className="text-xs font-bold text-ink/70">
          {selectedLetters.length > 0
            ? `${selectedLetters.length} letters selected`
            : "Select from the wheel"}
        </p>
      </div>
      <div className="mt-3 flex min-h-[72px] flex-wrap items-center gap-2 rounded-lg border-2 border-ink bg-paper p-3">
        {selectedLetters.length > 0 ? (
          selectedLetters.map((letter, index) => (
            <span
              key={`${letter}-${index}`}
              className="grid h-10 w-10 place-items-center rounded-lg border-2 border-ink bg-white text-xl font-black text-ink animate-selected-pulse"
            >
              {letter}
            </span>
          ))
        ) : (
          <span className="text-base font-bold text-ink/45">Tap letters</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onClear}
          disabled={disabled || isSubmitting || currentWord.length === 0}
          className="focus-ring min-h-12 rounded-lg border-2 border-ink bg-white px-4 py-3 font-black text-ink transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink/50 disabled:opacity-70"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="focus-ring min-h-12 rounded-lg border-2 border-ink bg-leaf px-4 py-3 font-black text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink/50 disabled:opacity-70"
        >
          {isSubmitting ? "Checking..." : "Submit"}
        </button>
      </div>
    </div>
  );
}
