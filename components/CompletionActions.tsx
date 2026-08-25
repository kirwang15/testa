"use client";

import { ArrowRight, Map, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useLevelI18n } from "@/lib/level-i18n";
import { buildLevelHref } from "@/lib/level-navigation";

type CompletionActionsProps = {
  stars: number;
  nextLevelId?: string;
  onReplay: () => void;
  replayDisabled?: boolean;
  returnTo: string;
  onFinishTutorial?: () => void;
};

const actionClass =
  "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-100/25 px-4 py-2 text-sm font-black transition hover:-translate-y-0.5 hover:brightness-110";

export function CompletionActions({
  stars,
  nextLevelId,
  onReplay,
  replayDisabled = false,
  returnTo,
  onFinishTutorial
}: CompletionActionsProps) {
  const { t } = useLevelI18n();
  return (
    <section className="mt-4 rounded-2xl border border-emerald-100/25 bg-emerald-900/45 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-100/75">
            {t("completion.eyebrow")}
          </p>
          <h2 className="mt-1 text-xl font-black text-white">{t("completion.title")}</h2>
        </div>
        <div
          className="flex min-h-11 items-center gap-1 rounded-full border border-amber-100/25 bg-black/25 px-3 text-amber-200"
          aria-label={t("completion.stars", { count: stars })}
        >
          <Sparkles className="h-5 w-5" aria-hidden="true" />
          <span className="font-black">{stars}/3</span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {nextLevelId ? (
          <Link
            href={buildLevelHref(nextLevelId, returnTo)}
            replace
            className={`${actionClass} bg-emerald-500 text-[#10251e]`}
          >
            {t("completion.next")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
        <Link href="/map" className={`${actionClass} bg-white/90 text-[#2a1208]`}>
          <Map className="h-4 w-4" aria-hidden="true" />
          {t("completion.map")}
        </Link>
        <button
          type="button"
          onClick={onReplay}
          disabled={replayDisabled}
          className={`${actionClass} bg-black/30 text-white disabled:cursor-not-allowed disabled:opacity-45`}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {t("completion.replay")}
        </button>
        {onFinishTutorial ? (
          <button
            type="button"
            onClick={onFinishTutorial}
            className={`${actionClass} bg-sun text-[#2a1208] sm:col-span-2`}
          >
            {t("tutorial.finish")}
          </button>
        ) : null}
      </div>
    </section>
  );
}
