import { buildGrid, getCellKey, isCellVisible } from "@/lib/game";
import type { CellKey, Level, LevelProgress } from "@/types/game";

type CrosswordGridProps = {
  level: Level;
  progress: LevelProgress;
  recentHintCellKey?: CellKey;
  recentWordId?: string;
  sanitizeText?: (text: string) => string;
};

export function CrosswordGrid({
  level,
  progress,
  recentHintCellKey,
  recentWordId,
  sanitizeText = (text) => text
}: CrosswordGridProps) {
  const grid = buildGrid(level);
  const title = level.title ?? `Level ${level.id}`;
  const safeTitle = sanitizeText(title);
  const boardWidth = Math.max(132, level.grid.cols * 50);

  return (
    <div className="game-board-panel w-full max-w-[640px]">
      <div className="mb-3 flex items-center justify-between gap-3 px-1 text-amber-50">
        <h2 className="truncate text-sm font-black uppercase tracking-[0.14em] sm:text-base">
          {safeTitle}
        </h2>
        <span className="rounded-full border border-amber-100/20 bg-black/25 px-3 py-1 text-xs font-black">
          {progress.foundWords.length}/{level.targetWords.length}
        </span>
      </div>

      <div
        className="game-crossword-grid mx-auto grid max-w-full gap-1.5 sm:gap-2"
        style={{
          gridTemplateColumns: `repeat(${level.grid.cols}, minmax(0, 1fr))`,
          width: `min(100%, ${boardWidth}px)`
        }}
        aria-label={sanitizeText(`${title} crossword grid`)}
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
                  "grid aspect-square min-h-8 place-items-center rounded-lg text-lg font-black transition sm:min-h-11 sm:text-2xl",
                  foundByWord
                    ? "game-grid-tile game-grid-tile-solved"
                    : visible
                      ? "game-grid-tile game-grid-tile-visible"
                      : "game-grid-slot text-transparent",
                  hinted ? "game-grid-tile-hinted" : "",
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
