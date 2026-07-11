import { ArrowRight, Map, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";

type CompletionActionsProps = {
  stars: number;
  nextLevelId?: string;
  onReplay: () => void;
};

const actionClass =
  "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-100/25 px-4 py-2 text-sm font-black transition hover:-translate-y-0.5 hover:brightness-110";

export function CompletionActions({
  stars,
  nextLevelId,
  onReplay
}: CompletionActionsProps) {
  return (
    <section className="mt-4 rounded-2xl border border-emerald-100/25 bg-emerald-900/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-100/75">
            Adventure complete
          </p>
          <h2 className="mt-1 text-xl font-black text-white">Choose your next move</h2>
        </div>
        <div
          className="flex min-h-11 items-center gap-1 rounded-full border border-amber-100/25 bg-black/25 px-3 text-amber-200"
          aria-label={`${stars} of 3 stars earned`}
        >
          <Sparkles className="h-5 w-5" aria-hidden="true" />
          <span className="font-black">{stars}/3</span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {nextLevelId ? (
          <Link
            href={`/levels/${nextLevelId}`}
            className={`${actionClass} bg-emerald-500 text-[#10251e]`}
          >
            Next level
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
        <Link
          href="/review"
          className={`${actionClass} bg-amber-300 text-[#2a1208]`}
        >
          Review mistakes
        </Link>
        <Link href="/books" className={`${actionClass} bg-white/90 text-[#2a1208]`}>
          <Map className="h-4 w-4" aria-hidden="true" />
          Map
        </Link>
        <button
          type="button"
          onClick={onReplay}
          className={`${actionClass} bg-black/30 text-white`}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Replay level
        </button>
      </div>
    </section>
  );
}
