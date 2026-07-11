import { Bookmark, CheckCircle2 } from "lucide-react";
import { getCellsForWord, getCellKey } from "@/lib/game";
import {
  getWordCardPresentation,
  sanitizeLevelPresentationText
} from "@/lib/word-card-presentation";
import { WordMeaningToggle } from "@/components/WordMeaningToggle";
import type { Level, LevelProgress, WordLearningProgress } from "@/types/game";

type WordSlotsProps = {
  level: Level;
  progress: LevelProgress;
  recentWordId?: string;
  hintTargetId?: string;
  hintTargetLabel?: string;
  wordProgressById?: Record<string, WordLearningProgress>;
  onToggleFavorite?: (wordId: string) => void;
  meaningDisplay?: "toggle" | "bilingual";
};

export function WordSlots({
  level,
  progress,
  recentWordId,
  hintTargetId,
  hintTargetLabel,
  wordProgressById = {},
  onToggleFavorite,
  meaningDisplay = "toggle"
}: WordSlotsProps) {
  const solvedCount = progress.completed ? level.targetWords.length : progress.foundWords.length;
  const isBilingualView = meaningDisplay === "bilingual";
  const safeText = (text: string) =>
    sanitizeLevelPresentationText(level, progress, text) ?? "";

  return (
    <div className="rounded-[1.25rem] border border-amber-100/15 bg-black/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-200/75">
            {safeText(isBilingualView ? "Vocabulary" : "Progress")}
          </p>
          <h2 className="text-xl font-black text-white">
            {safeText(isBilingualView ? "Word meanings" : "Find every word")}
          </h2>
        </div>
        <p className="rounded-full border border-amber-100/20 bg-black/30 px-3 py-1 text-sm font-black text-amber-50">
          {solvedCount}/{level.targetWords.length} {safeText("solved")}
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {level.targetWords.map((word, wordIndex) => {
          const recentlyFound = recentWordId === word.id;
          const isHintTarget = hintTargetId === word.id;
          const cells = getCellsForWord(word);
          const wordProgress = word.vocabularyWordId
            ? wordProgressById[word.vocabularyWordId]
            : undefined;
          const vocabularyWordId = word.vocabularyWordId;
          const isFavorite = wordProgress?.favorite === true;
          const presentation = getWordCardPresentation(level, word, progress, isFavorite);
          const found = presentation.solved;

          return (
            <div
              key={word.id}
              className={[
                "rounded-2xl border p-3 shadow-sm transition",
                found
                  ? "border-emerald-200/30 bg-emerald-700/65 text-white"
                  : "border-amber-100/15 bg-[#2a1409]/80 text-amber-50",
                recentlyFound ? "animate-feedback-pop ring-4 ring-amber-200/20" : "",
                isHintTarget && !found ? "ring-4 ring-sky-300/45" : ""
              ].join(" ")}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] opacity-80">
                    {found
                      ? safeText("Solved")
                      : isHintTarget
                        ? safeText(hintTargetLabel ?? `Clue ${wordIndex + 1}`)
                        : safeText(`Clue ${wordIndex + 1}`)}
                  </p>
                  {!found ? (
                    <p className="mt-1 text-xs font-bold opacity-75">
                      {word.word.length} {safeText("letters")}
                    </p>
                  ) : null}
                  {isBilingualView ? (
                    <p className="mt-1 text-base font-black tracking-[0.08em] text-white/95">
                      {presentation.wordText}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {vocabularyWordId && found ? (
                    <button
                      type="button"
                      onClick={() => onToggleFavorite?.(vocabularyWordId)}
                      className="focus-ring grid h-11 w-11 place-items-center rounded-full border border-amber-100/25 bg-white/90 text-[#301006] transition hover:-translate-y-0.5"
                      aria-label={presentation.favoriteActionLabel}
                    >
                      <Bookmark
                        className={["h-4 w-4", isFavorite ? "fill-current" : ""].join(" ")}
                        aria-hidden="true"
                      />
                    </button>
                  ) : null}
                  {found ? (
                    <span className="grid h-8 w-8 place-items-center rounded-full border border-emerald-100/40 bg-white/90 text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {presentation.letterTexts.map((letter, index) => {
                  const cell = cells[index];
                  const key = getCellKey(cell.row, cell.col);
                  const visible = letter !== "_";
                  const hinted = progress.revealedCells.includes(key) && !found;

                  return (
                    <span
                      key={`${word.id}-${index}`}
                      className={[
                        "grid h-9 w-9 place-items-center rounded-lg border text-sm font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] sm:h-10 sm:w-10",
                        found
                          ? "border-emerald-900/30 bg-white text-emerald-700"
                          : hinted
                            ? "border-amber-900/30 bg-amber-300 text-[#210d06] ring-2 ring-amber-200/30"
                            : visible
                              ? "border-amber-900/30 bg-white text-[#210d06]"
                              : "border-black/30 bg-black/35 text-transparent"
                      ].join(" ")}
                    >
                      {letter}
                    </span>
                  );
                })}
              </div>
              {meaningDisplay === "bilingual" ? (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="rounded-xl border border-current/15 bg-black/10 px-3 py-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] opacity-70">
                      {safeText("English")}
                    </p>
                    <p className="mt-1 font-semibold leading-6">
                      {presentation.englishMeaning ?? safeText("No explanation available")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-current/15 bg-black/10 px-3 py-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] opacity-70">
                      中文
                    </p>
                    <p className="mt-1 font-semibold leading-6">
                      {presentation.chineseMeaning ?? "暂无中文解释"}
                    </p>
                  </div>
                </div>
              ) : (
                <WordMeaningToggle
                  className="mt-3"
                  wordLabel={presentation.wordText}
                  englishMeaning={presentation.englishMeaning}
                  chineseMeaning={presentation.chineseMeaning}
                  fallbackMeaning={presentation.englishMeaning}
                  sanitizeText={safeText}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
