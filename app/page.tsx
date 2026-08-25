"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GameLogo } from "@/components/GameLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { CourseCatalog } from "@/components/CourseCatalog";
import {
  compactBooks,
  getCompactBookProgress,
  getProgressLevelsByBookId,
  getProgressLevelsByCurriculumId
} from "@/lib/curriculum-progress-index";
import { getRecommendedEligibleLevel } from "@/lib/content-access";
import { GAME_CONTENT_VERSION } from "@/lib/storage";
import { loadReviewMetadataIndex } from "@/lib/review-metadata";
import { getDueReviewSnapshot } from "@/lib/review-queue";
import { useI18n } from "@/lib/use-i18n";
import { buildLevelHref } from "@/lib/level-navigation";
import type { ReviewMetadataIndex } from "@/types/game";
import {
  selectActiveGameProgress,
  selectActiveProfile,
  useGameStore
} from "@/store/gameStore";

export default function HomePage() {
  const router = useRouter();
  const { language, t } = useI18n();
  const profile = useGameStore(selectActiveProfile);
  const progress = useGameStore(selectActiveGameProgress);
  const [reviewMetadata, setReviewMetadata] = useState<ReviewMetadataIndex>();
  const [reviewMetadataStatus, setReviewMetadataStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const advanceTutorial = useGameStore((state) => state.advanceTutorial);
  const setTutorialCollapsed = useGameStore((state) => state.setTutorialCollapsed);
  const tutorialActive = profile.tutorialProgress.status === "in-progress";
  const books = compactBooks;
  const nceLevels = getProgressLevelsByCurriculumId("nce-1997");
  const completedNceLevels = nceLevels.filter(
    (level) => progress.levels[level.id]?.completed
  ).length;
  const recommendedLevel = getRecommendedEligibleLevel(
    nceLevels,
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
    ? getProgressLevelsByBookId(recommendedLevel.bookId).findIndex(
        (level) => level.id === recommendedLevel.id
      )
    : -1;

  useEffect(() => {
    let current = true;
    setReviewMetadataStatus("loading");
    loadReviewMetadataIndex(GAME_CONTENT_VERSION).then((metadata) => {
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

        {tutorialActive && !profile.tutorialProgress.collapsed ? (
          <LazyTutorialPanel
            language={language}
            section="home"
            onPrimary={() => {
              if (profile.tutorialProgress.phase === "home") {
                advanceTutorial("course-map");
              }
              router.push("/map?book=nce-1997-b1");
            }}
            onLater={() => setTutorialCollapsed(true)}
          />
        ) : tutorialActive ? (
          <button
            type="button"
            onClick={() => setTutorialCollapsed(false)}
            className="focus-ring w-full rounded-xl border-2 border-ink bg-sun p-4 text-left font-black text-ink shadow-crisp"
          >
            {t("tutorial.resumeFirstLevel")}
          </button>
        ) : null}

        <Link
          href="/assessment"
          className="focus-ring block rounded-xl border-2 border-ink bg-sun p-5 text-ink shadow-crisp"
        >
          <strong className="block text-xl sm:text-2xl">
            {profile.preferences.uiLanguage === "zh-CN"
              ? "6–10 分钟测词汇量"
              : "6–10 minute vocabulary estimate"}
          </strong>
          <span className="mt-2 block text-sm font-bold text-ink/65">
            {profile.preferences.uiLanguage === "zh-CN"
              ? "52–80 题自适应估算，全程离线。"
              : "52–80 adaptive questions, fully offline."}
          </span>
        </Link>

        <CourseCatalog />

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
                      level: recommendedLevelIndex + 1
                    })}
                  </p>
                ) : (
                  <p className="mt-2 text-sm font-bold text-white/70">
                    {t("home.pathComplete")}
                  </p>
                )}
              </div>
              <span className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-black text-sun">
                {completedNceLevels}/{nceLevels.length}
              </span>
            </div>
            <Link
              href={
                tutorialActive
                  ? "/map?book=nce-1997-b1"
                  : recommendedLevel
                    ? buildLevelHref(recommendedLevel.id, "/")
                    : "/map"
              }
              onClick={() => {
                if (tutorialActive && profile.tutorialProgress.phase === "home") {
                  advanceTutorial("course-map");
                }
              }}
              className="focus-ring mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-white bg-mint px-5 py-3 font-black text-white shadow-crisp transition hover:-translate-y-0.5 sm:w-auto"
            >
              {tutorialActive
                ? t("tutorial.resumeFirstLevel")
                : recommendedLevel
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
                ? t("home.reviewLoading")
                : t("home.dueNow", { count: dueCount })}
            </p>
            <p className="mt-1 text-sm font-bold text-ink/60">
              {reviewMetadataStatus === "error"
                ? t("home.reviewLoadError")
                : dueCount > 0
                  ? t("home.reviewReady")
                  : t("home.reviewClear")}
            </p>
            {reviewMetadataStatus === "ready" &&
            (restrictedDueCount > 0 || recoverableDueCount > 0) ? (
              <p className="mt-2 text-xs font-black text-ink/55">
                {t("home.reviewHeldCounts", {
                  restricted: restrictedDueCount,
                  unavailable: recoverableDueCount
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
              const bookProgress = getCompactBookProgress(book.id, progress);
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
                    {bookProgress.completedLevels}/{bookProgress.totalLevels}
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

const LazyTutorialPanel = dynamic(
  () => import("@/components/TutorialPanel").then((module) => module.TutorialPanel),
  {
    ssr: false,
    loading: () => <div className="min-h-40 rounded-xl border-2 border-ink/15 bg-sun/40" aria-hidden="true" />
  }
);
