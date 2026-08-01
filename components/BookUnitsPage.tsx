"use client";

import Link from "next/link";
import { CoinBar } from "@/components/CoinBar";
import { GameLogo } from "@/components/GameLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { UnitCard } from "@/components/UnitCard";
import {
  getAllLevels,
  getBookProgress,
  getUnitProgress,
} from "@/lib/curriculum-index";
import { selectActiveGameProgress, useGameStore } from "@/store/gameStore";
import type { CurriculumBookIndex, CurriculumUnitIndex } from "@/types/game";
import { useI18n } from "@/lib/use-i18n";
import { getBookNumber } from "@/lib/curriculum-presentation";
import { canAccessBook, getEligibleUnitStatus } from "@/lib/content-access";
import { selectActiveProfile } from "@/store/gameStore";

type BookUnitsPageProps = {
  book: CurriculumBookIndex;
  units: CurriculumUnitIndex[];
};

export function BookUnitsPage({ book, units }: BookUnitsPageProps) {
  const { t } = useI18n();
  const bookNumber = getBookNumber(book.id);
  const activeProgress = useGameStore(selectActiveGameProgress);
  const activeProfile = useGameStore(selectActiveProfile);
  const { coins, levels: savedLevels, words: savedWords } = activeProgress;
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
                {t("nav.backBooks")}
              </Link>
              <GameLogo />
              <div>
                <p className="text-sm font-black uppercase text-mint">
                  {t("common.cefr", { level: book.level })}
                </p>
                <h1 className="mt-1 text-3xl font-black text-ink">
                  {t("book.displayTitle", { book: bookNumber })}
                </h1>
                <p className="mt-1 text-base font-bold text-coral">
                  {t("book.displaySubtitle")}
                </p>
              </div>
              <p className="max-w-2xl text-base font-semibold text-ink/80">
                {t("book.displayDescription")}
              </p>
              <div className="flex flex-wrap gap-3 text-sm font-bold text-ink/75">
                <span>{t("common.units", { count: book.unitIds.length })}</span>
                <span>{t("common.estimatedWords", { count: book.estimatedWordCount ?? 0 })}</span>
                <span>{t("common.levelsComplete", { done: bookProgress.completedLevels, total: bookProgress.totalLevels })}</span>
                <span>{t("common.learnedWords", { count: bookProgress.learnedWords })}</span>
                <span>{t("common.percentComplete", { count: bookProgress.completionPercent })}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <LanguageSwitcher />
              <CoinBar coins={coins} />
            </div>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-2">
          {units.map((unit) => {
            const progress = getUnitProgress(unit.id, savedLevels, savedWords);
            const status = getEligibleUnitStatus(
              getAllLevels(),
              unit.id,
              savedLevels,
              activeProfile
            );

            return (
              <UnitCard
                key={unit.id}
                book={book}
                unit={unit}
                progress={progress}
                status={status}
                levelCount={progress.totalLevels}
                locked={!canAccessBook(activeProfile, book)}
              />
            );
          })}
        </section>
      </div>
    </main>
  );
}
