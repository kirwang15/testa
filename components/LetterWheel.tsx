type LetterWheelProps = {
  letters: string[];
  selectedIndexes: number[];
  disabled?: boolean;
  onBackspace: () => void;
  onChoose: (index: number) => void;
};

export function LetterWheel({
  letters,
  selectedIndexes,
  disabled = false,
  onBackspace,
  onChoose
}: LetterWheelProps) {
  const radius = letters.length > 5 ? 96 : 88;
  const selectedCount = selectedIndexes.length;

  return (
    <div className="rounded-lg border-2 border-ink bg-white p-4 shadow-crisp sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase text-coral">Letters</p>
          <p className="text-sm font-bold text-ink/70">Use each tile once per word.</p>
        </div>
        <span className="rounded-lg border-2 border-ink bg-paper px-3 py-1 text-sm font-black text-ink">
          {selectedCount}/{letters.length}
        </span>
      </div>

      <div className="relative mx-auto mt-4 h-72 w-72 max-w-full">
        <div
          className={[
            "absolute left-1/2 top-1/2 grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-lg border-2 border-ink bg-paper px-2 text-center font-black text-ink",
            disabled ? "opacity-60" : ""
          ].join(" ")}
        >
          <div>
            <p className="text-sm">{disabled ? "Level clear" : selectedCount > 0 ? `${selectedCount} picked` : "Tap in order"}</p>
            <p className="mt-1 text-[11px] font-bold text-ink/70">
              {disabled ? "Great work." : "Build from the wheel."}
            </p>
          </div>
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
                "focus-ring absolute left-1/2 top-1/2 grid h-14 w-14 place-items-center rounded-lg border-2 border-ink text-xl font-black transition disabled:cursor-not-allowed disabled:opacity-70 sm:h-16 sm:w-16 sm:text-2xl",
                selected
                  ? "z-10 scale-105 bg-mint text-white shadow-crisp ring-4 ring-mint/20"
                  : "bg-sun text-ink hover:-translate-y-1 hover:bg-white"
              ].join(" ")}
              style={{
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
              }}
            >
              <span>{letter}</span>
              {selected ? (
                <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border-2 border-ink bg-white text-xs font-black text-mint">
                  {selectionOrder}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onBackspace}
        disabled={disabled || selectedIndexes.length === 0}
        className="focus-ring mt-4 min-h-12 w-full rounded-lg border-2 border-ink bg-white px-4 py-3 font-black text-ink transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink/50 disabled:opacity-70"
      >
        Backspace
      </button>
    </div>
  );
}
