"use client";

import Link from "next/link";
import { BookCard } from "@/components/BookCard";
import { CoinBar } from "@/components/CoinBar";
import { GameLogo } from "@/components/GameLogo";
import { getBookProgress, getBookStatus, getProgressSummary } from "@/lib/levelLoader";
import { getAllBooks } from "@/src/lib/vocabulary-loader";
import { useGameStore } from "@/store/gameStore";

export function BookSelectionPage() {
  const books = getAllBooks();
  const coins = useGameStore((state) => state.coins);
  const savedLevels = useGameStore((state) => state.levels);
  const savedWords = useGameStore((state) => state.words);
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
                Back home
              </Link>
              <GameLogo />
              <p className="max-w-2xl text-base font-semibold text-ink sm:text-lg">
                Pick a mock vocabulary book, then follow the recommendation or jump anywhere you want.
              </p>
              <div className="flex flex-wrap gap-3 text-sm font-bold text-ink/75">
                <span>{books.length} books</span>
                <span>{progressSummary.totalLevels} total levels</span>
                <span>{progressSummary.completedLevels} completed</span>
                <span>{books.reduce((sum, book) => sum + (book.estimatedWordCount ?? 0), 0)} mock words</span>
              </div>
            </div>
            <CoinBar coins={coins} />
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              progress={getBookProgress(book.id, savedLevels, savedWords)}
              status={getBookStatus(book.id, savedLevels)}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
