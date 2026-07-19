"use client";

import {
  ArrowLeft,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ParentContentAccessControl } from "@/components/ParentContentAccessControl";
import { getParentLearningMetrics } from "@/lib/parent-metrics";
import { useI18n } from "@/lib/use-i18n";
import {
  selectActiveGameProgress,
  selectActiveProfile,
  useGameStore
} from "@/store/gameStore";

export default function ParentPage() {
  const { language, t } = useI18n();
  const profile = useGameStore(selectActiveProfile);
  const progress = useGameStore(selectActiveGameProgress);
  const metrics = getParentLearningMetrics(progress);
  const formattedLastActive = metrics.lastActiveDate
    ? new Intl.DateTimeFormat(language, {
        dateStyle: "medium",
        timeZone: "UTC"
      }).format(new Date(`${metrics.lastActiveDate}T00:00:00.000Z`))
    : undefined;

  const metricCards = [
    {
      label: t("parent.completedLevels"),
      value: metrics.completedLevels
    },
    {
      label: t("parent.firstTryCorrect"),
      value: metrics.firstTryCorrectWords
    },
    {
      label: t("parent.completedReviews"),
      value: metrics.completedDueReviews
    },
    {
      label: t("parent.actualHints"),
      value: metrics.actualHintEvents
    },
    {
      label: t("parent.wrongAttempts"),
      value: metrics.recordedWrongAttempts
    },
    {
      label: t("parent.masteredWords"),
      value: metrics.masteredWords
    },
    {
      label: t("parent.activeDays"),
      value: metrics.activeDays
    }
  ];

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <nav className="flex items-center justify-between gap-3" aria-label={t("nav.parent")}>
          <Link
            href="/settings"
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-ink bg-white px-4 py-2 text-sm font-black text-ink shadow-crisp"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t("nav.settings")}
          </Link>
          <LanguageSwitcher />
        </nav>

        <header className="mt-4 rounded-lg border-2 border-ink bg-white p-5 shadow-crisp">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-mint">
            {t("parent.eyebrow")}
          </p>
          <h1 className="mt-1 text-3xl font-black text-ink">{t("parent.title")}</h1>
          <p className="mt-2 font-semibold text-ink/65">{t("parent.description")}</p>
          <p className="mt-3 rounded-lg border-2 border-ink/10 bg-paper px-3 py-2 text-sm font-black text-ink/70">
            {t("parent.metricNote", { name: profile.nickname })}
          </p>
        </header>

        <section className="mt-4 grid grid-cols-2 gap-3">
          {metricCards.map(({ label, value }) => (
            <article
              key={label}
              className="min-h-32 rounded-lg border-2 border-ink bg-paper p-4 shadow-crisp"
            >
              <p className="text-3xl font-black text-ink">{value}</p>
              <p className="mt-1 text-sm font-bold text-ink/60">{label}</p>
            </article>
          ))}
        </section>

        <section className="mt-4 rounded-lg border-2 border-ink bg-white p-5 shadow-crisp">
          <div>
              <h2 className="text-xl font-black text-ink">{t("parent.activity")}</h2>
              {formattedLastActive ? (
                <>
                  <p className="mt-2 font-black text-ink">
                    {t("parent.streak", { count: metrics.studyStreak })}
                  </p>
                  <p className="mt-1 text-sm font-bold text-ink/60">
                    {t("parent.lastActive", { date: formattedLastActive })}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm font-bold text-ink/60">
                  {t("parent.noActivity")}
                </p>
              )}
          </div>
        </section>

        <div className="mt-4">
          <ParentContentAccessControl />
        </div>

        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <article className="rounded-lg border-2 border-ink bg-mint/10 p-5 shadow-crisp">
            <ShieldCheck className="h-6 w-6 text-mint" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-black text-ink">{t("parent.privacyTitle")}</h2>
            <p className="mt-1 text-sm font-semibold text-ink/65">
              {t("parent.privacyDescription")}
            </p>
          </article>
          <article className="rounded-lg border-2 border-ink bg-sun/20 p-5 shadow-crisp">
            <ShieldCheck className="h-6 w-6 text-coral" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-black text-ink">{t("parent.unofficialTitle")}</h2>
            <p className="mt-1 text-sm font-semibold text-ink/65">
              {t("parent.unofficialDescription")}
            </p>
          </article>
        </section>

        <Link
          href="/"
          className="focus-ring mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-lg border-2 border-ink bg-ink px-5 py-3 font-black text-white shadow-crisp sm:w-auto"
        >
          {t("nav.backHome")}
        </Link>
      </div>
    </main>
  );
}
