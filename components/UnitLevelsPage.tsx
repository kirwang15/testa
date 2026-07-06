"use client";

import Link from "next/link";
import { CoinBar } from "@/components/CoinBar";
import { GameLogo } from "@/components/GameLogo";
import { LevelCard } from "@/components/LevelCard";
import { WordMeaningToggle } from "@/components/WordMeaningToggle";
import { createEmptyLevelProgress } from "@/lib/game";
import {
  getLevelStatus,
  getUnitProgress,
  isLevelAheadOfRecommendation
} from "@/lib/levelLoader";
import { getUnitWords } from "@/src/lib/vocabulary-loader";
import { useGameStore } from "@/store/gameStore";
import type { Level, VocabularyBook, VocabularyUnit } from "@/types/game";

type UnitLevelsPageProps = {
  book: VocabularyBook;
  unit: VocabularyUnit;
  levels: Level[];
};

export function UnitLevelsPage({ book, unit, levels }: UnitLevelsPageProps) {
  const coins = useGameStore((state) => state.coins);
  const savedLevels = useGameStore((state) => state.levels);
  const savedWords = useGameStore((state) => state.words);
  const unitProgress = getUnitProgress(unit.id, savedLevels, savedWords);
  const unitWords = getUnitWords(book.id, unit.id);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="rounded-lg border-2 border-ink bg-white p-5 shadow-crisp sm:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <Link
                href={`/books/${book.id}`}
                className="focus-ring inline-flex min-h-11 items-center rounded-lg border-2 border-ink bg-paper px-4 py-2 text-sm font-bold text-ink transition hover:-translate-y-0.5 hover:bg-white"
              >
                Back to units
              </Link>
              <GameLogo />
              <div>
                <p className="text-sm font-black uppercase text-mint">{book.title}</p>
                <h1 className="mt-1 text-3xl font-black text-ink">{unit.title}</h1>
                <p className="mt-1 text-base font-bold text-coral">
                  {unit.lessonRange ?? "Vocabulary practice"}
                </p>
              </div>
              <div className="grid max-w-4xl gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {unitWords.slice(0, 8).map((word) => (
                  <div
                    key={word.id}
                    className="rounded-lg border-2 border-ink bg-paper px-3 py-3"
                  >
                    <p className="text-sm font-black text-ink">{word.displayText}</p>
                    <WordMeaningToggle
                      className="mt-2 text-ink"
                      wordLabel={word.displayText}
                      englishMeaning={word.englishMeaning}
                      chineseMeaning={word.chineseMeaning}
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 text-sm font-bold text-ink/75">
                <span>{levels.length} playable levels</span>
                <span>{unit.estimatedMinutes ?? 10} estimated minutes</span>
                <span>{unitProgress.completedLevels}/{unitProgress.totalLevels} complete</span>
                <span>{unitProgress.learnedWords} learned words</span>
                <span>{unitProgress.completionPercent}% complete</span>
              </div>
            </div>
            <CoinBar coins={coins} />
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {levels.map((level) => (
            <LevelCard
              key={level.id}
              level={level}
              status={getLevelStatus(level.id, savedLevels)}
              isAdvanced={isLevelAheadOfRecommendation(level.id, savedLevels)}
              progress={savedLevels[level.id] ?? createEmptyLevelProgress()}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
