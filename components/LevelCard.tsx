"use client";

import Link from "next/link";
import { useI18n } from "@/lib/use-i18n";
import {
  getDifficultyTranslationKey,
  getLevelPosition
} from "@/lib/curriculum-presentation";
import type { ProgressStatus } from "@/lib/curriculum-index";
import type { CurriculumLevelIndex, LevelProgress } from "@/types/game";

type LevelCardProps = {
  level: CurriculumLevelIndex;
  progress: LevelProgress;
  status: ProgressStatus;
  isAdvanced?: boolean;
  locked?: boolean;
};

export function LevelCard({
  level,
  progress,
  status,
  isAdvanced = false,
  locked = false
}: LevelCardProps) {
  const { t } = useI18n();
  const foundCount = progress.foundWords.length;
  const totalCount = level.wordCount;
  const position = getLevelPosition(level);
  const title = t("level.displayTitle", {
    book: position.book,
    level: position.level ?? 1
  });
  const completed = progress.completed;
  const stateLabel =
    status === "completed"
      ? t("common.completedState")
      : status === "recommended"
        ? t("common.recommended")
        : t("common.available");
  const statusClass =
    status === "completed"
      ? "bg-leaf text-white"
      : status === "recommended"
        ? "bg-mint text-white"
        : "bg-white text-ink";
  const cardClass = [
    "group flex min-h-56 flex-col justify-between rounded-lg border-2 border-ink bg-white p-5 shadow-crisp transition hover:-translate-y-1 hover:bg-paper",
    status === "recommended" ? "ring-4 ring-sun/60" : ""
  ].join(" ");
  const progressPercent = totalCount === 0 ? 0 : (foundCount / totalCount) * 100;
  const actionLabel = completed
    ? t("common.replay")
    : status === "recommended"
      ? t("common.continue")
      : t("common.play");

  const content = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className={[
              "text-sm font-black",
              completed ? "text-leaf" : "text-coral"
            ].join(" ")}
          >
            {t("level.label", { level: position.level ?? 1 })}
          </p>
          <h2 className="mt-1 text-2xl font-black">{title}</h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={[
              "rounded-lg border-2 border-ink px-3 py-1 text-xs font-black uppercase",
              statusClass
            ].join(" ")}
          >
            {stateLabel}
          </span>
          {level.difficulty ? (
            <span className="rounded-lg border-2 border-ink bg-white px-3 py-1 text-xs font-black uppercase text-ink">
              {t(getDifficultyTranslationKey(level.difficulty))}
            </span>
          ) : null}
          {isAdvanced ? (
            <span className="rounded-lg border-2 border-ink bg-sun px-3 py-1 text-xs font-black uppercase text-ink">
              {t("level.jumpAhead")}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2" aria-hidden="true">
        {Array.from({ length: totalCount }, (_, index) => (
          <span
            key={index}
            className={[
              "h-9 w-9 rounded-lg border-2 border-ink",
              completed ? "bg-leaf" : "bg-paper"
            ].join(" ")}
          />
        ))}
      </div>

      <div className="mt-5">
        <div className="h-3 rounded-lg border-2 border-ink bg-paper">
          <div
            className={[
              "h-full rounded-md",
              completed ? "bg-leaf" : status === "recommended" ? "bg-mint" : "bg-ink/20"
            ].join(" ")}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-sm font-bold">
            <p>{completed ? t("common.completedState") : t("level.words", { done: foundCount, total: totalCount })}</p>
            {isAdvanced ? (
              <p className="text-xs text-ink/60">
                {t("level.advancedDescription")}
              </p>
            ) : null}
          </div>
          <span className="rounded-lg border-2 border-ink bg-ink px-3 py-2 text-sm font-black text-white group-hover:bg-mint">
            {locked ? t("map.locked") : actionLabel}
          </span>
        </div>
      </div>
    </>
  );
  return locked ? (
    <article className={`${cardClass} opacity-70`} aria-label={`${title}. ${t("map.locked")}`}>
      {content}
    </article>
  ) : (
    <Link href={`/levels/${level.id}`} className={`focus-ring ${cardClass}`}>
      {content}
    </Link>
  );
}
