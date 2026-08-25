"use client";

import { BookOpenCheck, Languages, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { GameLogo } from "@/components/GameLogo";
import {
  getOnboardingProfilePatch,
  getRecommendedInterfaceModeForAge
} from "@/lib/onboarding";
import { useI18n } from "@/lib/use-i18n";
import {
  selectActiveProfile,
  selectIsReadOnly,
  useGameStore
} from "@/store/gameStore";
import type { AgeBand, InterfaceMode } from "@/types/game";

const ageBands: AgeBand[] = ["7-9", "10-12", "13-15"];

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useI18n();
  const profile = useGameStore(selectActiveProfile);
  const updateProfile = useGameStore((state) => state.updateProfile);
  const isReadOnly = useGameStore(selectIsReadOnly);
  const [nickname, setNickname] = useState(profile.nickname);
  const [ageBand, setAgeBand] = useState<AgeBand>(profile.ageBand);
  const [interfaceMode, setInterfaceMode] = useState<InterfaceMode>(
    profile.preferences.interfaceMode
  );
  const [nicknameTouched, setNicknameTouched] = useState(false);

  useEffect(() => {
    setNickname(profile.nickname);
    setAgeBand(profile.ageBand);
    setInterfaceMode(profile.preferences.interfaceMode);
    setNicknameTouched(false);
  }, [profile.id]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isReadOnly) return;
    setNicknameTouched(true);
    if (!nickname.trim()) return;

    updateProfile(
      profile.id,
      getOnboardingProfilePatch(
        { nickname, ageBand, interfaceMode },
        profile.onboardingCompleted
      )
    );
    router.replace("/");
  };

  const nicknameInvalid = nicknameTouched && !nickname.trim();
  const chooseAgeBand = (band: AgeBand) => {
    setAgeBand(band);
    setInterfaceMode(getRecommendedInterfaceModeForAge(band));
  };

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="rounded-lg border-2 border-ink bg-white p-5 shadow-crisp sm:p-6">
          <GameLogo />
          <p className="mt-5 text-sm font-black uppercase tracking-[0.12em] text-coral">
            {t("onboarding.eyebrow")}
          </p>
          <h2 className="mt-1 text-3xl font-black text-ink sm:text-4xl">
            {t("onboarding.title")}
          </h2>
          <p className="mt-2 max-w-2xl font-semibold text-ink/70">
            {profile.onboardingCompleted
              ? t("onboarding.returning")
              : t("onboarding.description")}
          </p>
        </header>

        <form onSubmit={submit} className="mt-4 space-y-4">
          {isReadOnly ? (
            <p className="rounded-lg border-2 border-ink bg-sun p-4 font-black text-ink" role="status">
              {t("settings.readOnlyNotice")}
            </p>
          ) : null}
          <section className="rounded-lg border-2 border-ink bg-paper p-5 shadow-crisp">
            <label htmlFor="learner-nickname" className="text-sm font-black text-ink">
              {t("settings.nickname")}
            </label>
            <input
              id="learner-nickname"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              onBlur={() => setNicknameTouched(true)}
              maxLength={24}
              autoComplete="nickname"
              aria-invalid={nicknameInvalid}
              aria-describedby="learner-nickname-help"
              className="focus-ring mt-2 min-h-12 w-full rounded-lg border-2 border-ink bg-white px-4 py-3 text-lg font-black text-ink"
              placeholder={t("settings.nicknamePlaceholder")}
              disabled={isReadOnly}
            />
            <p
              id="learner-nickname-help"
              className={`mt-2 text-sm font-bold ${nicknameInvalid ? "text-red-800" : "text-ink/60"}`}
            >
              {nicknameInvalid
                ? t("onboarding.nicknameRequired")
                : t("onboarding.nicknameHelp")}
            </p>

            <fieldset className="mt-5">
              <legend className="text-sm font-black text-ink">{t("settings.age")}</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {ageBands.map((band) => (
                  <button
                    key={band}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() => chooseAgeBand(band)}
                    aria-pressed={ageBand === band}
                    className="focus-ring min-h-12 rounded-lg border-2 border-ink bg-white px-2 py-3 text-sm font-black text-ink shadow-crisp aria-pressed:bg-sun"
                  >
                    {t("settings.ageBand", { age: band })}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm font-bold text-ink/60">
                {t("onboarding.ageHelp")}
              </p>
            </fieldset>
          </section>

          <fieldset className="rounded-lg border-2 border-ink bg-white p-5 shadow-crisp">
            <legend className="px-2 text-sm font-black uppercase tracking-[0.12em] text-mint">
              {t("onboarding.mode")}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => setInterfaceMode("guided")}
                aria-pressed={interfaceMode === "guided"}
                className="focus-ring min-h-36 rounded-lg border-2 border-ink bg-paper p-4 text-left shadow-crisp transition hover:-translate-y-0.5 aria-pressed:bg-mint aria-pressed:text-white"
              >
                <BookOpenCheck className="h-6 w-6" aria-hidden="true" />
                <span className="mt-3 block text-lg font-black">
                  {t("onboarding.guidedTitle")}
                </span>
                <span className="mt-1 block text-sm font-bold opacity-75">
                  {t("onboarding.guidedDescription")}
                </span>
              </button>
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => setInterfaceMode("immersion")}
                aria-pressed={interfaceMode === "immersion"}
                className="focus-ring min-h-36 rounded-lg border-2 border-ink bg-paper p-4 text-left shadow-crisp transition hover:-translate-y-0.5 aria-pressed:bg-coral aria-pressed:text-white"
              >
                <Languages className="h-6 w-6" aria-hidden="true" />
                <span className="mt-3 block text-lg font-black">
                  {t("onboarding.immersionTitle")}
                </span>
                <span className="mt-1 block text-sm font-bold opacity-75">
                  {t("onboarding.immersionDescription")}
                </span>
              </button>
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-lg border-2 border-ink/15 bg-sun/35 p-3 text-sm font-bold text-ink/75">
              <Sparkles className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
              <span>{t("onboarding.englishClueNote")}</span>
            </p>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <button
              type="submit"
              disabled={isReadOnly || !nickname.trim()}
              className="focus-ring inline-flex min-h-12 items-center justify-center rounded-lg border-2 border-ink bg-mint px-6 py-3 font-black text-white shadow-crisp transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {profile.onboardingCompleted
                ? t("onboarding.save")
                : t("onboarding.start")}
            </button>
            {profile.onboardingCompleted || isReadOnly ? (
              <Link
                href="/settings"
                className="focus-ring inline-flex min-h-12 items-center justify-center rounded-lg border-2 border-ink bg-white px-5 py-3 font-black text-ink"
              >
                {t("onboarding.back")}
              </Link>
            ) : null}
          </div>
        </form>
      </div>
    </main>
  );
}
