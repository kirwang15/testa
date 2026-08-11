"use client";

import { ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getDefaultContentAccessLevel } from "@/lib/content-access";
import { useI18n } from "@/lib/use-i18n";
import {
  selectActiveProfile,
  selectIsReadOnly,
  useGameStore
} from "@/store/gameStore";
import type { ContentAccessLevel } from "@/types/game";

const accessLevels: ContentAccessLevel[] = [
  "all-ages",
  "13-plus",
  "parent-review"
];

export function ParentContentAccessControl() {
  const { t } = useI18n();
  const profile = useGameStore(selectActiveProfile);
  const isReadOnly = useGameStore(selectIsReadOnly);
  const updateProfile = useGameStore((state) => state.updateProfile);
  const [pending, setPending] = useState<ContentAccessLevel>();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const defaultLevel = getDefaultContentAccessLevel(profile.ageBand);

  useEffect(() => {
    setPending(undefined);
  }, [profile.id]);

  useEffect(() => {
    if (!pending) return;
    const focusFrame = window.requestAnimationFrame(() => cancelRef.current?.focus());
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setPending(undefined);
      }
    };
    document.addEventListener("keydown", cancelOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", cancelOnEscape);
    };
  }, [pending]);

  const label = (level: ContentAccessLevel) => {
    if (level === "13-plus") return t("contentAccess.thirteenPlus");
    if (level === "parent-review") return t("contentAccess.parentReview");
    return t("contentAccess.allAges");
  };

  const confirm = () => {
    if (!pending || isReadOnly) return;
    updateProfile(profile.id, {
      contentAccessLevel: pending,
      contentAccessOverride: true
    });
    setPending(undefined);
  };

  return (
    <section className="rounded-lg border-2 border-ink bg-white p-5 shadow-crisp">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-6 w-6 flex-none text-coral" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-black text-ink">{t("contentAccess.title")}</h2>
          <p className="mt-1 text-sm font-semibold text-ink/65">
            {t("contentAccess.description")}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {accessLevels.map((level) => (
          <button
            key={level}
            type="button"
            disabled={isReadOnly}
            onClick={() => setPending(level)}
            aria-pressed={profile.contentAccessLevel === level}
            className="focus-ring min-h-12 rounded-lg border-2 border-ink bg-paper px-3 py-2 text-sm font-black text-ink aria-pressed:bg-ink aria-pressed:text-white disabled:opacity-45"
          >
            {label(level)}
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs font-bold text-ink/60">
        {profile.contentAccessOverride
          ? t("contentAccess.parentChoice")
          : t("contentAccess.ageDefault", { level: label(defaultLevel) })}
      </p>

      {pending ? (
        <div
          className="mt-4 rounded-lg border-2 border-coral bg-coral/10 p-4"
          role="alertdialog"
          aria-labelledby="content-access-confirm-title"
          aria-describedby="content-access-confirm-description"
        >
          <h3 id="content-access-confirm-title" className="font-black text-ink">
            {t("contentAccess.confirmTitle", { level: label(pending) })}
          </h3>
          <p id="content-access-confirm-description" className="mt-1 text-sm font-semibold text-ink/70">
            {pending === "parent-review"
              ? t("contentAccess.parentReviewWarning")
              : t("contentAccess.confirmDescription")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              ref={cancelRef}
              onClick={() => setPending(undefined)}
              className="focus-ring min-h-11 rounded-lg border-2 border-ink bg-white px-4 py-2 text-sm font-black text-ink"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              disabled={isReadOnly}
              onClick={confirm}
              className="focus-ring min-h-11 rounded-lg border-2 border-ink bg-coral px-4 py-2 text-sm font-black text-white"
            >
              {t("contentAccess.confirm")}
            </button>
          </div>
        </div>
      ) : null}

      {profile.contentAccessOverride ? (
        <button
          type="button"
          disabled={isReadOnly}
          onClick={() =>
            updateProfile(profile.id, {
              contentAccessOverride: false,
              contentAccessLevel: defaultLevel
            })
          }
          className="focus-ring mt-3 min-h-11 rounded-lg border-2 border-ink bg-white px-4 py-2 text-sm font-black text-ink"
        >
          {t("contentAccess.useAgeDefault")}
        </button>
      ) : null}
    </section>
  );
}
