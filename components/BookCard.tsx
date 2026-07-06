import Link from "next/link";
import type { BookProgress, VocabularyBook } from "@/types/game";
import type { ProgressStatus } from "@/lib/levelLoader";

type BookCardProps = {
  book: VocabularyBook;
  progress: BookProgress;
  status?: ProgressStatus;
};

export function BookCard({
  book,
  progress,
  status = "available"
}: BookCardProps) {
  const completionLabel =
    progress.totalLevels === 0
      ? "No levels yet"
      : `${progress.completedLevels}/${progress.totalLevels} levels`;
  const themeClassByBook = {
    mint: "bg-mint text-white",
    coral: "bg-coral text-white",
    leaf: "bg-leaf text-white",
    gold: "bg-sun text-ink"
  } as const;
  const themeClass = book.colorTheme
    ? themeClassByBook[book.colorTheme]
    : "bg-white text-ink";
  const statusLabel =
    status === "completed"
      ? "Completed"
      : status === "recommended"
        ? "Recommended"
        : "Available";

  return (
    <Link
      href={`/books/${book.id}`}
      className="focus-ring group flex min-h-64 flex-col justify-between rounded-lg border-2 border-ink bg-white p-5 shadow-crisp transition hover:-translate-y-1 hover:bg-paper"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-mint">{book.level}</p>
            <h2 className="mt-1 text-2xl font-black text-ink">{book.title}</h2>
            <p className="mt-1 text-sm font-bold text-coral">{book.subtitle}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`rounded-lg border-2 border-ink px-3 py-1 text-xs font-black uppercase ${themeClass}`}
            >
              {book.unitIds.length} units
            </span>
            <span className="rounded-lg border-2 border-ink bg-white px-3 py-1 text-xs font-black uppercase text-ink">
              {book.estimatedWordCount ?? 0} words
            </span>
            <span className="rounded-lg border-2 border-ink bg-white px-3 py-1 text-xs font-black uppercase text-ink">
              {statusLabel}
            </span>
          </div>
        </div>
        <p className="text-sm font-semibold text-ink/75">{book.description}</p>
      </div>

      <div className="space-y-3">
        <div className="h-3 rounded-lg border-2 border-ink bg-paper">
          <div
            className="h-full rounded-md bg-mint"
            style={{ width: `${progress.completionPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-bold text-ink">
            <p>{completionLabel}</p>
            <p className="text-xs text-ink/60">
              {progress.learnedWords} learned · {progress.masteredWords} mastered
            </p>
          </div>
          <span className="rounded-lg border-2 border-ink bg-ink px-3 py-2 text-sm font-black text-white group-hover:bg-mint">
            {status === "recommended" ? "Continue" : "Open book"}
          </span>
        </div>
      </div>
    </Link>
  );
}
