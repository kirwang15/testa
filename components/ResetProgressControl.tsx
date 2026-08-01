"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/use-i18n";

type ResetProgressControlProps = {
  onReset: () => void;
  disabled?: boolean;
};

const CONFIRMATION_WORD = "ERASE";

export function ResetProgressControl({
  onReset,
  disabled = false
}: ResetProgressControlProps) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const resetButtonRef = useRef<HTMLButtonElement>(null);
  const confirmationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (confirming) {
      confirmationInputRef.current?.focus();
    }
  }, [confirming]);

  const startConfirmation = () => {
    if (disabled) return;
    setConfirming(true);
    setConfirmation("");
    setAnnouncement(t("settings.confirmOpened"));
  };

  const cancelReset = () => {
    setConfirming(false);
    setConfirmation("");
    setAnnouncement(t("settings.kept"));
    requestAnimationFrame(() => resetButtonRef.current?.focus());
  };

  const confirmReset = () => {
    if (disabled) return;
    if (confirmation.trim().toUpperCase() !== CONFIRMATION_WORD) {
      setAnnouncement(t("settings.typeErase"));
      confirmationInputRef.current?.focus();
      return;
    }

    onReset();
    setConfirming(false);
    setConfirmation("");
    setAnnouncement(t("settings.erased"));
    requestAnimationFrame(() => resetButtonRef.current?.focus());
  };

  return (
    <details className="rounded-lg border-2 border-ink/25 bg-white/70 p-3 text-ink">
      <summary className="focus-ring flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm font-black">
        {t("settings.parentControls")}
      </summary>
      <div className="mt-3 border-t-2 border-ink/10 px-3 pt-3">
        <p className="max-w-xl text-sm font-semibold text-ink/70">
          {t("settings.resetDescription")}
        </p>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
        {confirming ? (
          <div className="mt-3" role="group" aria-label={t("settings.confirmGroup")}>
            <label htmlFor="reset-confirmation" className="text-sm font-black text-ink">
              {t("settings.confirmLabel")}
            </label>
            <input
              ref={confirmationInputRef}
              id="reset-confirmation"
              type="text"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              disabled={disabled}
              className="focus-ring mt-2 min-h-11 w-full rounded-lg border-2 border-ink bg-white px-3 py-2 font-black uppercase text-ink"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={confirmReset}
                disabled={disabled || confirmation.trim().toUpperCase() !== CONFIRMATION_WORD}
                className="focus-ring min-h-11 rounded-lg border-2 border-red-800 bg-red-700 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("settings.erase")}
              </button>
              <button
                type="button"
                onClick={cancelReset}
                className="focus-ring min-h-11 rounded-lg border-2 border-ink bg-white px-4 py-2 text-sm font-black text-ink"
              >
                {t("settings.keep")}
              </button>
            </div>
          </div>
        ) : (
          <button
            ref={resetButtonRef}
            type="button"
            onClick={startConfirmation}
            disabled={disabled}
            className="focus-ring mt-3 min-h-11 rounded-lg border-2 border-ink bg-white px-4 py-2 text-sm font-black text-ink disabled:cursor-not-allowed disabled:opacity-45"
          >
            {t("settings.reset")}
          </button>
        )}
      </div>
    </details>
  );
}
