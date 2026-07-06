import { getCellsForWord, getCellKey } from "@/lib/game";
import { WordMeaningToggle } from "@/components/WordMeaningToggle";
import type { Level, LevelProgress, WordLearningProgress } from "@/types/game";

type WordSlotsProps = {
  level: Level;
  progress: LevelProgress;
  recentWordId?: string;
  wordProgressById?: Record<string, WordLearningProgress>;
  onToggleFavorite?: (wordId: string) => void;
};

export function WordSlots({
  level,
  progress,
  recentWordId,
  wordProgressById = {},
  onToggleFavorite
}: WordSlotsProps) {
  const solvedCount = progress.completed ? level.targetWords.length : progress.foundWords.length;

  return (
    <div className="rounded-lg border-2 border-ink bg-white p-4 shadow-crisp sm:p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase text-coral">Words</p>
          <h2 className="text-2xl font-black text-ink">Find every word</h2>
        </div>
        <p className="text-sm font-bold text-ink/70">
          {solvedCount}/{level.targetWords.length} solved
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {level.targetWords.map((word) => {
          const found = progress.foundWords.includes(word.id) || progress.completed;
          const recentlyFound = recentWordId === word.id;
          const cells = getCellsForWord(word);
          const wordProgress = word.vocabularyWordId
            ? wordProgressById[word.vocabularyWordId]
            : undefined;
          const isFavorite = wordProgress?.favorite === true;

          return (
            <div
              key={word.id}
              className={[
                "rounded-lg border-2 p-3 shadow-sm transition",
                found ? "border-ink bg-leaf text-white" : "border-ink bg-white text-ink",
                recentlyFound ? "animate-feedback-pop ring-4 ring-sun/25" : ""
              ].join(" ")}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase">
                  {found ? "Solved" : `${word.word.length} letters`}
                </p>
                <div className="flex items-center gap-2">
                  {word.vocabularyWordId ? (
                    <button
                      type="button"
                      onClick={() => onToggleFavorite?.(word.vocabularyWordId!)}
                      className="focus-ring rounded-lg border-2 border-ink bg-white px-2 py-1 text-xs font-black text-ink transition hover:-translate-y-0.5"
                    >
                      {isFavorite ? "Saved" : "Save"}
                    </button>
                  ) : null}
                  {found ? (
                    <span className="rounded-lg border-2 border-ink bg-white px-2 py-1 text-xs font-black text-leaf">
                      Filled
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {word.word.split("").map((letter, index) => {
                  const cell = cells[index];
                  const key = getCellKey(cell.row, cell.col);
                  const visible = found || progress.revealedCells.includes(key);
                  const hinted = progress.revealedCells.includes(key) && !found;

                  return (
                    <span
                      key={`${word.id}-${index}`}
                      className={[
                        "grid h-9 w-9 place-items-center rounded-md border-2 border-ink text-sm font-black sm:h-10 sm:w-10",
                        found
                          ? "bg-white text-leaf"
                          : hinted
                            ? "bg-sun text-ink ring-2 ring-sun/35"
                            : visible
                              ? "bg-paper text-ink"
                              : "bg-white text-transparent"
                      ].join(" ")}
                    >
                      {visible ? letter : "_"}
                    </span>
                  );
                })}
              </div>
              <WordMeaningToggle
                className="mt-3"
                wordLabel={word.word}
                englishMeaning={word.englishMeaning}
                chineseMeaning={word.chineseMeaning}
                fallbackMeaning={word.clue}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
