"use client";

import Link from "next/link";
import { CoinBar } from "@/components/CoinBar";
import { GameLogo } from "@/components/GameLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LevelCard } from "@/components/LevelCard";
import { createEmptyLevelProgress } from "@/lib/game";
import {
  getAllLevels,
  getUnitProgress,
} from "@/lib/curriculum-index";
import {
  canAccessLevel,
  getEligibleLevelStatus,
  isLevelAheadOfEligibleRecommendation
} from "@/lib/content-access";
import { selectActiveGameProgress, selectActiveProfile, useGameStore } from "@/store/gameStore";
import type {
  CurriculumBookIndex,
  CurriculumLevelIndex,
  CurriculumUnitIndex
} from "@/types/game";
import { useI18n } from "@/lib/use-i18n";
import {
  getBookNumber,
  getLessonRangeLabelValue,
  getUnitNumber
} from "@/lib/curriculum-presentation";

type UnitLevelsPageProps = {
  book: CurriculumBookIndex;
  unit: CurriculumUnitIndex;
  levels: CurriculumLevelIndex[];
};

export function UnitLevelsPage({ book, unit, levels }: UnitLevelsPageProps) {
  const { t } = useI18n();
  const bookNumber = getBookNumber(book.id);
  const unitNumber = getUnitNumber(unit);
  const lessonRange = getLessonRangeLabelValue(unit.lessonRange);
  const activeProgress = useGameStore(selectActiveGameProgress);
  const activeProfile = useGameStore(selectActiveProfile);
  const { coins, levels: savedLevels, words: savedWords } = activeProgress;
  const unitProgress = getUnitProgress(unit.id, savedLevels, savedWords);

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
                {t("nav.backUnits")}
              </Link>
              <GameLogo />
              <div>
                <p className="text-sm font-black uppercase text-mint">
                  {t("book.displayTitle", { book: bookNumber })}
                </p>
                <h1 className="mt-1 text-3xl font-black text-ink">
                  {t("unit.displayTitle", { unit: unitNumber })}
                </h1>
                <p className="mt-1 text-base font-bold text-coral">
                  {lessonRange
                    ? t("unit.lessonSpan", { range: lessonRange })
                    : t("unit.practice")}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm font-bold text-ink/75">
                <span>{t("common.playableLevels", { count: levels.length })}</span>
                <span>{t("common.levelsComplete", { done: unitProgress.completedLevels, total: unitProgress.totalLevels })}</span>
                <span>{t("common.learnedWords", { count: unitProgress.learnedWords })}</span>
                <span>{t("common.percentComplete", { count: unitProgress.completionPercent })}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <LanguageSwitcher />
              <CoinBar coins={coins} />
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {levels.map((level) => (
            <LevelCard
              key={level.id}
              level={level}
              status={getEligibleLevelStatus(
                getAllLevels(),
                level.id,
                savedLevels,
                activeProfile
              )}
              isAdvanced={isLevelAheadOfEligibleRecommendation(
                getAllLevels(),
                level.id,
                savedLevels,
                activeProfile
              )}
              locked={!canAccessLevel(activeProfile, level)}
              returnTo={`/books/${book.id}/units/${unit.id}`}
              progress={savedLevels[level.id] ?? createEmptyLevelProgress()}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
