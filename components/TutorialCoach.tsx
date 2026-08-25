"use client";

import { useId, type ReactNode } from "react";

type TutorialCoachProps = {
  eyebrow: string;
  title: string;
  description: string;
  items: string[];
  actions?: ReactNode;
  compact?: boolean;
};

export function TutorialCoach({
  eyebrow,
  title,
  description,
  items,
  actions,
  compact = false
}: TutorialCoachProps) {
  const titleId = useId();
  return (
    <section
      className={`rounded-xl border-2 border-ink bg-sun text-ink shadow-crisp ${compact ? "p-4" : "p-5 sm:p-6"}`}
      aria-labelledby={titleId}
      data-testid="tutorial-coach"
    >
      <p className="text-xs font-black uppercase tracking-[0.14em] opacity-65">
        {eyebrow}
      </p>
      <h2 id={titleId} className="mt-1 text-2xl font-black">
        {title}
      </h2>
      <p className="mt-2 text-sm font-bold leading-6 opacity-75">{description}</p>
      <ul className="mt-3 grid gap-2 text-sm font-bold sm:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="rounded-lg border-2 border-ink/15 bg-white/70 p-3">
            {item}
          </li>
        ))}
      </ul>
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </section>
  );
}
