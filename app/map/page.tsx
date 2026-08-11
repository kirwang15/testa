"use client";

import { ArrowLeft, BookOpen, Check, ShieldAlert, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  getAllBooks,
  getAllLevels,
  getBookProgress,
  getLevelsByBookId
} from "@/lib/curriculum-index";
import {
  canAccessLevel,
  getRecommendedEligibleLevel
} from "@/lib/content-access";
import { useI18n } from "@/lib/use-i18n";
import {
  selectActiveGameProgress,
  selectActiveProfile,
  useGameStore
} from "@/store/gameStore";
import type {
  ContentRating,
  CurriculumLevelIndex
} from "@/types/game";

export default function MapPage() {
  const { t } = useI18n();
  const progress = useGameStore(selectActiveGameProgress);
  const profile = useGameStore(selectActiveProfile);
  const books = getAllBooks();
  const recommendedLevel = getRecommendedEligibleLevel(
    getAllLevels(),
    progress.levels,
    profile
  );
  const initialBookId = recommendedLevel?.bookId ?? books[0]?.id ?? "";
  const [selectedBookId, setSelectedBookId] = useState(initialBookId);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectBookTab = (index: number) => {
    const nextIndex = (index + books.length) % books.length;
    const nextBook = books[nextIndex];
    if (!nextBook) return;
    setSelectedBookId(nextBook.id);
    tabRefs.current[nextIndex]?.focus();
  };

  useEffect(() => {
    if (!books.some((book) => book.id === selectedBookId)) {
      setSelectedBookId(initialBookId);
    }
  }, [books, initialBookId, selectedBookId]);

  const selectedBookIndex = Math.max(
    0,
    books.findIndex((book) => book.id === selectedBookId)
  );
  const selectedBook = books[selectedBookIndex];
  const selectedLevels = useMemo(
    () => (selectedBook ? getLevelsByBookId(selectedBook.id) : []),
    [selectedBook]
  );
  const bookProgress = selectedBook
    ? getBookProgress(selectedBook.id, progress.levels, progress.words)
    : undefined;

  const ratingLabel = (rating: ContentRating) => {
    if (rating === "13-plus") return t("map.thirteenPlus");
    if (rating === "parent-review") return t("map.parentReview");
    return t("map.allAges");
  };

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <nav className="flex items-center justify-between gap-3" aria-label={t("nav.map")}>
          <Link
            href="/"
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-ink bg-white px-4 py-2 text-sm font-black text-ink shadow-crisp"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("nav.home")}
          </Link>
          <LanguageSwitcher />
        </nav>

        <header className="mt-4 rounded-lg border-2 border-ink bg-white p-5 shadow-crisp">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-mint">
            {t("map.eyebrow")}
          </p>
          <h1 className="mt-1 text-3xl font-black text-ink">{t("map.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-ink/65">
            {t("map.description")}
          </p>
        </header>

        <div className="mt-4 grid grid-cols-4 gap-2" role="tablist" aria-label={t("map.title")}>
          {books.map((book, index) => {
            const selected = book.id === selectedBook?.id;
            return (
              <button
                key={book.id}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`book-map-tab-${index + 1}`}
                aria-selected={selected}
                aria-controls="book-level-map"
                aria-label={t("map.bookTab", { book: index + 1 })}
                tabIndex={selected ? 0 : -1}
                onClick={() => setSelectedBookId(book.id)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                    event.preventDefault();
                    selectBookTab(index + 1);
                  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                    event.preventDefault();
                    selectBookTab(index - 1);
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    selectBookTab(0);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    selectBookTab(books.length - 1);
                  }
                }}
                className="focus-ring min-h-12 rounded-lg border-2 border-ink bg-white px-2 py-2 text-sm font-black text-ink shadow-crisp aria-selected:bg-ink aria-selected:text-white"
              >
                {t("common.bookNumber", { book: index + 1 })}
              </button>
            );
          })}
        </div>

        {selectedBook ? (
          <section
            id="book-level-map"
            role="tabpanel"
            aria-labelledby={`book-map-tab-${selectedBookIndex + 1}`}
            className="mt-4 rounded-lg border-2 border-ink bg-paper p-4 shadow-crisp sm:p-5"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-coral">{selectedBook.level}</p>
                <h2 className="mt-1 text-2xl font-black text-ink">
                  {t("map.bookTitle", { book: selectedBookIndex + 1 })}
                </h2>
                <p className="mt-1 text-sm font-bold text-ink/60">
                  {t("map.progress", { done: bookProgress?.completedLevels ?? 0 })}
                </p>
              </div>
              <Link
                href={`/books/${selectedBook.id}`}
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-ink bg-white px-3 py-2 text-sm font-black text-ink"
              >
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                {t("common.openBook")}
              </Link>
            </div>

            <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
              {selectedLevels.map((level, levelIndex) => {
                const saved = progress.levels[level.id];
                const completed = saved?.completed === true;
                const current = recommendedLevel?.id === level.id;
                const accessible = canAccessLevel(profile, level);
                const stateLabel = !accessible
                  ? t("map.locked")
                  : completed
                  ? t("map.completed")
                  : current
                    ? t("map.current")
                    : t("map.available");
                return (
                  <LevelMarker
                    key={level.id}
                    level={level}
                    levelNumber={levelIndex + 1}
                    bookNumber={selectedBookIndex + 1}
                    stars={saved?.bestStars ?? 0}
                    completed={completed}
                    current={current}
                    accessible={accessible}
                    stateLabel={stateLabel}
                    ratingLabel={ratingLabel(level.rating)}
                  />
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

type LevelMarkerProps = {
  level: CurriculumLevelIndex;
  levelNumber: number;
  bookNumber: number;
  stars: number;
  completed: boolean;
  current: boolean;
  accessible: boolean;
  stateLabel: string;
  ratingLabel: string;
};

function LevelMarker({
  level,
  levelNumber,
  bookNumber,
  stars,
  completed,
  current,
  accessible,
  stateLabel,
  ratingLabel
}: LevelMarkerProps) {
  const { t } = useI18n();
  const guarded = level.rating !== "all-ages";
  const className = [
        "focus-ring relative flex min-h-14 min-w-0 flex-col items-center justify-center rounded-lg border-2 bg-white px-1 py-1 text-ink shadow-crisp transition hover:-translate-y-0.5",
        current ? "border-mint ring-2 ring-mint/25" : "border-ink/25",
        completed ? "bg-leaf/10" : "",
        accessible ? "" : "cursor-not-allowed opacity-55 hover:translate-y-0"
      ].join(" ");
  const ariaLabel = t("map.levelAria", {
        book: bookNumber,
        level: levelNumber,
        stars,
        state: stateLabel,
        rating: ratingLabel
      });
  const content = (
    <>
      <span className="text-sm font-black">{levelNumber}</span>
      <span className="mt-0.5 flex items-center gap-0.5 text-[10px] font-black text-ink/60">
        {completed ? (
          <Check className="h-3 w-3 text-leaf" aria-hidden="true" />
        ) : guarded ? (
          <ShieldAlert className="h-3 w-3 text-coral" aria-hidden="true" />
        ) : (
          <Star className="h-3 w-3 text-sun" aria-hidden="true" />
        )}
        {stars}/3
      </span>
    </>
  );

  return accessible ? (
    <Link href={`/levels/${level.id}`} className={className} aria-label={ariaLabel}>
      {content}
    </Link>
  ) : (
    <div className={className} aria-label={ariaLabel} aria-disabled="true">
      {content}
    </div>
  );
}
