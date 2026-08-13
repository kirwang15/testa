"use client";

import Link from "next/link";
import { ArrowLeft, BrainCircuit, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  loadAssessmentBank,
  loadAssessmentState,
  saveAssessmentState,
  startAssessment,
  type AssessmentAnchor,
  type AssessmentBank,
  type AssessmentSession
} from "@/lib/web-assessment";
import { useI18n } from "@/lib/use-i18n";
import { useAssessmentI18n } from "@/lib/assessment-i18n";
import { selectActiveProfile, useGameStore } from "@/store/gameStore";

const anchors: AssessmentAnchor[] = [
  "primarySchool",
  "middleSchool",
  "highSchool",
  "kaoyan",
  "ielts",
  "toefl",
  "unrestricted"
];

export function WebAssessmentIntro() {
  const { t: commonT } = useI18n();
  const t = useAssessmentI18n();
  const router = useRouter();
  const profile = useGameStore(selectActiveProfile);
  const [bank, setBank] = useState<AssessmentBank>();
  const [active, setActive] = useState<AssessmentSession>();
  const [anchor, setAnchor] = useState<AssessmentAnchor>("unrestricted");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    loadAssessmentBank(controller.signal)
      .then((loaded) => {
        const stored = loadAssessmentState(profile.id);
        const compatible = stored.active?.bankVersion === loaded.bankVersion ? stored.active : undefined;
        if (stored.active && !compatible) {
          saveAssessmentState(profile.id, { history: stored.history });
        }
        setBank(loaded);
        setActive(compatible);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    return () => controller.abort();
  }, [profile.id]);

  const begin = () => {
    if (!bank) return;
    const stored = loadAssessmentState(profile.id);
    saveAssessmentState(profile.id, {
      active: startAssessment(bank, anchor),
      history: stored.history
    });
    router.push("/assessment/test");
  };

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-xl border-2 border-ink bg-white p-5 shadow-crisp sm:p-7">
          <Link
            href="/"
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-ink bg-paper px-3 text-sm font-black text-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {commonT("nav.backHome")}
          </Link>
          <div className="mt-6 grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <span className="grid h-20 w-20 place-items-center rounded-2xl border-2 border-ink bg-sun text-ink shadow-crisp">
              <BrainCircuit className="h-10 w-10" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-coral">
                {t("beta")}
              </p>
              <h1 className="mt-1 text-3xl font-black text-ink">{t("introTitle")}</h1>
              <p className="mt-2 font-semibold text-ink/65">{t("introBody")}</p>
            </div>
          </div>
          <p className="mt-5 flex items-center gap-2 rounded-lg border-2 border-ink/15 bg-paper px-4 py-3 text-sm font-black text-ink/70">
            <LockKeyhole className="h-4 w-4 flex-none" aria-hidden="true" />
            {t("private")}
          </p>
        </header>

        <section className="rounded-xl border-2 border-ink bg-white p-5 shadow-crisp sm:p-7">
          {active ? (
            <button
              type="button"
              onClick={() => router.push("/assessment/test")}
              className="focus-ring mb-5 min-h-12 w-full rounded-lg border-2 border-ink bg-mint px-5 font-black text-white shadow-crisp"
            >
              {t("resume")}
            </button>
          ) : null}
          <h2 className="text-xl font-black text-ink">{t("chooseAnchor")}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {anchors.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAnchor(value)}
                aria-pressed={anchor === value}
                className={`focus-ring min-h-11 rounded-full border-2 border-ink px-4 text-sm font-black transition ${
                  anchor === value ? "bg-ink text-white" : "bg-paper text-ink hover:bg-white"
                }`}
              >
                {t(`anchor.${value}`)}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={status !== "ready"}
            onClick={begin}
            className="focus-ring mt-6 min-h-12 w-full rounded-lg border-2 border-ink bg-sun px-5 font-black text-ink shadow-crisp disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === "loading"
              ? t("loading")
              : status === "error"
                ? t("unavailable")
                : t("start")}
          </button>
          <p className="mt-4 text-center text-xs font-bold text-ink/55">{t("note")}</p>
        </section>
      </div>
    </main>
  );
}
