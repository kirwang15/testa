import Link from "next/link";
import type { ProgressStatus } from "@/lib/levelLoader";
import type { UnitProgress, VocabularyBook, VocabularyUnit } from "@/types/game";

type UnitCardProps = {
  book: VocabularyBook;
  unit: VocabularyUnit;
  progress: UnitProgress;
  status: ProgressStatus;
  levelCount: number;
};

export function UnitCard({
  book,
  unit,
  progress,
  status,
  levelCount
}: UnitCardProps) {
  const statusLabel =
    status === "completed"
      ? "Completed"
      : status === "recommended"
        ? "Recommended"
        : "Available";

  return (
    <Link
      href={`/books/${book.id}/units/${unit.id}`}
      className="focus-ring group flex min-h-56 flex-col justify-between rounded-lg border-2 border-ink bg-white p-5 shadow-crisp transition hover:-translate-y-1 hover:bg-paper"
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-mint">
              {unit.lessonRange ?? "Vocabulary practice"}
            </p>
            <h2 className="mt-1 text-2xl font-black text-ink">{unit.title}</h2>
            <p className="mt-2 text-sm font-bold text-coral">
              {unit.difficulty} · {unit.estimatedMinutes ?? 10} min
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="rounded-lg border-2 border-ink bg-white px-3 py-1 text-xs font-black uppercase text-ink">
              {levelCount} levels
            </span>
            <span
              className={`rounded-lg border-2 border-ink px-3 py-1 text-xs font-black uppercase ${
                status === "completed"
                  ? "bg-leaf text-white"
                  : status === "recommended"
                    ? "bg-mint text-white"
                    : "bg-white text-ink"
              }`}
            >
              {statusLabel}
            </span>
          </div>
        </div>
        <p className="text-sm font-semibold text-ink/75">
          {unit.wordIds.length} words in this unit, ready for learning-mode or review-mode puzzles.
        </p>
      </div>

      <div className="space-y-3">
        <div className="h-3 rounded-lg border-2 border-ink bg-paper">
          <div
            className="h-full rounded-md bg-leaf"
            style={{ width: `${progress.completionPercent}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-bold text-ink">
            <p>
              {progress.completedLevels}/{progress.totalLevels} levels complete
            </p>
            <p className="text-xs text-ink/60">
              {progress.learnedWords} learned · {progress.masteredWords} mastered
            </p>
          </div>
          <span className="rounded-lg border-2 border-ink bg-ink px-3 py-2 text-sm font-black text-white group-hover:bg-leaf">
            {status === "recommended" ? "Continue" : "Open unit"}
          </span>
        </div>
      </div>
    </Link>
  );
}
