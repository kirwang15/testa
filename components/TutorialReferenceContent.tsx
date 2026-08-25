"use client";

import { TutorialPanel, getTutorialReferenceCopy } from "@/components/TutorialPanel";
import type { UiLanguage } from "@/types/game";

export function TutorialReferenceContent({ language }: { language: UiLanguage }) {
  const header = getTutorialReferenceCopy(language);
  return (
    <>
      <header className="rounded-xl border-2 border-ink bg-white p-5 text-ink shadow-crisp">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-coral">
          {header.eyebrow}
        </p>
        <h1 className="mt-1 text-3xl font-black">{header.title}</h1>
        <p className="mt-2 font-bold text-ink/65">{header.description}</p>
      </header>
      {(["home", "map", "game", "detail", "complete"] as const).map((section) => (
        <TutorialPanel key={section} language={language} section={section} />
      ))}
    </>
  );
}
