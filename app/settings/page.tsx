"use client";

import Link from "next/link";
import { ResetProgressControl } from "@/components/ResetProgressControl";
import { useGameStore } from "@/store/gameStore";

export default function SettingsPage() {
  const resetProgress = useGameStore((state) => state.resetProgress);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="focus-ring inline-flex min-h-11 items-center rounded-lg border-2 border-ink bg-white px-4 py-2 text-sm font-black text-ink"
        >
          Back home
        </Link>
        <header className="mt-5 rounded-lg border-2 border-ink bg-white p-5 shadow-crisp">
          <p className="text-sm font-black uppercase text-mint">Parent controls</p>
          <h1 className="mt-1 text-3xl font-black text-ink">Local data</h1>
          <p className="mt-2 font-semibold text-ink/70">
            Word Trail stores progress only on this device.
          </p>
        </header>
        <section className="mt-5">
          <ResetProgressControl onReset={resetProgress} />
        </section>
      </div>
    </main>
  );
}
