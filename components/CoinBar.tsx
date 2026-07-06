type CoinBarProps = {
  coins: number;
  onReset?: () => void;
};

export function CoinBar({ coins, onReset }: CoinBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex min-h-12 items-center gap-3 rounded-lg border-2 border-ink bg-sun px-4 py-2 text-ink shadow-crisp">
        <span
          aria-hidden="true"
          className="grid h-8 w-8 place-items-center rounded-md border-2 border-ink bg-white text-base font-black"
        >
          ¢
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-black uppercase text-ink/70">Coins</p>
          <p className="text-lg font-black">{coins}</p>
        </div>
      </div>
      {onReset ? (
        <button
          type="button"
          onClick={onReset}
          className="focus-ring min-h-12 rounded-lg border-2 border-ink bg-white px-4 py-2 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:bg-paper"
        >
          Reset save
        </button>
      ) : null}
    </div>
  );
}
