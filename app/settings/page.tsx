"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { DeleteProfileControl } from "@/components/DeleteProfileControl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ParentContentAccessControl } from "@/components/ParentContentAccessControl";
import { ResetProgressControl } from "@/components/ResetProgressControl";
import { useI18n } from "@/lib/use-i18n";
import {
  selectActiveProfile,
  selectIsReadOnly,
  useGameStore
} from "@/store/gameStore";
import type { AgeBand } from "@/types/game";

const ageBands: AgeBand[] = ["7-9", "10-12", "13-15"];

export default function SettingsPage() {
  const { t } = useI18n();
  const profiles = useGameStore((state) => state.profiles);
  const activeProfile = useGameStore(selectActiveProfile);
  const isReadOnly = useGameStore(selectIsReadOnly);
  const addProfile = useGameStore((state) => state.addProfile);
  const deleteProfile = useGameStore((state) => state.deleteProfile);
  const switchProfile = useGameStore((state) => state.switchProfile);
  const updateProfile = useGameStore((state) => state.updateProfile);
  const updatePreferences = useGameStore((state) => state.updatePreferences);
  const resetProgress = useGameStore((state) => state.resetProgress);
  const [nickname, setNickname] = useState("");
  const [ageBand, setAgeBand] = useState<AgeBand>("10-12");
  const profilesHeadingRef = useRef<HTMLHeadingElement>(null);

  const createProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isReadOnly || !nickname.trim()) {
      return;
    }
    const createdProfileId = addProfile({
      nickname: nickname.trim(),
      ageBand,
      interfaceMode: "guided",
      onboardingCompleted: true
    });
    if (createdProfileId) setNickname("");
  };

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="focus-ring inline-flex min-h-11 items-center rounded-lg border-2 border-ink bg-white px-4 py-2 text-sm font-black text-ink"
          >
            {t("nav.backHome")}
          </Link>
          <LanguageSwitcher />
        </div>

        <header className="mt-5 rounded-lg border-2 border-ink bg-white p-5 shadow-crisp">
          <p className="text-sm font-black uppercase text-mint">{t("settings.eyebrow")}</p>
          <h1 className="mt-1 text-3xl font-black text-ink">{t("settings.title")}</h1>
          <p className="mt-2 font-semibold text-ink/70">{t("settings.description")}</p>
        </header>

        {isReadOnly ? (
          <p className="mt-5 rounded-lg border-2 border-ink bg-sun p-4 font-black text-ink" role="status">
            {t("settings.readOnlyNotice")}
          </p>
        ) : null}

        <section className="mt-5 rounded-lg border-2 border-ink bg-paper p-4 shadow-crisp">
          <h2 className="text-sm font-black uppercase tracking-[0.12em] text-coral">
            {t("settings.familyLinks")}
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Link
              href="/parent"
              className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-ink bg-white px-3 py-2 text-sm font-black text-ink"
            >
              {t("settings.openParent")}
            </Link>
            <Link
              href="/onboarding"
              className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-ink bg-white px-3 py-2 text-sm font-black text-ink"
            >
              {t("settings.editLearner")}
            </Link>
            <Link
              href="/map"
              className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-ink bg-white px-3 py-2 text-sm font-black text-ink"
            >
              {t("settings.openMap")}
            </Link>
            <Link
              href="/tutorial"
              className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border-2 border-ink bg-sun px-3 py-2 text-sm font-black text-ink"
            >
              {t("settings.viewTutorial")}
            </Link>
          </div>
        </section>

        <div className="mt-5">
          <ParentContentAccessControl />
        </div>

        <section className="mt-5 rounded-lg border-2 border-ink bg-white p-5 shadow-crisp">
          <p className="text-sm font-black uppercase text-coral">{t("settings.profile")}</p>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-black text-ink">{activeProfile.nickname}</h2>
              <p className="mt-1 text-sm font-bold text-ink/65">
                {t("settings.ageBand", { age: activeProfile.ageBand })}
              </p>
            </div>
            <span className="rounded-full border-2 border-ink bg-mint px-3 py-2 text-xs font-black text-white">
              {t("settings.active")}
            </span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-black text-ink">
              {t("settings.age")}
              <select
                value={activeProfile.ageBand}
                disabled={isReadOnly}
                onChange={(event) =>
                  updateProfile(activeProfile.id, {
                    ageBand: event.target.value as AgeBand
                  })
                }
                className="focus-ring mt-2 min-h-11 w-full rounded-lg border-2 border-ink bg-white px-3 py-2 font-bold"
              >
                {ageBands.map((band) => (
                  <option key={band} value={band}>{band}</option>
                ))}
              </select>
            </label>
            <div>
              <p className="text-sm font-black text-ink">{t("settings.interfaceMode")}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["guided", "immersion"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={isReadOnly}
                    onClick={() =>
                      updatePreferences({
                        interfaceMode: mode,
                        uiLanguage: mode === "immersion" ? "en" : "zh-CN"
                      })
                    }
                    aria-pressed={activeProfile.preferences.interfaceMode === mode}
                    className="focus-ring min-h-11 rounded-lg border-2 border-ink bg-paper px-3 py-2 text-sm font-black aria-pressed:bg-mint aria-pressed:text-white"
                  >
                    {mode === "guided" ? t("settings.guided") : t("settings.immersion")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-black text-ink">{t("settings.clueLanguage")}</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["en", "zh-CN"] as const).map((language) => (
                <button
                  key={language}
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => updatePreferences({ clueLanguage: language })}
                  aria-pressed={activeProfile.preferences.clueLanguage === language}
                  className="focus-ring min-h-11 rounded-lg border-2 border-ink bg-paper px-3 py-2 text-sm font-black aria-pressed:bg-coral aria-pressed:text-white"
                >
                  {language === "en" ? t("language.clueEnglish") : t("language.clueChinese")}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-lg border-2 border-ink bg-white p-5 shadow-crisp">
          <h2 ref={profilesHeadingRef} tabIndex={-1} className="text-xl font-black text-ink">{t("settings.profiles")}</h2>
          <div className="mt-3 space-y-2">
            {Object.values(profiles).map((profile) => {
              const isActive = profile.id === activeProfile.id;
              return (
                <div key={profile.id} className="flex items-center gap-2 rounded-lg border-2 border-ink/20 bg-paper p-2">
                  <button
                    type="button"
                    onClick={() => switchProfile(profile.id)}
                    disabled={isReadOnly || isActive}
                    className="focus-ring min-h-11 min-w-0 flex-1 rounded-lg px-3 py-2 text-left font-black text-ink disabled:bg-white"
                    aria-label={t("settings.switchProfile", { name: profile.nickname })}
                  >
                    <span className="block truncate">{profile.nickname}</span>
                    <span className="text-xs font-bold text-ink/55">{profile.ageBand}</span>
                  </button>
                  <DeleteProfileControl
                    profileName={profile.nickname}
                    disabled={isReadOnly || Object.keys(profiles).length <= 1}
                    onDelete={() => deleteProfile(profile.id)}
                    onDeleted={() => requestAnimationFrame(() => profilesHeadingRef.current?.focus())}
                  />
                </div>
              );
            })}
          </div>

          <form onSubmit={createProfile} className="mt-5 border-t-2 border-ink/10 pt-4">
            <h3 className="font-black text-ink">{t("settings.createProfile")}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px]">
              <label className="text-sm font-black text-ink">
                {t("settings.nickname")}
                <input
                  value={nickname}
                  disabled={isReadOnly}
                  onChange={(event) => setNickname(event.target.value)}
                  maxLength={24}
                  placeholder={t("settings.nicknamePlaceholder")}
                  className="focus-ring mt-2 min-h-11 w-full rounded-lg border-2 border-ink bg-white px-3 py-2 font-bold"
                />
              </label>
              <label className="text-sm font-black text-ink">
                {t("settings.age")}
                <select
                  value={ageBand}
                  disabled={isReadOnly}
                  onChange={(event) => setAgeBand(event.target.value as AgeBand)}
                  className="focus-ring mt-2 min-h-11 w-full rounded-lg border-2 border-ink bg-white px-3 py-2 font-bold"
                >
                  {ageBands.map((band) => <option key={band}>{band}</option>)}
                </select>
              </label>
            </div>
            <button
              type="submit"
              disabled={isReadOnly || !nickname.trim()}
              className="focus-ring mt-3 min-h-11 rounded-lg border-2 border-ink bg-leaf px-4 py-2 text-sm font-black text-white disabled:opacity-40"
            >
              {t("settings.create")}
            </button>
          </form>
        </section>

        <section className="mt-5">
          <ResetProgressControl onReset={resetProgress} disabled={isReadOnly} />
        </section>
        <p className="mt-5 rounded-lg border-2 border-ink/20 bg-paper p-4 text-sm font-semibold text-ink/70">
          {t("settings.disclaimer")}
        </p>
      </div>
    </main>
  );
}
