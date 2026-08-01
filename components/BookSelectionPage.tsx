"use client";

import Link from "next/link";
import { BookCard } from "@/components/BookCard";
import { CoinBar } from "@/components/CoinBar";
import { GameLogo } from "@/components/GameLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  getAllBooks,
  getAllLevels,
  getBookProgress,
  getProgressSummary
} from "@/lib/curriculum-index";
import { selectActiveGameProgress, useGameStore } from "@/store/gameStore";
import { useI18n } from "@/lib/use-i18n";
import { canAccessBook, getEligibleBookStatus } from "@/lib/content-access";
import { selectActiveProfile } from "@/store/gameStore";

export function BookSelectionPage() {
  const { t } = useI18n();
  const books = getAllBooks();
  const activeProgress = useGameStore(selectActiveGameProgress);
  const activeProfile = useGameStore(selectActiveProfile);
  const { coins, levels: savedLevels, words: savedWords } = activeProgress;
  const progressSummary = getProgressSummary(savedLevels);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="rounded-lg border-2 border-ink bg-white p-5 shadow-crisp sm:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <Link
                href="/"
                className="focus-ring inline-flex min-h-11 items-center rounded-lg border-2 border-ink bg-paper px-4 py-2 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:bg-white"
              >
                {t("nav.backHome")}
              </Link>
              <GameLogo />
              <p className="max-w-2xl text-base font-semibold text-ink sm:text-lg">
                {t("books.intro")}
              </p>
              <div className="flex flex-wrap gap-3 text-sm font-bold text-ink/75">
                <span>{t("common.books", { count: books.length })}</span>
                <span>{t("common.totalLevels", { count: progressSummary.totalLevels })}</span>
                <span>{t("common.completed", { count: progressSummary.completedLevels })}</span>
                <span>{t("common.learningWords", { count: books.reduce((sum, book) => sum + (book.estimatedWordCount ?? 0), 0) })}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3"><LanguageSwitcher /><CoinBar coins={coins} /></div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              progress={getBookProgress(book.id, savedLevels, savedWords)}
              status={getEligibleBookStatus(
                getAllLevels(),
                book.id,
                savedLevels,
                activeProfile
              )}
              locked={!canAccessBook(activeProfile, book)}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
