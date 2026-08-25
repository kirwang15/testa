"use client";

import { buildGrid, getCellKey, isCellVisible } from "@/lib/game";
import { useLevelI18n } from "@/lib/level-i18n";
import type { CellKey, Level, LevelProgress } from "@/types/game";

type CrosswordGridProps = {
  level: Level;
  progress: LevelProgress;
  title: string;
  activeWordId?: string;
  draftLetters?: Partial<Record<CellKey, string>>;
  recentHintCellKey?: CellKey;
  recentWordId?: string;
  invalidWordId?: string;
  sanitizeText?: (text: string) => string;
};

export function CrosswordGrid({
  level,
  progress,
  title,
  activeWordId,
  draftLetters = {},
  recentHintCellKey,
  recentWordId,
  invalidWordId,
  sanitizeText = (text) => text
}: CrosswordGridProps) {
  const { t } = useLevelI18n();
  const grid = buildGrid(level);
  const safeTitle = sanitizeText(title);
  const boardWidth = Math.max(132, level.grid.cols * 48);
  const clueStarts = new Map<string, number>();
  level.targetWords.forEach((word, index) => {
    const key = getCellKey(word.start.row, word.start.col);
    if (!clueStarts.has(key)) {
      clueStarts.set(key, index + 1);
    }
  });
  const cells = Object.values(grid).sort(
    (left, right) => left.row - right.row || left.col - right.col
  );

  return (
    <div className="game-board-panel w-full max-w-[640px]">
      <div className="mb-2 flex items-center justify-between gap-3 px-1 text-amber-50 sm:mb-3">
        <h2 className="truncate text-sm font-black uppercase tracking-[0.14em] sm:text-base">
          {safeTitle}
        </h2>
        <span className="rounded-full border border-amber-100/20 bg-black/25 px-3 py-1 text-xs font-black">
          {progress.foundWords.length}/{level.targetWords.length}
        </span>
      </div>

      <div
        className="game-crossword-grid mx-auto grid max-w-full gap-1 sm:gap-2"
        style={{
          gridTemplateColumns: `repeat(${level.grid.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${level.grid.rows}, minmax(0, 1fr))`,
          width: `min(100%, ${boardWidth}px)`
        }}
        role="grid"
        aria-label={sanitizeText(t("game.crosswordGrid", { title }))}
      >
        {cells.map((cell) => {
            const key = getCellKey(cell.row, cell.col);
            const visible = isCellVisible(cell, progress);
            const foundByWord = cell.wordIds.some((wordId) =>
              progress.foundWords.includes(wordId)
            );
            const belongsToActiveWord = activeWordId
              ? cell.wordIds.includes(activeWordId)
              : false;
            const hinted = progress.revealedCells.includes(key) && !foundByWord;
            const recentlySolved = recentWordId
              ? cell.wordIds.includes(recentWordId)
              : false;
            const recentlyHinted = recentHintCellKey === key;
            const draftLetter = visible ? undefined : draftLetters[key];
            const invalidDraft = Boolean(
              draftLetter && invalidWordId && cell.wordIds.includes(invalidWordId)
            );
            const displayedLetter = visible ? cell.letter : draftLetter;

            return (
              <div
                key={key}
                role="gridcell"
                aria-label={sanitizeText(
                  displayedLetter
                    ? t("game.gridCellLetter", {
                        row: cell.row + 1,
                        col: cell.col + 1,
                        letter: displayedLetter
                      })
                    : t("game.gridCellEmpty", {
                        row: cell.row + 1,
                        col: cell.col + 1
                      })
                )}
                style={{
                  gridColumnStart: cell.col + 1,
                  gridRowStart: cell.row + 1
                }}
                className={[
                  "relative grid aspect-square min-h-7 place-items-center rounded-lg text-base font-black transition sm:min-h-11 sm:text-2xl",
                  foundByWord
                    ? "game-grid-tile game-grid-tile-solved"
                    : visible
                      ? "game-grid-tile game-grid-tile-visible"
                      : draftLetter
                      ? invalidDraft
                        ? "game-grid-tile border-red-200 bg-red-700 text-white ring-2 ring-red-300/35"
                        : "game-grid-tile game-grid-tile-draft"
                      : "game-grid-slot text-transparent",
                  hinted ? "game-grid-tile-hinted" : "",
                  belongsToActiveWord ? "game-grid-tile-active" : "",
                  recentlySolved ? "animate-cell-pop" : "",
                  recentlyHinted ? "animate-hint-glow" : ""
                ].join(" ")}
              >
                {clueStarts.has(key) ? (
                  <span
                    className="pointer-events-none absolute left-1 top-0.5 text-[9px] font-black leading-none opacity-60 sm:text-[10px]"
                    aria-hidden="true"
                  >
                    {clueStarts.get(key)}
                  </span>
                ) : null}
                {displayedLetter ?? ""}
              </div>
            );
          })}
      </div>
    </div>
  );
}
