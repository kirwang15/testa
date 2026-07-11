"use client";

import {
  ArrowLeft,
  Coins,
  Gem,
  Lightbulb,
  Sparkles,
  Trophy
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CrosswordGrid } from "@/components/CrosswordGrid";
import { CompletionActions } from "@/components/CompletionActions";
import { FeedbackBanner, type FeedbackType } from "@/components/FeedbackBanner";
import { LetterWheel } from "@/components/LetterWheel";
import { WordSlots } from "@/components/WordSlots";
import {
  buildGrid,
  createEmptyLevelProgress,
  createReplayLevelProgress,
  getCellKey,
  isCellVisible,
  scoreLevelAttempt
} from "@/lib/game";
import { getHintAction } from "@/lib/hint-stage";
import { getNextLevel, isLevelAheadOfRecommendation } from "@/lib/levelLoader";
import { getLevelScopedAttemptProgress } from "@/lib/level-session";
import { isSpeechRequestCurrent } from "@/lib/speech-request";
import { sanitizeLevelPresentationText } from "@/lib/word-card-presentation";
import { speakEnglishWord } from "@/lib/speech";
import { useGameStore } from "@/store/gameStore";
import { getWordById } from "@/src/lib/vocabulary-loader";
import type { CellKey, Level, LevelProgress } from "@/types/game";

type LevelGameProps = {
  level: Level;
};

type FeedbackState = {
  id: number;
  type: FeedbackType;
  title: string;
  description?: string;
};

export function LevelGame({ level }: LevelGameProps) {
  const coins = useGameStore((state) => state.coins);
  const hasHydrated = useGameStore((state) => state.hasHydrated);
  const allLevelProgress = useGameStore((state) => state.levels);
  const wordProgressById = useGameStore((state) => state.words);
  const savedProgress = useGameStore((state) => state.levels[level.id]);
  const submitWord = useGameStore((state) => state.submitWord);
  const setCurrentLevel = useGameStore((state) => state.setCurrentLevel);
  const restartLevelAttempt = useGameStore((state) => state.restartLevelAttempt);
  const toggleFavorite = useGameStore((state) => state.toggleFavorite);
  const useHint = useGameStore((state) => state.useHint);
  const confirmPronunciationHint = useGameStore(
    (state) => state.confirmPronunciationHint
  );
  const [attemptProgress, setAttemptProgress] = useState<LevelProgress>();
  const [sessionLevelId, setSessionLevelId] = useState(level.id);
  const sessionIsCurrent = sessionLevelId === level.id;
  const progress =
    getLevelScopedAttemptProgress(sessionLevelId, level.id, attemptProgress) ??
    savedProgress ??
    createEmptyLevelProgress();
  const levelTitle = level.title ?? `Level ${level.id}`;
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState>({
    id: 0,
    type: "neutral",
    title: "Ready"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHinting, setIsHinting] = useState(false);
  const [recentWordId, setRecentWordId] = useState<string>();
  const [recentHintCellKey, setRecentHintCellKey] = useState<CellKey>();
  const feedbackIdRef = useRef(0);
  const submitLockedRef = useRef(false);
  const hintLockedRef = useRef(false);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechRequestTokenRef = useRef(0);
  const mountedRef = useRef(true);
  const currentLevelIdRef = useRef(level.id);
  const activeSelectedIndexes = sessionIsCurrent ? selectedIndexes : [];
  const currentWord = activeSelectedIndexes
    .map((index) => level.letters[index])
    .join("");
  const isJumpAheadLevel = isLevelAheadOfRecommendation(level.id, allLevelProgress);
  const nextLevel = getNextLevel(level.id);
  const hintTarget = level.targetWords.find(
    (word) => !progress.foundWords.includes(word.id)
  );
  const hintTargetIndex = hintTarget
    ? level.targetWords.findIndex((word) => word.id === hintTarget.id)
    : -1;
  const hintStage = {
    wordId: hintTarget?.id ?? "",
    interactions: hintTarget ? progress.hintStages[hintTarget.id] ?? 0 : 0
  };
  const hintFirstCell = hintTarget
    ? buildGrid(level)[getCellKey(hintTarget.start.row, hintTarget.start.col)]
    : undefined;
  const firstPositionVisible = hintFirstCell
    ? isCellVisible(hintFirstCell, progress)
    : false;
  const hintAction = hintTarget
    ? getHintAction(hintStage, hintTarget.id, firstPositionVisible)
    : undefined;
  const currentHintTargetIdRef = useRef<string | undefined>(undefined);
  currentLevelIdRef.current = level.id;
  currentHintTargetIdRef.current = hintTarget?.id;
  const safeText = (text: string) =>
    sanitizeLevelPresentationText(level, progress, text) ?? "";

  useEffect(() => {
    setCurrentLevel(level.id);
  }, [level.id, setCurrentLevel]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    setAttemptProgress(
      savedProgress?.completed
        ? createReplayLevelProgress(savedProgress)
        : savedProgress ?? createEmptyLevelProgress()
    );
    setSessionLevelId(level.id);
    setSelectedIndexes([]);
    setRecentWordId(undefined);
    setRecentHintCellKey(undefined);
    setFeedback({ id: 0, type: "neutral", title: "Ready" });
    submitLockedRef.current = false;
    hintLockedRef.current = false;
    setIsSubmitting(false);
    setIsHinting(false);
  }, [hasHydrated, level.id]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      speechRequestTokenRef.current += 1;
      if (submitTimerRef.current) {
        clearTimeout(submitTimerRef.current);
      }
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current);
      }
    };
  }, []);

  const showFeedback = (
    type: FeedbackType,
    title: string,
    description?: string
  ) => {
    feedbackIdRef.current += 1;
    setFeedback({
      id: feedbackIdRef.current,
      type,
      title,
      description
    });
  };

  const lockSubmitBriefly = () => {
    submitLockedRef.current = true;
    setIsSubmitting(true);

    if (submitTimerRef.current) {
      clearTimeout(submitTimerRef.current);
    }

    submitTimerRef.current = setTimeout(() => {
      submitLockedRef.current = false;
      setIsSubmitting(false);
    }, 420);
  };

  const lockHintBriefly = () => {
    hintLockedRef.current = true;
    setIsHinting(true);

    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
    }

    hintTimerRef.current = setTimeout(() => {
      hintLockedRef.current = false;
      setIsHinting(false);
    }, 520);
  };

  const chooseLetter = (index: number) => {
    if (
      progress.completed ||
      !sessionIsCurrent ||
      isSubmitting ||
      submitLockedRef.current ||
      selectedIndexes.includes(index)
    ) {
      return;
    }

    setSelectedIndexes((current) => [...current, index]);
  };

  const clearWord = () => {
    setSelectedIndexes([]);
    showFeedback("neutral", "Ready");
  };

  const backspace = () => {
    setSelectedIndexes((current) => current.slice(0, -1));
  };

  const submitCurrentWord = () => {
    if (
      progress.completed ||
      !sessionIsCurrent ||
      isSubmitting ||
      submitLockedRef.current ||
      currentWord.length === 0
    ) {
      return;
    }

    lockSubmitBriefly();
    const submission = submitWord(level, currentWord, progress);
    const result = submission.result;
    setAttemptProgress(submission.attemptProgress);
    setSelectedIndexes([]);

    if (result.status === "correct") {
      speechRequestTokenRef.current += 1;
      setRecentWordId(result.word.id);
      showFeedback("correct", `${result.word.word} found.`, "The grid filled it in.");
      return;
    }

    if (result.status === "level-complete") {
      speechRequestTokenRef.current += 1;
      setRecentWordId(result.word.id);
      const rewardMessage = result.reward === 0
        ? "Your best score is saved; replay rewards are not duplicated."
        : result.bonusReward > 0
          ? `+${result.baseReward} coins, +${result.bonusReward} completion bonus.`
          : `+${result.reward} coins.`;
      showFeedback(
        "complete",
        "Level complete.",
        `Every word is filled. ${rewardMessage}`
      );
      return;
    }

    if (result.status === "already-found") {
      showFeedback(
        "duplicate",
        `${result.attempt} is already found.`,
        "That word is already on the board."
      );
      return;
    }

    showFeedback(
      "wrong",
      `${result.attempt || "That"} is not in this puzzle.`,
      "Try a different letter order."
    );
  };

  const revealHint = () => {
    if (
      progress.completed ||
      !sessionIsCurrent ||
      isHinting ||
      hintLockedRef.current
    ) {
      return;
    }

    lockHintBriefly();
    if (!hintTarget || !hintAction) {
      showFeedback("duplicate", "No clue needs help.", "The board is already clear.");
      return;
    }

    if (hintAction === "pronunciation") {
      const vocabulary = hintTarget.vocabularyWordId
        ? getWordById(hintTarget.vocabularyWordId)
        : undefined;
      speechRequestTokenRef.current += 1;
      const request = {
        token: speechRequestTokenRef.current,
        scopeId: level.id,
        itemId: hintTarget.id
      };
      let settled = false;
      const requestIsCurrent = () =>
        isSpeechRequestCurrent(
          request,
          speechRequestTokenRef.current,
          currentLevelIdRef.current,
          currentHintTargetIdRef.current,
          mountedRef.current
        );
      const commitHint = (title: string, description: string) => {
        if (settled || !requestIsCurrent()) {
          return;
        }
        settled = true;
        const pronunciation = confirmPronunciationHint(
          request.scopeId,
          request.itemId
        );
        if (pronunciation.status !== "applied") {
          return;
        }
        setAttemptProgress(pronunciation.attemptProgress);
        showFeedback("hint", title, description);
      };
      const showFallback = () => {
        if (settled || !requestIsCurrent()) {
          return;
        }
        if (vocabulary?.phonetic) {
          commitHint(
            "Pronunciation fallback shown.",
            `Pronunciation: ${vocabulary.phonetic}. The next clue step reveals a letter.`
          );
          return;
        }
        settled = true;
        showFeedback(
          "duplicate",
          "Pronunciation is unavailable.",
          "No clue was charged. Try again or reveal a letter later."
        );
      };
      speakEnglishWord(hintTarget.word, undefined, {
        onStarted: () =>
          commitHint(
            "Pronunciation played.",
            "The next clue step reveals a letter."
          ),
        onFailed: showFallback
      });
      return;
    }

    const hintUsage = useHint(level, progress, hintTarget.id);
    const result = hintUsage.result;
    setAttemptProgress(hintUsage.attemptProgress);

    if (result.status === "revealed") {
      setRecentHintCellKey(result.cellKey);
      showFeedback(
        "hint",
        hintAction === "first-letter"
          ? `First letter revealed: ${result.letter}.`
          : `Another position revealed: ${result.letter}.`,
        "Clue steps affect stars, never your coin balance."
      );
      return;
    }

    showFeedback("duplicate", "No hidden letters left.", "The board is already clear.");
  };

  const replayLevel = () => {
    const historicalProgress =
      useGameStore.getState().levels[level.id] ?? progress;
    setAttemptProgress(createReplayLevelProgress(historicalProgress));
    restartLevelAttempt(level.id);
    setSelectedIndexes([]);
    setRecentWordId(undefined);
    setRecentHintCellKey(undefined);
    showFeedback("neutral", "Fresh attempt ready.", "Your best result is preserved.");
  };

  return (
    <main className="game-stage min-h-screen overflow-hidden text-white">
      <div className="game-table-surface" aria-hidden="true" />
      <div className="game-corner game-corner-left" aria-hidden="true" />
      <div className="game-corner game-corner-right" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-3 py-3 sm:px-5 sm:py-5 lg:px-8">
        <header className="flex items-start justify-between gap-3">
          <Link
            href="/"
            className="game-icon-button focus-ring"
            aria-label={safeText("Back to levels")}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>

          <div className="flex min-w-0 flex-1 justify-center px-2">
            <div className="game-level-tag max-w-full">
              <Sparkles className="h-4 w-4 shrink-0 text-sun" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-xs font-black uppercase tracking-[0.08em] text-amber-100/75">
                  {safeText(level.difficulty ?? "level")}
                </p>
                <h1 className="truncate text-sm font-black text-white sm:text-base">
                  {safeText(levelTitle)}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="game-coin-hud" aria-label={safeText(`${coins} coins`)}>
              <Gem className="h-5 w-5 text-fuchsia-200" aria-hidden="true" />
              <span>{coins}</span>
            </div>
          </div>
        </header>

        <section className="grid flex-1 gap-5 py-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start lg:py-5">
          <div className="flex min-h-full flex-col items-center justify-center gap-3 sm:gap-4">
            <div className="flex w-full max-w-[760px] items-center justify-center">
              <CrosswordGrid
                level={level}
                progress={progress}
                recentHintCellKey={sessionIsCurrent ? recentHintCellKey : undefined}
                recentWordId={sessionIsCurrent ? recentWordId : undefined}
                sanitizeText={safeText}
              />
            </div>

            <div className="grid w-full max-w-[760px] items-center gap-3 md:grid-cols-[92px_minmax(0,1fr)_92px]">
              <div className="order-2 flex justify-center gap-3 md:order-1 md:flex-col md:items-center">
                <button
                  type="button"
                  onClick={revealHint}
                  disabled={progress.completed || !sessionIsCurrent || isHinting}
                  className="game-orb-button focus-ring"
                  aria-label={safeText(
                    hintAction === "pronunciation"
                      ? "Play pronunciation clue"
                      : hintAction === "first-letter"
                        ? "Reveal first letter"
                        : "Reveal another position"
                  )}
                >
                  <Lightbulb className="h-6 w-6" aria-hidden="true" />
                  <span>
                    {isHinting
                      ? "..."
                      : safeText(
                          hintAction === "pronunciation"
                            ? "Listen"
                            : hintAction === "first-letter"
                              ? "Letter"
                              : "Clue"
                        )}
                  </span>
                </button>
              </div>

              <div className="order-1 md:order-2">
                <LetterWheel
                  letters={level.letters}
                  selectedIndexes={activeSelectedIndexes}
                  currentWord={currentWord}
                  disabled={progress.completed || !sessionIsCurrent || isSubmitting}
                  isSubmitting={isSubmitting}
                  onBackspace={backspace}
                  onChoose={chooseLetter}
                  onClear={clearWord}
                  onSubmit={submitCurrentWord}
                  sanitizeText={safeText}
                />
              </div>

              <div className="order-3 flex justify-center md:flex-col md:items-center">
                <div
                  className={[
                    "game-progress-medal",
                    progress.completed ? "game-progress-medal-complete" : ""
                  ].join(" ")}
                  aria-label={
                    progress.completed
                      ? safeText("Level complete")
                      : safeText(`${progress.foundWords.length} of ${level.targetWords.length} words found`)
                  }
                >
                  {progress.completed ? (
                    <Trophy className="h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Coins className="h-6 w-6" aria-hidden="true" />
                  )}
                  <span>{progress.completed ? safeText("Clear") : `${progress.foundWords.length}/${level.targetWords.length}`}</span>
                </div>
              </div>
            </div>

            {isJumpAheadLevel ? (
              <p className="rounded-full border border-amber-100/25 bg-black/30 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.12em] text-amber-100 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
                {safeText("Advanced vocabulary")}
              </p>
            ) : null}
          </div>

          <aside className="w-full lg:sticky lg:top-5">
            <div className="rounded-[1.5rem] border border-amber-100/15 bg-black/16 p-3 shadow-[0_20px_40px_rgba(0,0,0,0.26)] backdrop-blur-sm sm:p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-200/80">
                    {safeText("Meanings")}
                  </p>
                  <h2 className="text-2xl font-black text-white">
                    {safeText("English and Chinese")}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-amber-50/78">
                    {safeText("Spell on the left, study each word on the right.")}
                  </p>
                </div>
                <div className="rounded-full border border-amber-100/20 bg-black/30 px-3 py-1 text-sm font-black text-amber-50">
                  {progress.foundWords.length}/{level.targetWords.length}
                </div>
              </div>
              <WordSlots
                level={level}
                progress={progress}
                recentWordId={sessionIsCurrent ? recentWordId : undefined}
                hintTargetId={hintTarget?.id}
                hintTargetLabel={hintTargetIndex >= 0 ? `Clue ${hintTargetIndex + 1}` : undefined}
                wordProgressById={wordProgressById}
                onToggleFavorite={toggleFavorite}
                meaningDisplay="bilingual"
              />
              {progress.completed ? (
                <CompletionActions
                  stars={scoreLevelAttempt(progress)}
                  nextLevelId={nextLevel?.id}
                  onReplay={replayLevel}
                />
              ) : null}
            </div>
          </aside>
        </section>

        {sessionIsCurrent && (feedback.id > 0 || progress.completed) ? (
          <div className="game-feedback-float">
            <FeedbackBanner
              key={progress.completed ? `complete-${feedback.id}` : feedback.id}
              type={
                progress.completed && feedback.type !== "complete"
                  ? "complete"
                  : feedback.type
              }
              title={
                progress.completed && feedback.type !== "complete"
                  ? "Every word is filled."
                  : feedback.title
              }
              description={
                progress.completed && feedback.type !== "complete"
                  ? "Level complete."
                  : feedback.description
              }
              sanitizeText={safeText}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
