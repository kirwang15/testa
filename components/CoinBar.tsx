"use client";

import { useI18n } from "@/lib/use-i18n";

type CoinBarProps = {
  coins: number;
};

export function CoinBar({ coins }: CoinBarProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex min-h-12 items-center gap-3 rounded-lg border-2 border-ink bg-sun px-4 py-2 text-ink shadow-crisp">
        <span
          aria-hidden="true"
          className="grid h-8 w-8 place-items-center rounded-md border-2 border-ink bg-white text-base font-black"
        >
          ¢
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-black uppercase text-ink/70">{t("common.coins")}</p>
          <p className="text-lg font-black">{coins}</p>
        </div>
      </div>
    </div>
  );
}
