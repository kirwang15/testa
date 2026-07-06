"use client";

import Link from "next/link";
import { CoinBar } from "@/components/CoinBar";
import { GameLogo } from "@/components/GameLogo";
import { UnitCard } from "@/components/UnitCard";
import { getBookProgress, getUnitProgress, getUnitStatus } from "@/lib/levelLoader";
import { useGameStore } from "@/store/gameStore";
import type { VocabularyBook, VocabularyUnit } from "@/types/game";

type BookUnitsPageProps = {
  book: VocabularyBook;
  units: VocabularyUnit[];
};

export function BookUnitsPage({ book, units }: BookUnitsPageProps) {
  const coins = useGameStore((state) => state.coins);
  const savedLevels = useGameStore((state) => state.levels);
  const savedWords = useGameStore((state) => state.words);
  const bookProgress = getBookProgress(book.id, savedLevels, savedWords);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="rounded-lg border-2 border-ink bg-white p-5 shadow-crisp sm:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <Link
                href="/books"
                className="focus-ring inline-flex min-h-11 items-center rounded-lg border-2 border-ink bg-paper px-4 py-2 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:bg-white"
              >
                Back to books
              </Link>
              <GameLogo />
              <div>
                <p className="text-sm font-black uppercase text-mint">{book.level}</p>
                <h1 className="mt-1 text-3xl font-black text-ink">{book.title}</h1>
                <p className="mt-1 text-base font-bold text-coral">{book.subtitle}</p>
              </div>
              <p className="max-w-2xl text-base font-semibold text-ink/80">
                {book.description}
              </p>
              <div className="flex flex-wrap gap-3 text-sm font-bold text-ink/75">
                <span>{book.unitIds.length} units</span>
                <span>{book.estimatedWordCount ?? 0} estimated words</span>
                <span>{bookProgress.completedLevels}/{bookProgress.totalLevels} levels complete</span>
                <span>{bookProgress.learnedWords} learned words</span>
                <span>{bookProgress.completionPercent}% complete</span>
              </div>
            </div>
            <CoinBar coins={coins} />
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          {units.map((unit) => {
            const progress = getUnitProgress(unit.id, savedLevels, savedWords);
            const status = getUnitStatus(unit.id, savedLevels);

            return (
              <UnitCard
                key={unit.id}
                book={book}
                unit={unit}
                progress={progress}
                status={status}
                levelCount={progress.totalLevels}
              />
            );
          })}
        </section>
      </div>
    </main>
  );
}
