"use client";

import { Bookmark, CheckCircle2, Languages, Volume2 } from "lucide-react";
import { getActiveCluePresentation } from "@/lib/clue-presentation";
import { getCellsForWord, getCellKey } from "@/lib/game";
import {
  getWordCardPresentation,
  sanitizeLevelPresentationText
} from "@/lib/word-card-presentation";
import { useLevelI18n } from "@/lib/level-i18n";
import { getRuntimeVocabularyWordById } from "@/lib/content-runtime";
import { speakEnglishWord } from "@/lib/speech";
import type {
  ClueLanguage,
  Level,
  LevelProgress,
  WordLearningProgress
} from "@/types/game";

type WordSlotsProps = {
  level: Level;
  progress: LevelProgress;
  recentWordId?: string;
  hintTargetId?: string;
  activeWordId?: string;
  clueLanguage: ClueLanguage;
  wordProgressById?: Record<string, WordLearningProgress>;
  onToggleClueLanguage: () => void;
  onToggleFavorite?: (wordId: string) => void;
  onSelectWord?: (wordId: string) => void;
  onContinueFromDetail?: () => void;
  mutationDisabled?: boolean;
};

export function WordSlots({
  level,
  progress,
  recentWordId,
  hintTargetId,
  activeWordId,
  clueLanguage,
  wordProgressById = {},
  onToggleClueLanguage,
  onToggleFavorite,
  onSelectWord,
  onContinueFromDetail,
  mutationDisabled = false
}: WordSlotsProps) {
  const { t } = useLevelI18n();
  const solvedCount = progress.completed
    ? level.targetWords.length
    : progress.foundWords.length;
  const safeText = (text: string) =>
    sanitizeLevelPresentationText(level, progress, text) ?? "";
  const activeWord =
    level.targetWords.find((word) => word.id === activeWordId) ??
    level.targetWords.find((word) => !progress.foundWords.includes(word.id)) ??
    (progress.completed ? level.targetWords[0] : undefined);
  const activeIndex = activeWord
    ? level.targetWords.findIndex((word) => word.id === activeWord.id)
    : -1;

  if (!activeWord) {
    return null;
  }

  const wordProgress = activeWord.vocabularyWordId
    ? wordProgressById[activeWord.vocabularyWordId]
    : undefined;
  const isFavorite = wordProgress?.favorite === true;
  const presentation = getWordCardPresentation(
    level,
    activeWord,
    progress,
    isFavorite
  );
  const found = presentation.solved;
  const vocabulary = activeWord.vocabularyWordId
    ? getRuntimeVocabularyWordById(activeWord.vocabularyWordId)
    : undefined;
  const cluePresentation = getActiveCluePresentation(
    clueLanguage,
    {
      english: presentation.englishMeaning,
      chinese: presentation.chineseMeaning
    },
    t("common.noExplanation"),
    activeWord.source
  );
  const cells = getCellsForWord(activeWord);

  return (
    <div className="rounded-[1.25rem] border border-amber-100/15 bg-black/20 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-4">
      <div className="hidden items-end justify-between gap-3 lg:flex">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-200/75">
            {safeText(t("game.progress"))}
          </p>
          <h2 className="text-xl font-black text-white">
            {safeText(t("game.findEveryWord"))}
          </h2>
        </div>
        <p className="rounded-full border border-amber-100/20 bg-black/30 px-3 py-1 text-sm font-black text-amber-50">
          {safeText(t("common.solved", { done: solvedCount, total: level.targetWords.length }))}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 lg:mt-4 lg:flex-wrap lg:overflow-visible" aria-label={safeText(t("game.chooseClue"))}>
        {level.targetWords.map((word, index) => {
          const solved = progress.foundWords.includes(word.id) || progress.completed;
          const selected = word.id === activeWord.id;
          return (
            <button
              key={word.id}
              type="button"
              onClick={() => onSelectWord?.(word.id)}
              aria-pressed={selected}
              aria-label={
                solved
                  ? safeText(t("game.solvedClueDetailAria", {
                      number: index + 1,
                      direction: t(`game.${word.direction}`),
                      length: word.word.length
                    }))
                  : undefined
              }
              className={[
                "focus-ring min-h-11 shrink-0 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.08em] transition",
                solved
                    ? `cursor-pointer border-emerald-200/55 bg-emerald-700/60 text-emerald-50 hover:bg-emerald-600/70 ${recentWordId === word.id ? "ring-2 ring-emerald-200/60" : ""}`
                    : selected
                  ? "border-sky-200/70 bg-sky-500/35 text-white ring-2 ring-sky-300/30"
                    : "border-amber-100/20 bg-black/25 text-amber-50 hover:bg-black/40"
              ].join(" ")}
            >
              {safeText(t("game.clue", { number: index + 1 }))} · {safeText(t(`game.${word.direction}`))} · {word.word.length}
              {solved ? <CheckCircle2 className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" /> : null}
              {solved ? (
                <span className="ml-1 normal-case tracking-normal underline">
                  {safeText(t("game.viewDetails"))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <section
        className={[
          "mt-2 rounded-2xl border p-3 transition sm:mt-4 sm:p-4",
          found
            ? "border-emerald-200/35 bg-emerald-700/60 text-white"
            : hintTargetId === activeWord.id
              ? "border-sky-200/45 bg-[#2a1409]/85 text-amber-50 ring-2 ring-sky-300/25"
              : "border-amber-100/20 bg-[#2a1409]/85 text-amber-50",
          recentWordId === activeWord.id ? "animate-feedback-pop" : ""
        ].join(" ")}
        aria-label={safeText(t("game.currentClue"))}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] opacity-75">
              {safeText(t("game.clue", { number: activeIndex + 1 }))} · {safeText(t(`game.${activeWord.direction}`))}
            </p>
            <p className="mt-1 text-sm font-bold opacity-80">
              {safeText(t("common.letters", { count: activeWord.word.length }))}
            </p>
            {activeWord.source ? (
              <p className="mt-1 text-[11px] font-bold opacity-70">
                {safeText(
                  activeWord.source.type !== "ielts" &&
                    activeWord.source.type !== "kaoyan"
                    ? t("game.source", {
                        book: activeWord.source.book,
                        lesson: activeWord.source.lesson
                      })
                    : activeWord.source.type === "ielts"
                      ? t("game.sourceIelts", {
                          list: activeWord.source.listId,
                          rank: activeWord.source.rank
                        })
                      : t("game.sourceKaoyan", {
                          list: activeWord.source.listId,
                          rank: activeWord.source.rank
                        })
                )}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onToggleClueLanguage}
            disabled={mutationDisabled}
            className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-xl border border-current/25 bg-black/20 px-3 py-2 text-xs font-black"
            aria-label={
              clueLanguage === "en"
                ? safeText(t("language.showChineseClue"))
                : safeText(t("language.showEnglishClue"))
            }
          >
            <Languages className="h-4 w-4" aria-hidden="true" />
            {clueLanguage === "en"
              ? safeText(t("language.clueEnglish"))
              : safeText(t("language.clueChinese"))}
          </button>
        </div>

        {found ? (
          <div className="mt-4 rounded-xl border border-white/15 bg-black/15 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-black tracking-[0.08em]">
                  {presentation.wordText}
                </p>
                {vocabulary?.partOfSpeech || vocabulary?.phonetic ? (
                  <p className="mt-1 text-xs font-bold opacity-75">
                    {[vocabulary.partOfSpeech, vocabulary.phonetic]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}
              </div>
              {activeWord.vocabularyWordId ? (
                <button
                  type="button"
                  onClick={() => onToggleFavorite?.(activeWord.vocabularyWordId!)}
                  disabled={mutationDisabled}
                  className="focus-ring grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-white/90 text-[#301006]"
                  aria-label={presentation.favoriteActionLabel}
                >
                  <Bookmark
                    className={["h-4 w-4", isFavorite ? "fill-current" : ""].join(" ")}
                    aria-hidden="true"
                  />
                </button>
              ) : null}
            </div>
            {vocabulary?.examples[0] ? (
              <p className="mt-3 text-sm font-semibold leading-6 opacity-90">
                {vocabulary.examples[0]}
              </p>
            ) : null}
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-black/15 p-2">
                <dt className="text-[10px] font-black uppercase opacity-65">{safeText(t("game.englishMeaning"))}</dt>
                <dd className="mt-1 font-bold">{safeText(vocabulary?.englishMeaning ?? activeWord.englishMeaning ?? activeWord.clue)}</dd>
              </div>
              <div className="rounded-lg bg-black/15 p-2">
                <dt className="text-[10px] font-black uppercase opacity-65">{safeText(t("game.chineseMeaning"))}</dt>
                <dd className="mt-1 font-bold">{safeText(vocabulary?.chineseMeaning ?? activeWord.chineseMeaning ?? t("common.noExplanation"))}</dd>
              </div>
              <div className="rounded-lg bg-black/15 p-2">
                <dt className="text-[10px] font-black uppercase opacity-65">{safeText(t("game.wordLevel"))}</dt>
                <dd className="mt-1 font-bold">{vocabulary?.cefrLevel ? `CEFR ${vocabulary.cefrLevel}` : safeText(t("common.noExplanation"))}</dd>
              </div>
              <div className="rounded-lg bg-black/15 p-2">
                <dt className="text-[10px] font-black uppercase opacity-65">{safeText(t("game.wordSource"))}</dt>
                <dd className="mt-1 font-bold">
                  {safeText(
                    activeWord.source?.type === "ielts"
                      ? t("game.sourceIelts", { list: activeWord.source.listId, rank: activeWord.source.rank })
                      : activeWord.source?.type === "kaoyan"
                        ? t("game.sourceKaoyan", { list: activeWord.source.listId, rank: activeWord.source.rank })
                        : activeWord.source
                          ? t("game.source", { book: activeWord.source.book, lesson: activeWord.source.lesson })
                          : t("common.noExplanation")
                  )}
                </dd>
              </div>
            </dl>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => speakEnglishWord(activeWord.word)}
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/90 px-3 font-black text-[#301006]"
              >
                <Volume2 className="h-4 w-4" aria-hidden="true" />
                {safeText(t("game.listen"))}
              </button>
              {!progress.completed ? (
                <button
                  type="button"
                  onClick={onContinueFromDetail}
                  className="focus-ring min-h-11 rounded-xl border border-white/25 bg-black/25 px-3 font-black text-white"
                >
                  {safeText(t("game.continueNextWord"))}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-2 rounded-xl border border-current/15 bg-black/15 px-3 py-2 text-sm font-bold leading-6 sm:mt-4 sm:px-4 sm:py-3 sm:text-base sm:leading-7">
            {safeText(cluePresentation.text)}
          </p>
        )}

        <div className="mt-4 hidden flex-wrap gap-1.5 sm:flex" aria-hidden="true">
          {presentation.letterTexts.map((letter, index) => {
            const cell = cells[index];
            const key = getCellKey(cell.row, cell.col);
            const visible = letter !== "_";
            const hinted = progress.revealedCells.includes(key) && !found;
            return (
              <span
                key={`${activeWord.id}-${index}`}
                className={[
                  "grid h-9 w-9 place-items-center rounded-lg border text-sm font-black",
                  found
                    ? "border-emerald-900/30 bg-white text-emerald-700"
                    : hinted || visible
                      ? "border-amber-900/30 bg-amber-300 text-[#210d06]"
                      : "border-black/30 bg-black/35 text-transparent"
                ].join(" ")}
              >
                {letter}
              </span>
            );
          })}
        </div>
      </section>
    </div>
  );
}
