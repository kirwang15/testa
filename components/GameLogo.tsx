"use client";

import { useI18n } from "@/lib/use-i18n";

export function GameLogo() {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3" aria-label="Word Trail">
      <svg
        className="h-14 w-14 flex-none"
        viewBox="0 0 72 72"
        role="img"
        aria-hidden="true"
      >
        <rect x="8" y="14" width="22" height="22" rx="6" fill="#18a999" />
        <rect x="31" y="14" width="22" height="22" rx="6" fill="#ffc857" />
        <rect x="19" y="37" width="22" height="22" rx="6" fill="#ff6b57" />
        <path
          d="M17 25h4m21 0h4M28 48h4"
          stroke="#161616"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M49 45l8 3-8 3-3 8-3-8-8-3 8-3 3-8 3 8z"
          fill="#4caf50"
          stroke="#161616"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
      <div>
        <p className="text-sm font-bold text-mint">Word Trail</p>
        <h1 className="text-3xl font-black leading-tight text-ink sm:text-4xl">
          {t("brand.tagline")}
        </h1>
      </div>
    </div>
  );
}
