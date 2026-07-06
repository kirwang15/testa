import Link from "next/link";
import type { ProgressStatus } from "@/lib/levelLoader";
import type { Level, LevelProgress } from "@/types/game";

type LevelCardProps = {
  level: Level;
  progress: LevelProgress;
  status: ProgressStatus;
  isAdvanced?: boolean;
};

export function LevelCard({
  level,
  progress,
  status,
  isAdvanced = false
}: LevelCardProps) {
  const foundCount = progress.foundWords.length;
  const totalCount = level.targetWords.length;
  const title = level.title ?? `Level ${level.id}`;
  const completed = progress.completed;
  const stateLabel =
    status === "completed"
      ? "Completed"
      : status === "recommended"
        ? "Recommended"
        : "Available";
  const statusClass =
    status === "completed"
      ? "bg-leaf text-white"
      : status === "recommended"
        ? "bg-mint text-white"
        : "bg-white text-ink";
  const cardClass = [
    "group flex min-h-56 flex-col justify-between rounded-lg border-2 border-ink bg-white p-5 shadow-crisp transition hover:-translate-y-1 hover:bg-paper",
    status === "recommended" ? "ring-4 ring-sun/60" : ""
  ].join(" ");
  const progressPercent = totalCount === 0 ? 0 : (foundCount / totalCount) * 100;
  const actionLabel = completed ? "Replay" : status === "recommended" ? "Continue" : "Play";

  return (
    <Link href={`/levels/${level.id}`} className={`focus-ring ${cardClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className={[
              "text-sm font-black",
              completed ? "text-leaf" : "text-coral"
            ].join(" ")}
          >
            Level {level.id}
          </p>
          <h2 className="mt-1 text-2xl font-black">{title}</h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={[
              "rounded-lg border-2 border-ink px-3 py-1 text-xs font-black uppercase",
              statusClass
            ].join(" ")}
          >
            {stateLabel}
          </span>
          {level.difficulty ? (
            <span className="rounded-lg border-2 border-ink bg-white px-3 py-1 text-xs font-black uppercase text-ink">
              {level.difficulty}
            </span>
          ) : null}
          {isAdvanced ? (
            <span className="rounded-lg border-2 border-ink bg-sun px-3 py-1 text-xs font-black uppercase text-ink">
              Jump ahead
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {level.letters.map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            className={[
              "grid h-9 w-9 place-items-center rounded-lg border-2 border-ink bg-white font-black",
              completed ? "bg-leaf text-white" : "text-ink"
            ].join(" ")}
          >
            {letter}
          </span>
        ))}
      </div>

      <div className="mt-5">
        <div className="h-3 rounded-lg border-2 border-ink bg-paper">
          <div
            className={[
              "h-full rounded-md",
              completed ? "bg-leaf" : status === "recommended" ? "bg-mint" : "bg-ink/20"
            ].join(" ")}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-sm font-bold">
            <p>{completed ? "Complete" : `${foundCount}/${totalCount} words`}</p>
            {isAdvanced ? (
              <p className="text-xs text-ink/60">
                This level may contain more advanced vocabulary.
              </p>
            ) : null}
          </div>
          <span className="rounded-lg border-2 border-ink bg-ink px-3 py-2 text-sm font-black text-white group-hover:bg-mint">
            {actionLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}
