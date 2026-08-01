"use client";

import Link from "next/link";
import { useI18n } from "@/lib/use-i18n";
import { getBookNumber } from "@/lib/curriculum-presentation";
import type { BookProgress, CurriculumBookIndex } from "@/types/game";
import type { ProgressStatus } from "@/lib/curriculum-index";

type BookCardProps = {
  book: CurriculumBookIndex;
  progress: BookProgress;
  status?: ProgressStatus;
  locked?: boolean;
};

export function BookCard({
  book,
  progress,
  status = "available",
  locked = false
}: BookCardProps) {
  const { t } = useI18n();
  const bookNumber = getBookNumber(book.id);
  const displayTitle = t("book.displayTitle", { book: bookNumber });
  const completionLabel =
    progress.totalLevels === 0
      ? t("book.noLevels")
      : t("book.progress", { done: progress.completedLevels, total: progress.totalLevels });
  const themeClassByBook = {
    mint: "bg-mint text-white",
    coral: "bg-coral text-white",
    leaf: "bg-leaf text-white",
    gold: "bg-sun text-ink"
  } as const;
  const themeClass = book.colorTheme
    ? themeClassByBook[book.colorTheme]
    : "bg-white text-ink";
  const statusLabel =
    status === "completed"
      ? t("common.completedState")
      : status === "recommended"
        ? t("common.recommended")
        : t("common.available");

  const content = (
    <>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-mint">
              {t("common.cefr", { level: book.level })}
            </p>
            <h2 className="mt-1 text-2xl font-black text-ink">{displayTitle}</h2>
            <p className="mt-1 text-sm font-bold text-coral">
              {t("book.displaySubtitle")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`rounded-lg border-2 border-ink px-3 py-1 text-xs font-black uppercase ${themeClass}`}
            >
              {t("common.units", { count: book.unitIds.length })}
            </span>
            <span className="rounded-lg border-2 border-ink bg-white px-3 py-1 text-xs font-black uppercase text-ink">
              {t("common.words", { count: book.estimatedWordCount ?? 0 })}
            </span>
            <span className="rounded-lg border-2 border-ink bg-white px-3 py-1 text-xs font-black uppercase text-ink">
              {statusLabel}
            </span>
          </div>
        </div>
        <p className="text-sm font-semibold text-ink/75">
          {t("book.displayDescription")}
        </p>
      </div>

      <div className="space-y-3">
        <div className="h-3 rounded-lg border-2 border-ink bg-paper">
          <div
            className="h-full rounded-md bg-mint"
            style={{ width: `${progress.completionPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-bold text-ink">
            <p>{completionLabel}</p>
            <p className="text-xs text-ink/60">
              {t("book.mastery", { learned: progress.learnedWords, mastered: progress.masteredWords })}
            </p>
          </div>
          <span className="rounded-lg border-2 border-ink bg-ink px-3 py-2 text-sm font-black text-white group-hover:bg-mint">
            {locked
              ? t("map.locked")
              : status === "recommended"
                ? t("common.continue")
                : t("common.openBook")}
          </span>
        </div>
      </div>
    </>
  );

  const cardClass = "group flex min-h-64 flex-col justify-between rounded-lg border-2 border-ink bg-white p-5 shadow-crisp";
  return locked ? (
    <article className={`${cardClass} opacity-70`} aria-label={`${displayTitle}. ${t("map.locked")}`}>
      {content}
    </article>
  ) : (
    <Link
      href={`/books/${book.id}`}
      className={`focus-ring ${cardClass} transition hover:-translate-y-1 hover:bg-paper`}
    >
      {content}
    </Link>
  );
}
