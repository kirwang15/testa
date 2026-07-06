"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CoinBar } from "@/components/CoinBar";
import { CrosswordGrid } from "@/components/CrosswordGrid";
import { CurrentWord } from "@/components/CurrentWord";
import { FeedbackBanner, type FeedbackType } from "@/components/FeedbackBanner";
import { GameLogo } from "@/components/GameLogo";
import { LetterWheel } from "@/components/LetterWheel";
import { WordSlots } from "@/components/WordSlots";
import { createEmptyLevelProgress } from "@/lib/game";
import { isLevelAheadOfRecommendation } from "@/lib/levelLoader";
import { useGameStore } from "@/store/gameStore";
import type { CellKey, Level } from "@/types/game";

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
  const allLevelProgress = useGameStore((state) => state.levels);
  const wordProgressById = useGameStore((state) => state.words);
  const savedProgress = useGameStore((state) => state.levels[level.id]);
  const submitWord = useGameStore((state) => state.submitWord);
  const setCurrentLevel = useGameStore((state) => state.setCurrentLevel);
  const toggleFavorite = useGameStore((state) => state.toggleFavorite);
  const useHint = useGameStore((state) => state.useHint);
  const progress = savedProgress ?? createEmptyLevelProgress();
  const levelTitle = level.title ?? `Level ${level.id}`;
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState>({
    id: 0,
    type: "neutral",
    title: "Tap letters to make a word."
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
  const currentWord = useMemo(
    () => selectedIndexes.map((index) => level.letters[index]).join(""),
    [level.letters, selectedIndexes]
  );
  const isJumpAheadLevel = isLevelAheadOfRecommendation(level.id, allLevelProgress);
  const canAffordHint = coins >= level.hintCost;
  const missingCoins = Math.max(level.hintCost - coins, 0);

  useEffect(() => {
    setCurrentLevel(level.id);
  }, [level.id, setCurrentLevel]);

  useEffect(() => {
    return () => {
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
    showFeedback("neutral", "Try another word.");
  };

  const backspace = () => {
    setSelectedIndexes((current) => current.slice(0, -1));
  };

  const submitCurrentWord = () => {
    if (
      progress.completed ||
      isSubmitting ||
      submitLockedRef.current ||
      currentWord.length === 0
    ) {
      return;
    }

    lockSubmitBriefly();
    const result = submitWord(level, currentWord);
    setSelectedIndexes([]);

    if (result.status === "correct") {
      setRecentWordId(result.word.id);
      showFeedback("correct", `${result.word.word} found.`, "The grid filled it in.");
      return;
    }

    if (result.status === "level-complete") {
      setRecentWordId(result.word.id);
      const rewardMessage =
        result.bonusReward > 0
          ? `+${result.baseReward} coins, +${result.bonusReward} no-hint bonus.`
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
    if (progress.completed || isHinting || hintLockedRef.current || !canAffordHint) {
      return;
    }

    lockHintBriefly();
    const result = useHint(level);

    if (result.status === "revealed") {
      setRecentHintCellKey(result.cellKey);
      showFeedback(
        "hint",
        `Hint revealed ${result.letter}.`,
        `${result.cost} coins spent.`
      );
      return;
    }

    if (result.status === "not-enough-coins") {
      showFeedback(
        "wrong",
        `Hints need ${result.cost} coins.`,
        `You have ${coins} coins. Complete levels to earn more.`
      );
      return;
    }

    showFeedback("duplicate", "No hidden letters left.", "The board is already clear.");
  };

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="rounded-lg border-2 border-ink bg-white p-4 shadow-crisp sm:p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <Link
                href="/"
                className="focus-ring inline-flex min-h-11 items-center rounded-lg border-2 border-ink bg-paper px-4 font-bold text-ink transition hover:-translate-y-0.5 hover:bg-white"
              >
                Back to levels
              </Link>
              <GameLogo />
              <div className="flex flex-wrap gap-2">
                <span className="rounded-lg border-2 border-ink bg-white px-3 py-1 text-xs font-black uppercase text-coral">
                  Level {level.id}
                </span>
                {level.difficulty ? (
                  <span className="rounded-lg border-2 border-ink bg-white px-3 py-1 text-xs font-black uppercase text-mint">
                    {level.difficulty}
                  </span>
                ) : null}
                <span className="rounded-lg border-2 border-ink bg-white px-3 py-1 text-xs font-black uppercase text-leaf">
                  Reward {level.rewardCoins}
                </span>
                <span className="rounded-lg border-2 border-ink bg-white px-3 py-1 text-xs font-black uppercase text-ink">
                  Hint {level.hintCost}
                </span>
              </div>
              <p className="max-w-2xl text-base font-semibold text-ink">
                {progress.completed
                  ? `${levelTitle} is complete. Every word is filled in.`
                  : `${levelTitle}: ${progress.foundWords.length}/${level.targetWords.length} words found.`}
              </p>
              {isJumpAheadLevel ? (
                <div className="max-w-2xl rounded-lg border-2 border-ink bg-sun px-4 py-3 text-sm font-bold text-ink shadow-crisp">
                  This level may contain more advanced vocabulary.
                </div>
              ) : null}
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <CoinBar coins={coins} />
              <div
                className={[
                  "rounded-lg border-2 border-ink px-3 py-2 text-sm font-black shadow-crisp",
                  progress.completed ? "bg-mint text-white" : "bg-paper text-ink"
                ].join(" ")}
              >
                {progress.completed
                  ? "Level complete"
                  : `Found ${progress.foundWords.length} of ${level.targetWords.length}`}
              </div>
            </div>
          </div>
        </header>

        <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col items-center gap-5">
            <CrosswordGrid
              level={level}
              progress={progress}
              recentHintCellKey={recentHintCellKey}
              recentWordId={recentWordId}
            />
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
            />
          </div>

          <div className="flex flex-col gap-5">
            <CurrentWord
              currentWord={currentWord}
              disabled={progress.completed}
              feedbackType={feedback.type}
              isSubmitting={isSubmitting}
              onClear={clearWord}
              onSubmit={submitCurrentWord}
            />
            <LetterWheel
              letters={level.letters}
              selectedIndexes={selectedIndexes}
              disabled={progress.completed || isSubmitting}
              onBackspace={backspace}
              onChoose={chooseLetter}
            />
            <div className="space-y-2">
              <button
                type="button"
                onClick={revealHint}
                disabled={progress.completed || isHinting || !canAffordHint}
                className={[
                  "focus-ring min-h-12 w-full rounded-lg border-2 border-ink px-4 py-3 font-black shadow-crisp transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink/50 disabled:opacity-70",
                  canAffordHint ? "bg-coral text-white" : "bg-white text-coral"
                ].join(" ")}
              >
                {isHinting
                  ? "Revealing"
                  : `Hint - ${level.hintCost} coins`}
              </button>
              <div className="space-y-1 text-center text-xs font-bold">
                <p className="text-ink/70">Balance: {coins} coins</p>
                <p className={canAffordHint ? "text-ink/70" : "text-coral"}>
                  {canAffordHint
                    ? "Hints reveal one hidden letter."
                    : `Need ${missingCoins} more coins for a hint.`}
                </p>
              </div>
            </div>
          <WordSlots
            level={level}
            progress={progress}
            recentWordId={recentWordId}
            wordProgressById={wordProgressById}
            onToggleFavorite={toggleFavorite}
          />
          </div>
        </section>
      </div>
    </main>
  );
}
