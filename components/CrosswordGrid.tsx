import { buildGrid, getCellKey, isCellVisible } from "@/lib/game";
import type { CellKey, Level, LevelProgress } from "@/types/game";

type CrosswordGridProps = {
  level: Level;
  progress: LevelProgress;
  recentHintCellKey?: CellKey;
  recentWordId?: string;
};

export function CrosswordGrid({
  level,
  progress,
  recentHintCellKey,
  recentWordId
}: CrosswordGridProps) {
  const grid = buildGrid(level);
  const title = level.title ?? `Level ${level.id}`;

  return (
    <div
      className="w-full max-w-[560px] rounded-lg border-2 border-ink bg-white p-3 shadow-crisp sm:p-4"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-mint">Board</p>
          <h2 className="text-lg font-black text-ink">{title}</h2>
        </div>
        <p className="max-w-[190px] text-right text-xs font-bold text-ink/70">
          Solved letters turn green. Hint reveals glow yellow.
        </p>
      </div>

      <div
        className="grid gap-1 rounded-lg border-2 border-ink bg-ink p-2 sm:gap-1.5 sm:p-3"
        style={{
          gridTemplateColumns: `repeat(${level.grid.cols}, minmax(0, 1fr))`
        }}
        aria-label={`${title} crossword grid`}
      >
        {Array.from({ length: level.grid.rows }).flatMap((_, row) =>
          Array.from({ length: level.grid.cols }).map((__, col) => {
            const key = getCellKey(row, col);
            const cell = grid[key];

            if (!cell) {
              return <div key={key} className="aspect-square rounded bg-transparent" />;
            }

            const visible = isCellVisible(cell, progress);
            const foundByWord = cell.wordIds.some((wordId) =>
              progress.foundWords.includes(wordId)
            );
            const hinted = progress.revealedCells.includes(key) && !foundByWord;
            const recentlySolved = recentWordId
              ? cell.wordIds.includes(recentWordId)
              : false;
            const recentlyHinted = recentHintCellKey === key;

            return (
              <div
                key={key}
                className={[
                  "grid aspect-square min-h-10 place-items-center rounded-md border-2 text-xl font-black transition sm:min-h-12 sm:text-2xl",
                  foundByWord
                    ? "border-ink bg-leaf text-white"
                    : visible
                      ? "border-ink bg-white text-ink"
                      : "border-white bg-paper text-transparent",
                  hinted ? "bg-sun text-ink ring-4 ring-sun/35" : "",
                  recentlySolved ? "animate-cell-pop" : "",
                  recentlyHinted ? "animate-hint-glow" : ""
                ].join(" ")}
              >
                {visible ? cell.letter : ""}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
