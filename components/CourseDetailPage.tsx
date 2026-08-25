"use client";

import Link from "next/link";
import { ArrowLeft, Check, Play } from "lucide-react";
import {
  getCurriculumById,
  getLevelsByTrackId,
  getProgressSummaryForLevels,
  getTracksByCurriculumId
} from "@/lib/curriculum-index";
import { useI18n } from "@/lib/use-i18n";
import { selectActiveGameProgress, useGameStore } from "@/store/gameStore";
import { buildLevelHref } from "@/lib/level-navigation";

export function CourseDetailPage({ curriculumId }: { curriculumId: string }) {
  const { language, t } = useI18n();
  const progress = useGameStore(selectActiveGameProgress);
  const course = getCurriculumById(curriculumId);
  if (!course) return null;
  const tracks = getTracksByCurriculumId(curriculumId);
  const courseLevels = tracks.flatMap((track) => getLevelsByTrackId(track.id));
  const courseProgress = getProgressSummaryForLevels(courseLevels, progress.levels);
  const title = language === "zh-CN" ? course.titleZh : course.titleEn;

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="overflow-hidden rounded-xl border-2 border-ink bg-ink text-white shadow-crisp">
          <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <Link
                href="/"
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-3 text-sm font-black"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                {t("nav.backHome")}
              </Link>
              <p className="mt-6 text-xs font-black uppercase tracking-[0.16em] text-sun">
                {t("courses.independent")}
              </p>
              <h1 className="mt-2 text-3xl font-black sm:text-4xl">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold text-white/70">
                {curriculumId === "ielts-nawl-v1"
                  ? t("courses.ieltsDetail")
                  : t("courses.kaoyanDetail")}
              </p>
            </div>
            <div className="rounded-xl border border-white/20 bg-white/10 px-5 py-4">
              <p className="text-xs font-black uppercase text-white/55">{t("courses.progress")}</p>
              <p className="mt-1 text-2xl font-black text-sun">
                {courseProgress.completedLevels}/{courseProgress.totalLevels}
              </p>
            </div>
          </div>
        </header>

        <div className="grid gap-4">
          {tracks.map((track) => {
            const levels = getLevelsByTrackId(track.id);
            const trackProgress = getProgressSummaryForLevels(levels, progress.levels);
            const next = levels.find((level) => !progress.levels[level.id]?.completed) ?? levels[0];
            return (
              <section key={track.id} className="rounded-xl border-2 border-ink bg-white p-4 shadow-crisp sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-mint">
                      {t("courses.stage", { stage: track.order })}
                    </p>
                    <h2 className="mt-1 text-xl font-black text-ink">
                      {language === "zh-CN" ? track.titleZh : track.titleEn}
                    </h2>
                  </div>
                  <Link
                    href={buildLevelHref(next.id, `/courses/${curriculumId}`)}
                    className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-ink bg-sun px-4 text-sm font-black text-ink transition hover:-translate-y-0.5"
                  >
                    <Play className="h-4 w-4" aria-hidden="true" />
                    {trackProgress.completedLevels > 0 ? t("common.continue") : t("common.play")}
                  </Link>
                </div>
                <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
                  {levels.map((level, index) => {
                    const completed = progress.levels[level.id]?.completed;
                    return (
                      <Link
                        key={level.id}
                        href={buildLevelHref(level.id, `/courses/${curriculumId}`)}
                        className={`focus-ring grid aspect-square min-h-10 place-items-center rounded-lg border-2 text-xs font-black transition hover:-translate-y-0.5 ${
                          completed
                            ? "border-ink bg-leaf text-white"
                            : "border-ink/25 bg-paper text-ink hover:border-ink"
                        }`}
                        aria-label={t("courses.levelLabel", {
                          stage: track.order,
                          level: index + 1,
                          state: completed ? t("common.completedState") : t("common.available")
                        })}
                      >
                        {completed ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
