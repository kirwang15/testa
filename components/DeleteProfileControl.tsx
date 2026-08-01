"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/use-i18n";

type DeleteProfileControlProps = {
  profileName: string;
  disabled?: boolean;
  onDelete: () => boolean;
  onDeleted?: () => void;
};

export function DeleteProfileControl({
  profileName,
  disabled = false,
  onDelete,
  onDeleted
}: DeleteProfileControlProps) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  const openConfirmation = () => {
    if (disabled) return;
    setConfirming(true);
    setAnnouncement(t("settings.deleteOpened", { name: profileName }));
  };

  const cancel = () => {
    setConfirming(false);
    setAnnouncement(t("settings.deleteCancelled", { name: profileName }));
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const confirm = () => {
    if (disabled) return;
    if (onDelete()) {
      setConfirming(false);
      onDeleted?.();
      return;
    }
    setAnnouncement(t("settings.deleteFailed", { name: profileName }));
    requestAnimationFrame(() => cancelRef.current?.focus());
  };

  return (
    <div className="shrink-0">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {confirming ? (
        <div
          className="max-w-xs rounded-lg border-2 border-red-800 bg-red-50 p-3"
          role="group"
          aria-label={t("settings.deleteGroup", { name: profileName })}
        >
          <p className="font-black text-red-950">
            {t("settings.deleteProfileTitle", { name: profileName })}
          </p>
          <p className="mt-1 text-xs font-bold text-red-900/75">
            {t("settings.deleteProfileDescription", { name: profileName })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              ref={cancelRef}
              type="button"
              onClick={cancel}
              className="focus-ring min-h-11 rounded-lg border-2 border-ink bg-white px-3 py-2 text-xs font-black text-ink"
            >
              {t("settings.cancelDelete")}
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={disabled}
              className="focus-ring min-h-11 rounded-lg border-2 border-red-900 bg-red-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
            >
              {t("settings.confirmDelete", { name: profileName })}
            </button>
          </div>
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={openConfirmation}
          disabled={disabled}
          className="focus-ring min-h-11 rounded-lg border-2 border-red-800 bg-white px-3 py-2 text-xs font-black text-red-800 disabled:opacity-35"
          aria-label={t("settings.deleteProfile", { name: profileName })}
        >
          {t("settings.deleteProfile", { name: profileName })}
        </button>
      )}
    </div>
  );
}
