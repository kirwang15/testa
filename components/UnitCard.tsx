"use client";

import Link from "next/link";
import { useI18n } from "@/lib/use-i18n";
import {
  getLessonRangeLabelValue,
  getUnitNumber
} from "@/lib/curriculum-presentation";
import type { ProgressStatus } from "@/lib/curriculum-index";
import type {
  CurriculumBookIndex,
  CurriculumUnitIndex,
  UnitProgress
} from "@/types/game";

type UnitCardProps = {
  book: CurriculumBookIndex;
  unit: CurriculumUnitIndex;
  progress: UnitProgress;
  status: ProgressStatus;
  levelCount: number;
  locked?: boolean;
};

export function UnitCard({
  book,
  unit,
  progress,
  status,
  levelCount,
  locked = false
}: UnitCardProps) {
  const { t } = useI18n();
  const unitNumber = getUnitNumber(unit);
  const unitTitle = t("unit.displayTitle", { unit: unitNumber });
  const lessonRange = getLessonRangeLabelValue(unit.lessonRange);
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
              {lessonRange
                ? t("unit.lessonSpan", { range: lessonRange })
                : t("unit.practice")}
            </p>
            <h2 className="mt-1 text-2xl font-black text-ink">{unitTitle}</h2>
            <p className="mt-2 text-sm font-bold text-coral">
              {t("common.cefr", { level: unit.difficulty })}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="rounded-lg border-2 border-ink bg-white px-3 py-1 text-xs font-black uppercase text-ink">
              {t("common.levels", { count: levelCount })}
            </span>
            <span
              className={`rounded-lg border-2 border-ink px-3 py-1 text-xs font-black uppercase ${
                status === "completed"
                  ? "bg-leaf text-white"
                  : status === "recommended"
                    ? "bg-mint text-white"
                    : "bg-white text-ink"
              }`}
            >
              {statusLabel}
            </span>
          </div>
        </div>
        <p className="text-sm font-semibold text-ink/75">
          {t("unit.summary", { count: unit.wordCount })}
        </p>
      </div>

      <div className="space-y-3">
        <div className="h-3 rounded-lg border-2 border-ink bg-paper">
          <div
            className="h-full rounded-md bg-leaf"
            style={{ width: `${progress.completionPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-bold text-ink">
            <p>
              {t("common.levelsComplete", { done: progress.completedLevels, total: progress.totalLevels })}
            </p>
            <p className="text-xs text-ink/60">
              {t("book.mastery", { learned: progress.learnedWords, mastered: progress.masteredWords })}
            </p>
          </div>
          <span className="rounded-lg border-2 border-ink bg-ink px-3 py-2 text-sm font-black text-white group-hover:bg-leaf">
            {locked
              ? t("map.locked")
              : status === "recommended"
                ? t("common.continue")
                : t("common.openUnit")}
          </span>
        </div>
      </div>
    </>
  );
  const cardClass = "group flex min-h-56 flex-col justify-between rounded-lg border-2 border-ink bg-white p-5 shadow-crisp";
  return locked ? (
    <article className={`${cardClass} opacity-70`} aria-label={`${unitTitle}. ${t("map.locked")}`}>
      {content}
    </article>
  ) : (
    <Link
      href={`/books/${book.id}/units/${unit.id}`}
      className={`focus-ring ${cardClass} transition hover:-translate-y-1 hover:bg-paper`}
    >
      {content}
    </Link>
  );
}
