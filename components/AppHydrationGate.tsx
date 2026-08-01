"use client";

import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { getRequiredOnboardingRoute } from "@/lib/onboarding";
import { useI18n } from "@/lib/use-i18n";
import {
  selectActiveProfile,
  selectHydrationStatus,
  useGameStore
} from "@/store/gameStore";

type AppHydrationGateProps = {
  children: ReactNode;
};

export function AppHydrationGate({ children }: AppHydrationGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const hasHydrated = useGameStore((state) => state.hasHydrated);
  const hydrationStatus = useGameStore(selectHydrationStatus);
  const profile = useGameStore(selectActiveProfile);
  const { t } = useI18n();

  const requiredRoute = getRequiredOnboardingRoute(
    mounted && hasHydrated,
    pathname,
    profile.onboardingCompleted || hydrationStatus === "unsupported-version"
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (requiredRoute) {
      router.replace(requiredRoute);
    }
  }, [requiredRoute, router]);

  if (!mounted || !hasHydrated || requiredRoute) {
    return (
      <main
        className="grid min-h-screen place-items-center px-6"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className="h-12 w-12 animate-pulse rounded-lg border-2 border-ink bg-mint shadow-crisp"
            aria-hidden="true"
          />
          <p className="font-black text-ink">{t("app.loading")}</p>
        </div>
      </main>
    );
  }

  const statusMessage =
    hydrationStatus === "write-failed"
      ? t("storage.writeFailed")
      : hydrationStatus === "unsupported-version"
        ? t("storage.unsupported")
        : hydrationStatus === "recovered"
          ? t("storage.recovered")
          : undefined;

  return (
    <>
      {children}
      {statusMessage ? (
        <div
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-lg border-2 border-ink bg-sun px-4 py-3 text-sm font-black text-ink shadow-crisp"
          role="status"
        >
          {statusMessage}
        </div>
      ) : null}
    </>
  );
}
