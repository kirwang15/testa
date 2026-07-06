"use client";

import Link from "next/link";
import { BookCard } from "@/components/BookCard";
import { CoinBar } from "@/components/CoinBar";
import { GameLogo } from "@/components/GameLogo";
import { LevelCard } from "@/components/LevelCard";
import { UnitCard } from "@/components/UnitCard";
import { createEmptyLevelProgress } from "@/lib/game";
import {
  getBookProgress,
  getBookStatus,
  getLevelsByUnitId,
  getLevelStatus,
  getProgressSummary,
  getRecommendedLevel,
  getUnitProgress,
  getUnitStatus,
  getUnitsByBookId,
  isLevelAheadOfRecommendation
} from "@/lib/levelLoader";
import { getDifficultWords, getFavoriteWords } from "@/src/lib/learning-engine";
import { getAllBooks, getWordById } from "@/src/lib/vocabulary-loader";
import { useGameStore } from "@/store/gameStore";

export default function HomePage() {
  const coins = useGameStore((state) => state.coins);
  const savedLevels = useGameStore((state) => state.levels);
  const savedWords = useGameStore((state) => state.words);
  const studyStats = useGameStore((state) => state.studyStats);
  const resetProgress = useGameStore((state) => state.resetProgress);
  const books = getAllBooks();
  const progressSummary = getProgressSummary(savedLevels);
  const recommendedLevel = getRecommendedLevel(savedLevels);
  const difficultWords = getDifficultWords(savedWords)
    .map((progress) => getWordById(progress.wordId))
    .filter((word): word is NonNullable<ReturnType<typeof getWordById>> => Boolean(word));
  const favoriteWords = getFavoriteWords(savedWords)
    .map((progress) => getWordById(progress.wordId))
    .filter((word): word is NonNullable<ReturnType<typeof getWordById>> => Boolean(word));

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <header className="rounded-lg border-2 border-ink bg-white p-5 shadow-crisp sm:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <GameLogo />
              <p className="max-w-2xl text-base font-semibold text-ink sm:text-lg">
                Learn vocabulary through puzzle play. Follow the recommended path, or jump ahead whenever you want.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/books"
                  className="focus-ring inline-flex min-h-12 items-center rounded-lg border-2 border-ink bg-mint px-5 py-3 text-sm font-black text-white shadow-crisp transition hover:-translate-y-0.5"
                >
                  Choose Vocabulary Book
                </Link>
                {recommendedLevel ? (
                  <Link
                    href={`/levels/${recommendedLevel.id}`}
                    className="focus-ring inline-flex min-h-12 items-center rounded-lg border-2 border-ink bg-white px-5 py-3 text-sm font-black text-ink transition hover:-translate-y-0.5 hover:bg-paper"
                  >
                    Continue Learning
                  </Link>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border-2 border-ink bg-paper p-4">
                  <p className="text-xs font-black uppercase text-coral">Progress</p>
                  <p className="mt-1 text-2xl font-black text-ink">
                    {progressSummary.completedLevels}/{progressSummary.totalLevels}
                  </p>
                  <p className="mt-1 text-sm font-bold text-ink/70">Levels cleared</p>
                </div>
                <div className="rounded-lg border-2 border-ink bg-paper p-4">
                  <p className="text-xs font-black uppercase text-mint">Favorites</p>
                  <p className="mt-1 text-2xl font-black text-ink">{favoriteWords.length}</p>
                  <p className="mt-1 text-sm font-bold text-ink/70">Saved words</p>
                </div>
                <div className="rounded-lg border-2 border-ink bg-paper p-4">
                  <p className="text-xs font-black uppercase text-leaf">Difficult</p>
                  <p className="mt-1 text-2xl font-black text-ink">{difficultWords.length}</p>
                  <p className="mt-1 text-sm font-bold text-ink/70">Need review</p>
                </div>
                <div className="rounded-lg border-2 border-ink bg-paper p-4">
                  <p className="text-xs font-black uppercase text-ink">Study Stats</p>
                  <p className="mt-1 text-2xl font-black text-ink">
                    {studyStats.totalWordsLearned}/{studyStats.totalWordsMastered}
                  </p>
                  <p className="mt-1 text-sm font-bold text-ink/70">
                    Learned / mastered
                  </p>
                </div>
              </div>
            </div>
            <CoinBar coins={coins} onReset={resetProgress} />
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-lg border-2 border-ink bg-white p-5 shadow-crisp">
            <p className="text-sm font-black uppercase text-mint">Continue Learning</p>
            <h2 className="mt-2 text-2xl font-black text-ink">
              {recommendedLevel ? recommendedLevel.title ?? `Level ${recommendedLevel.id}` : "All caught up"}
            </h2>
            <p className="mt-2 text-sm font-semibold text-ink/70">
              {recommendedLevel
                ? "The next suggested step in the learning path."
                : "You completed the current recommended path."}
            </p>
          </div>
          <div className="rounded-lg border-2 border-ink bg-white p-5 shadow-crisp">
            <p className="text-sm font-black uppercase text-coral">Review Difficult Words</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {difficultWords.slice(0, 5).map((word) => (
                <span
                  key={word.id}
                  className="rounded-lg border-2 border-ink bg-paper px-3 py-2 text-sm font-bold text-ink"
                >
                  {word.displayText}
                </span>
              ))}
              {difficultWords.length === 0 ? (
                <p className="text-sm font-semibold text-ink/70">No difficult words yet.</p>
              ) : null}
            </div>
          </div>
          <div className="rounded-lg border-2 border-ink bg-white p-5 shadow-crisp">
            <p className="text-sm font-black uppercase text-leaf">Favorites</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {favoriteWords.slice(0, 5).map((word) => (
                <span
                  key={word.id}
                  className="rounded-lg border-2 border-ink bg-paper px-3 py-2 text-sm font-bold text-ink"
                >
                  {word.displayText}
                </span>
              ))}
              {favoriteWords.length === 0 ? (
                <p className="text-sm font-semibold text-ink/70">No favorites yet.</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-sm font-black uppercase text-mint">Vocabulary books</p>
            <h2 className="text-2xl font-black text-ink">Recommended path + free play</h2>
            <p className="mt-1 text-sm font-semibold text-ink/70">
              Every book is available. The badges show what the system recommends next.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                progress={getBookProgress(book.id, savedLevels, savedWords)}
                status={getBookStatus(book.id, savedLevels)}
              />
            ))}
          </div>
        </section>

        {books.map((book) => {
          const bookProgress = getBookProgress(book.id, savedLevels, savedWords);

          return (
            <section key={book.id} className="space-y-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase text-mint">
                    {bookProgress.completedLevels}/{bookProgress.totalLevels} levels complete
                  </p>
                  <h2 className="text-2xl font-black text-ink">{book.title}</h2>
                  <p className="mt-1 text-sm font-semibold text-ink/70">
                    {book.subtitle}
                  </p>
                </div>
                <Link
                  href={`/books/${book.id}`}
                  className="focus-ring inline-flex min-h-11 items-center rounded-lg border-2 border-ink bg-white px-4 py-2 text-sm font-black text-ink transition hover:-translate-y-0.5 hover:bg-paper"
                >
                  Open book
                </Link>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {getUnitsByBookId(book.id).map((unit) => {
                  const unitLevels = getLevelsByUnitId(unit.id);
                  const unitProgress = getUnitProgress(unit.id, savedLevels, savedWords);
                  const unitStatus = getUnitStatus(unit.id, savedLevels);

                  return (
                    <div
                      key={unit.id}
                      className="space-y-4 rounded-lg border-2 border-ink bg-white p-4 shadow-crisp"
                    >
                      <UnitCard
                        book={book}
                        unit={unit}
                        progress={unitProgress}
                        status={unitStatus}
                        levelCount={unitLevels.length}
                      />
                      <div className="grid gap-4 xl:grid-cols-2">
                        {unitLevels.map((level) => (
                          <LevelCard
                            key={level.id}
                            level={level}
                            status={getLevelStatus(level.id, savedLevels)}
                            isAdvanced={isLevelAheadOfRecommendation(level.id, savedLevels)}
                            progress={savedLevels[level.id] ?? createEmptyLevelProgress()}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
