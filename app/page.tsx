"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GameLogo } from "@/components/GameLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  getAllBooks,
  getAllLevels,
  getBookProgress,
  getLevelsByBookId,
  getProgressSummary,
} from "@/lib/curriculum-index";
import { getRecommendedEligibleLevel } from "@/lib/content-access";
import { curriculumContentVersion } from "@/lib/curriculum-index";
import { loadReviewMetadataIndex } from "@/lib/review-metadata";
import { getDueReviewSnapshot } from "@/lib/review-queue";
import { useI18n } from "@/lib/use-i18n";
import type { ReviewMetadataIndex } from "@/types/game";
import {
  selectActiveGameProgress,
  selectActiveProfile,
  useGameStore
} from "@/store/gameStore";

export default function HomePage() {
  const { t } = useI18n();
  const profile = useGameStore(selectActiveProfile);
  const progress = useGameStore(selectActiveGameProgress);
  const [reviewMetadata, setReviewMetadata] = useState<ReviewMetadataIndex>();
  const [reviewMetadataStatus, setReviewMetadataStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const books = getAllBooks();
  const progressSummary = getProgressSummary(progress.levels);
  const recommendedLevel = getRecommendedEligibleLevel(
    getAllLevels(),
    progress.levels,
    profile
  );
  const dueSnapshot = useMemo(
    () =>
      reviewMetadata
        ? getDueReviewSnapshot(progress.words, profile, reviewMetadata)
        : undefined,
    [profile, progress.words, reviewMetadata]
  );
  const dueCount = dueSnapshot?.sessionCandidates.length ?? 0;
  const restrictedDueCount = dueSnapshot?.restricted.length ?? 0;
  const recoverableDueCount = dueSnapshot?.recoverable.length ?? 0;
  const recommendedBookIndex = recommendedLevel
    ? books.findIndex((book) => book.id === recommendedLevel.bookId)
    : -1;
  const recommendedLevelIndex = recommendedLevel
    ? getLevelsByBookId(recommendedLevel.bookId).findIndex(
        (level) => level.id === recommendedLevel.id
      )
    : -1;

  useEffect(() => {
    let current = true;
    setReviewMetadataStatus("loading");
    loadReviewMetadataIndex(curriculumContentVersion).then((metadata) => {
      if (!current) return;
      setReviewMetadata(metadata);
      setReviewMetadataStatus(metadata ? "ready" : "error");
    });
    return () => {
      current = false;
    };
  }, []);

  return (
    <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-lg border-2 border-ink bg-white p-4 shadow-crisp sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <GameLogo />
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <Link
                href="/settings"
                className="focus-ring inline-grid min-h-11 min-w-11 place-items-center rounded-xl border-2 border-ink bg-white text-ink shadow-crisp transition hover:-translate-y-0.5 hover:bg-paper"
                aria-label={t("nav.settings")}
              >
                <span className="px-2 text-xs font-black">{t("nav.settings")}</span>
              </Link>
            </div>
          </div>
          <p className="mt-3 text-sm font-black text-ink/65">
            {t("home.greeting", { name: profile.nickname })}
          </p>
        </header>

        <section className="overflow-hidden rounded-lg border-2 border-ink bg-ink text-white shadow-crisp">
          <div className="p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-sun">
              {t("home.todayEyebrow")}
            </p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black sm:text-3xl">
                  {recommendedLevel
                    ? t("home.todayTitle")
                    : t("home.todayComplete")}
                </h2>
                {recommendedLevel ? (
                  <p className="mt-2 text-sm font-bold text-white/70">
                    {t("home.todayLevel", {
                      book: recommendedBookIndex + 1,
                      level: recommendedLevelIndex + 1,
                      lesson: recommendedLevel.lessonAnchor ?? "—"
                    })}
                  </p>
                ) : (
                  <p className="mt-2 text-sm font-bold text-white/70">
                    {t("home.pathComplete")}
                  </p>
                )}
              </div>
              <span className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-black text-sun">
                {progressSummary.completedLevels}/{progressSummary.totalLevels}
              </span>
            </div>
            <Link
              href={recommendedLevel ? `/levels/${recommendedLevel.id}` : "/map"}
              className="focus-ring mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-white bg-mint px-5 py-3 font-black text-white shadow-crisp transition hover:-translate-y-0.5 sm:w-auto"
            >
              {recommendedLevel
                ? t("home.startAdventure")
                : t("home.exploreMap")}
            </Link>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border-2 border-ink bg-paper p-4 shadow-crisp">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-coral">
              {t("home.dueReview")}
            </p>
            <p className="mt-1 text-xl font-black text-ink">
              {reviewMetadataStatus === "loading"
                ? t("review.loading")
                : t("home.dueNow", { count: dueCount })}
            </p>
            <p className="mt-1 text-sm font-bold text-ink/60">
              {reviewMetadataStatus === "error"
                ? t("review.loadErrorDescription")
                : dueCount > 0
                  ? t("home.reviewReady")
                  : t("home.reviewClear")}
            </p>
            {reviewMetadataStatus === "ready" &&
            (restrictedDueCount > 0 || recoverableDueCount > 0) ? (
              <p className="mt-2 text-xs font-black text-ink/55">
                {t("home.reviewHeldCounts", {
                  restricted: restrictedDueCount,
                  recoverable: recoverableDueCount
                })}
              </p>
            ) : null}
            {reviewMetadataStatus === "ready" && dueCount > 0 ? (
              <Link
                href="/review"
                className="focus-ring mt-3 inline-flex min-h-11 items-center rounded-lg border-2 border-ink bg-coral px-4 py-2 text-sm font-black text-white"
              >
                {t("home.openReview")}
              </Link>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/map"
              className="focus-ring flex min-h-32 flex-col justify-end rounded-lg border-2 border-ink bg-white p-4 text-ink shadow-crisp transition hover:-translate-y-0.5 hover:bg-paper"
            >
              <span className="text-sm font-black">{t("home.openMap")}</span>
            </Link>
            <Link
              href="/books"
              className="focus-ring flex min-h-32 flex-col justify-end rounded-lg border-2 border-ink bg-white p-4 text-ink shadow-crisp transition hover:-translate-y-0.5 hover:bg-paper"
            >
              <span className="text-sm font-black">{t("home.openLibrary")}</span>
            </Link>
          </div>
        </section>

        <section className="rounded-lg border-2 border-ink bg-white p-4 shadow-crisp">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black text-ink">{t("home.bookProgress")}</h2>
            <Link
              href="/parent"
              className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-ink bg-paper px-3 py-2 text-xs font-black text-ink"
            >
              {t("nav.parent")}
            </Link>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {books.map((book, bookIndex) => {
              const bookProgress = getBookProgress(
                book.id,
                progress.levels,
                progress.words
              );
              return (
                <Link
                  key={book.id}
                  href={`/books/${book.id}`}
                  className="focus-ring flex min-h-14 items-center gap-3 rounded-lg border-2 border-ink/15 bg-paper px-3 py-2 text-ink transition hover:border-ink"
                  aria-label={t("home.bookProgressLabel", {
                    book: bookIndex + 1,
                    done: bookProgress.completedLevels,
                    total: bookProgress.totalLevels
                  })}
                >
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-lg border-2 border-ink bg-white text-sm font-black">
                    {bookIndex + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black">
                      {t("common.bookNumber", { book: bookIndex + 1 })} · {book.level}
                    </span>
                    <span className="mt-1 block h-2 overflow-hidden rounded-full bg-white">
                      <span
                        className="block h-full rounded-full bg-mint"
                        style={{ width: `${bookProgress.completionPercent}%` }}
                      />
                    </span>
                  </span>
                  <span className="text-xs font-black text-ink/60">
                    {bookProgress.completedLevels}/50
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <p className="pb-2 text-center text-xs font-bold text-ink/55">
          {t("home.privateNote")}
        </p>
      </div>
    </main>
  );
}
