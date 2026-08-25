"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/use-i18n";

export default function TutorialReferencePage() {
  const { language, t } = useI18n();
  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <nav className="flex items-center justify-between gap-3">
          <Link
            href="/settings"
            className="focus-ring inline-flex min-h-11 items-center rounded-lg border-2 border-ink bg-white px-4 py-2 font-black text-ink"
          >
            {t("nav.settings")}
          </Link>
          <LanguageSwitcher />
        </nav>
        <LazyTutorialReferenceContent language={language} />
      </div>
    </main>
  );
}

const LazyTutorialReferenceContent = dynamic(
  () => import("@/components/TutorialReferenceContent").then((module) => module.TutorialReferenceContent),
  {
    ssr: false,
    loading: () => <div className="min-h-96 rounded-xl border-2 border-ink/15 bg-white/60" aria-hidden="true" />
  }
);
