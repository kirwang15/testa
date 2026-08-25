"use client";

import {
  ArrowLeft,
  Coins,
  Gem,
  Lightbulb,
  ShieldAlert,
  Sparkles,
  Trophy
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { CrosswordGrid } from "@/components/CrosswordGrid";
import { CompletionActions } from "@/components/CompletionActions";
import { FeedbackBanner, type FeedbackType } from "@/components/FeedbackBanner";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
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
import {
  getAllLevels,
  getLevelById,
  getLevelsByCurriculumId
} from "@/lib/curriculum-index";
import {
  getDifficultyTranslationKey,
  getLevelPosition
} from "@/lib/curriculum-presentation";
import {
  canAccessLevel,
  getNextEligibleLevel,
  isLevelAheadOfEligibleRecommendation
} from "@/lib/content-access";
import {
  getRuntimeVocabularyWordById,
  loadLevelRuntimeBundle,
  toRuntimeLevelId
} from "@/lib/content-runtime";
import { getLevelScopedAttemptProgress } from "@/lib/level-session";
import { isSpeechRequestCurrent } from "@/lib/speech-request";
import { sanitizeLevelPresentationText } from "@/lib/word-card-presentation";
import { speakEnglishWord } from "@/lib/speech";
import { useLevelI18n } from "@/lib/level-i18n";
import {
  claimAutoSubmission,
  resetAutoSubmission
} from "@/lib/auto-word-validation";
import {
  getDirectLevelFallback,
  sanitizeLevelReturnTo
} from "@/lib/level-navigation";
import { mustInspectTutorialWord } from "@/lib/tutorial-progress";
import {
  selectActiveGameProgress,
  selectActiveProfile,
  selectIsReadOnly,
  useGameStore
} from "@/store/gameStore";
import {
  addCrosswordDraftLetter,
  createEmptyCrosswordDraft,
  getCrosswordDraftView,
  reconcileCrosswordDraft,
  removeLastCrosswordDraftLetter,
  resolveActiveClue
} from "@/src/lib/crossword-session";
import type {
  CellKey,
  Level,
  LevelProgress,
  ProfileActionContext
} from "@/types/game";

let levelActionSessionSequence = 0;

type LevelGameProps = {
  levelId: string;
  contentVersion: string;
};

type ResolvedLevelGameProps = {
  level: Level;
  returnTo: string;
};

type FeedbackState = {
  id: number;
  type: FeedbackType;
  title: string;
  description?: string;
};

export function LevelGame({ levelId, contentVersion }: LevelGameProps) {
  const { t } = useLevelI18n();
  const activeProfile = useGameStore(selectActiveProfile);
  const hasHydrated = useGameStore((state) => state.hasHydrated);
  const runtimeLevelId = toRuntimeLevelId(levelId);
  const levelSummary = getLevelById(runtimeLevelId);
  const [requestedReturnTo, setRequestedReturnTo] = useState<string>();
  const safeReturnTo =
    sanitizeLevelReturnTo(requestedReturnTo) ??
    getDirectLevelFallback(levelSummary?.curriculumId, levelSummary?.bookId ?? "nce-1997-b1");
  const indexBlocked = Boolean(
    hasHydrated && levelSummary && !canAccessLevel(activeProfile, levelSummary)
  );
  const [runtimeBlocked, setRuntimeBlocked] = useState(false);
  const blocked = indexBlocked || runtimeBlocked;
  const [level, setLevel] = useState<Level>();
  const [loadError, setLoadError] = useState(false);
  const [retrySequence, setRetrySequence] = useState(0);

  useEffect(() => {
    setRequestedReturnTo(
      new URLSearchParams(window.location.search).get("returnTo") ?? undefined
    );
  }, [levelId]);

  useEffect(() => {
    setLevel(undefined);
    setLoadError(false);
    setRuntimeBlocked(false);
    if (!hasHydrated || indexBlocked) return;
    const controller = new AbortController();
    let current = true;
    loadLevelRuntimeBundle(levelId, contentVersion, controller.signal)
      .then((bundle) => {
        if (current && !controller.signal.aborted) {
          if (
            !canAccessLevel(activeProfile, {
              bookId: bundle.level.bookId,
              rating: bundle.rating
            })
          ) {
            setRuntimeBlocked(true);
          } else if (bundle.level.id === runtimeLevelId) {
            setLevel(bundle.level);
          }
        }
      })
      .catch((error: unknown) => {
        if (
          current &&
          !controller.signal.aborted &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          setLoadError(true);
        }
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [
    activeProfile.ageBand,
    activeProfile.contentAccessLevel,
    contentVersion,
    hasHydrated,
    indexBlocked,
    levelId,
    retrySequence,
    runtimeLevelId
  ]);

  if (blocked) {
    return (
      <main className="game-stage flex min-h-screen items-center justify-center px-5 text-white">
        <section className="w-full max-w-lg rounded-2xl border border-amber-100/25 bg-black/55 p-6 text-center shadow-2xl">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-200" aria-hidden="true" />
          <h1 className="mt-3 text-2xl font-black">{t("game.contentBlockedTitle")}</h1>
          <p className="mt-2 text-sm font-semibold text-amber-50/80">
            {t("game.contentBlockedDescription")}
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <Link href={safeReturnTo} className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-100/30 bg-amber-100 px-4 py-2 font-black text-[#301006]">
              {t("nav.backPrevious")}
            </Link>
            <Link href="/settings" className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-100/30 bg-black/30 px-4 py-2 font-black">
              {t("nav.settings")}
            </Link>
            <Link href="/parent" className="focus-ring inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-100/30 bg-black/30 px-4 py-2 font-black">
              {t("nav.parent")}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="game-stage flex min-h-screen items-center justify-center px-5 text-white">
        <section className="w-full max-w-md rounded-2xl border border-amber-100/20 bg-black/35 p-6 text-center">
          <h1 className="text-2xl font-black">{t("game.loadErrorTitle")}</h1>
          <p className="mt-2 text-sm font-semibold text-amber-50/80">
            {t("game.loadErrorDescription")}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => setRetrySequence((value) => value + 1)}
              className="focus-ring min-h-11 rounded-xl border border-amber-100/30 bg-amber-100 px-4 py-2 font-black text-[#301006]"
            >
              {t("game.retry")}
            </button>
            <Link
              href={safeReturnTo}
              className="focus-ring inline-flex min-h-11 items-center rounded-xl border border-amber-100/30 bg-black/30 px-4 py-2 font-black"
            >
              {t("nav.backMap")}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (!level || level.id !== runtimeLevelId) {
    return (
      <main
        className="game-stage flex min-h-screen items-center justify-center text-white"
        aria-busy="true"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-3 px-6 text-center">
          <div
            className="h-12 w-12 animate-spin rounded-full border-4 border-amber-100/30 border-t-amber-100"
            aria-hidden="true"
          />
          <p className="font-black text-amber-50">{t("game.loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <ResolvedLevelGame
      key={`${contentVersion}:${runtimeLevelId}`}
      level={level}
      returnTo={safeReturnTo}
    />
  );
}

function ResolvedLevelGame({ level, returnTo }: ResolvedLevelGameProps) {
  const { language, t } = useLevelI18n();
  const activeProfile = useGameStore(selectActiveProfile);
  const activeProgress = useGameStore(selectActiveGameProgress);
  const activeProfileId = activeProfile.id;
  const { coins, levels: allLevelProgress, words: wordProgressById } = activeProgress;
  const hasHydrated = useGameStore((state) => state.hasHydrated);
  const isReadOnly = useGameStore(selectIsReadOnly);
  const beginActionSession = useGameStore((state) => state.beginActionSession);
  const endActionSession = useGameStore((state) => state.endActionSession);
  const savedProgress = activeProgress.levels[level.id];
  const submitWord = useGameStore((state) => state.submitWord);
  const setCurrentLevel = useGameStore((state) => state.setCurrentLevel);
  const restartLevelAttempt = useGameStore((state) => state.restartLevelAttempt);
  const toggleFavorite = useGameStore((state) => state.toggleFavorite);
  const updatePreferences = useGameStore((state) => state.updatePreferences);
  const useHint = useGameStore((state) => state.useHint);
  const confirmPronunciationHint = useGameStore(
    (state) => state.confirmPronunciationHint
  );
  const advanceTutorial = useGameStore((state) => state.advanceTutorial);
  const setTutorialCollapsed = useGameStore((state) => state.setTutorialCollapsed);
  const tutorial = activeProfile.tutorialProgress;
  const isTutorialLevel =
    tutorial.status === "in-progress" &&
    tutorial.tutorialLevelId === level.id;
  const requiresTutorialDetail = mustInspectTutorialWord(tutorial, level.id);
  const [attemptProgress, setAttemptProgress] = useState<LevelProgress>();
  const [sessionLevelId, setSessionLevelId] = useState(level.id);
  const [sessionProfileId, setSessionProfileId] = useState(activeProfileId);
  const sessionIsCurrent =
    sessionLevelId === level.id && sessionProfileId === activeProfileId;
  const progress = sessionIsCurrent
    ? getLevelScopedAttemptProgress(sessionLevelId, level.id, attemptProgress) ??
      savedProgress ??
      createEmptyLevelProgress()
    : savedProgress ?? createEmptyLevelProgress();
  const levelPosition = getLevelPosition(level);
  const levelTitle = t("level.displayTitle", {
    book: levelPosition.book,
    level: levelPosition.level ?? 1
  });
  const [crosswordDraft, setCrosswordDraft] = useState(() =>
    createEmptyCrosswordDraft(level.targetWords[0]?.id)
  );
  const [selectedWordId, setSelectedWordId] = useState<string | undefined>(
    level.targetWords[0]?.id
  );
  const [inspectedWordId, setInspectedWordId] = useState<string>();
  const [invalidDraftWordId, setInvalidDraftWordId] = useState<string>();
  const [tutorialExplanationDismissed, setTutorialExplanationDismissed] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>({
    id: 0,
    type: "neutral",
    title: t("game.ready")
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHinting, setIsHinting] = useState(false);
  const [recentWordId, setRecentWordId] = useState<string>();
  const [recentHintCellKey, setRecentHintCellKey] = useState<CellKey>();
  const feedbackIdRef = useRef(0);
  const submitLockedRef = useRef(false);
  const lastSubmittedSignatureRef = useRef<string | undefined>(undefined);
  const hintLockedRef = useRef(false);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechRequestTokenRef = useRef(0);
  const mountedRef = useRef(true);
  const currentLevelIdRef = useRef(`${activeProfileId}:${level.id}`);
  const actionSessionRef = useRef<ProfileActionContext | null>(null);
  const courseLevels = level.curriculumId
    ? getLevelsByCurriculumId(level.curriculumId)
    : getAllLevels();
  const isJumpAheadLevel = isLevelAheadOfEligibleRecommendation(
    courseLevels,
    level.id,
    allLevelProgress,
    activeProfile
  );
  const nextLevel = getNextEligibleLevel(courseLevels, level.id, activeProfile);
  const activeClue = resolveActiveClue(level, progress, selectedWordId);
  const effectiveDraft = reconcileCrosswordDraft(
    level,
    progress,
    crosswordDraft,
    activeClue?.id
  );
  const draftView = getCrosswordDraftView(
    level,
    progress,
    effectiveDraft,
    activeClue?.id
  );
  const activeSelectedIndexes = sessionIsCurrent
    ? draftView.selectedIndexes
    : [];
  const currentWord = sessionIsCurrent ? draftView.displayWord : "";
  const hintStage = {
    wordId: activeClue?.id ?? "",
    interactions: activeClue ? progress.hintStages[activeClue.id] ?? 0 : 0
  };
  const hintFirstCell = activeClue
    ? buildGrid(level)[getCellKey(activeClue.start.row, activeClue.start.col)]
    : undefined;
  const firstPositionVisible = hintFirstCell
    ? isCellVisible(hintFirstCell, progress)
    : false;
  const hintAction = activeClue
    ? getHintAction(hintStage, activeClue.id, firstPositionVisible)
    : undefined;
  const currentHintTargetIdRef = useRef<string | undefined>(undefined);
  currentLevelIdRef.current = `${activeProfileId}:${level.id}`;
  currentHintTargetIdRef.current = activeClue?.id;
  const safeText = (text: string) =>
    sanitizeLevelPresentationText(level, progress, text) ?? "";

  useEffect(() => {
    setCurrentLevel(level.id);
  }, [activeProfileId, level.id, setCurrentLevel]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    levelActionSessionSequence += 1;
    const context: ProfileActionContext = {
      profileId: activeProfileId,
      levelId: level.id,
      sessionId: `level:${activeProfileId}:${level.id}:${levelActionSessionSequence}`
    };
    actionSessionRef.current = context;
    beginActionSession(context);

    return () => {
      endActionSession(context);
      if (actionSessionRef.current === context) {
        actionSessionRef.current = null;
      }
    };
  }, [activeProfileId, beginActionSession, endActionSession, hasHydrated, level.id]);

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
    setSessionProfileId(activeProfileId);
    setCrosswordDraft(createEmptyCrosswordDraft(level.targetWords[0]?.id));
    setSelectedWordId(level.targetWords[0]?.id);
    setInspectedWordId(undefined);
    setInvalidDraftWordId(undefined);
    lastSubmittedSignatureRef.current = resetAutoSubmission();
    setRecentWordId(undefined);
    setRecentHintCellKey(undefined);
    speechRequestTokenRef.current += 1;
    setFeedback({ id: 0, type: "neutral", title: t("game.ready") });
    submitLockedRef.current = false;
    hintLockedRef.current = false;
    setIsSubmitting(false);
    setIsHinting(false);
  }, [activeProfileId, hasHydrated, level.id]);

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

  useEffect(() => {
    setTutorialExplanationDismissed(false);
  }, [tutorial.phase]);

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
      inspectedWordId !== undefined ||
      requiresTutorialDetail ||
      isReadOnly ||
      !sessionIsCurrent ||
      isSubmitting ||
      submitLockedRef.current ||
      activeSelectedIndexes.includes(index) ||
      !activeClue ||
      draftView.complete
    ) {
      return;
    }

    setInvalidDraftWordId(undefined);
    lastSubmittedSignatureRef.current = resetAutoSubmission();
    setCrosswordDraft((current) =>
      addCrosswordDraftLetter(
        level,
        progress,
        current,
        activeClue.id,
        level.letters[index] ?? "",
        index
      )
    );
  };

  const clearWord = () => {
    if (inspectedWordId || requiresTutorialDetail) return;
    setInvalidDraftWordId(undefined);
    lastSubmittedSignatureRef.current = resetAutoSubmission();
    setCrosswordDraft(createEmptyCrosswordDraft(activeClue?.id));
    showFeedback("neutral", t("game.ready"));
  };

  const backspace = () => {
    if (inspectedWordId || requiresTutorialDetail) return;
    setInvalidDraftWordId(undefined);
    lastSubmittedSignatureRef.current = resetAutoSubmission();
    setCrosswordDraft((current) =>
      removeLastCrosswordDraftLetter(
        level,
        progress,
        current,
        activeClue?.id
      )
    );
  };

  const selectClue = (wordId: string) => {
    if (progress.foundWords.includes(wordId)) {
      setInspectedWordId(wordId);
      if (isTutorialLevel && tutorial.phase === "first-word-detail") {
        advanceTutorial("first-word-detail", { firstWordDetailSeen: true });
      }
      return;
    }

    if (requiresTutorialDetail) return;

    setInspectedWordId(undefined);
    setInvalidDraftWordId(undefined);
    setSelectedWordId(wordId);
    setCrosswordDraft(createEmptyCrosswordDraft(wordId));
    const clueIndex = level.targetWords.findIndex((word) => word.id === wordId);
    showFeedback(
      "neutral",
      t("game.clue", { number: Math.max(0, clueIndex) + 1 })
    );
  };

  const validateCompletedDraft = () => {
    if (
      progress.completed ||
      inspectedWordId !== undefined ||
      requiresTutorialDetail ||
      isReadOnly ||
      !sessionIsCurrent ||
      isSubmitting ||
      submitLockedRef.current ||
      !draftView.complete ||
      !activeClue
    ) {
      return;
    }

    const submissionSignature = `${activeProfileId}:${level.id}:${activeClue.id}:${draftView.submission}`;
    const claim = claimAutoSubmission(
      lastSubmittedSignatureRef.current,
      submissionSignature
    );
    if (!claim.accepted) return;
    lastSubmittedSignatureRef.current = claim.lastSignature;

    lockSubmitBriefly();
    const submission = submitWord(
      level,
      draftView.submission,
      progress,
      activeClue.id
    );
    const result = submission.result;
    setAttemptProgress(submission.attemptProgress);

    if (result.status === "read-only") {
      showFeedback("duplicate", t("storage.unsupported"));
      return;
    }

    if (result.status === "correct") {
      speechRequestTokenRef.current += 1;
      setInvalidDraftWordId(undefined);
      setRecentWordId(result.word.id);
      const nextWord = level.targetWords.find(
        (word) => !submission.attemptProgress.foundWords.includes(word.id)
      );
      setSelectedWordId(nextWord?.id);
      setCrosswordDraft(createEmptyCrosswordDraft(nextWord?.id));
      showFeedback(
        "correct",
        t("game.wordFound"),
        isTutorialLevel && tutorial.phase === "game-ui"
          ? t("game.openGreenDetail")
          : t("game.gridFilled")
      );
      if (isTutorialLevel && tutorial.phase === "game-ui") {
        advanceTutorial("first-word-detail");
      }
      return;
    }

    if (result.status === "level-complete") {
      speechRequestTokenRef.current += 1;
      setInvalidDraftWordId(undefined);
      setRecentWordId(result.word.id);
      setSelectedWordId(undefined);
      setCrosswordDraft(createEmptyCrosswordDraft());
      const rewardMessage = result.reward === 0
        ? t("game.bestSaved")
        : result.bonusReward > 0
          ? t("game.rewardBonus", {
              base: result.baseReward,
              bonus: result.bonusReward
            })
          : t("game.rewardCoins", { count: result.reward });
      showFeedback(
        "complete",
        t("game.levelComplete"),
        `${t("game.everyWordFilled")} ${rewardMessage}`
      );
      return;
    }

    if (result.status === "already-found") {
      setCrosswordDraft(createEmptyCrosswordDraft(activeClue.id));
      showFeedback(
        "duplicate",
        t("game.alreadyFound"),
        t("game.alreadyBoard")
      );
      return;
    }

    // Keep the spelling in place so the learner can see and repair it. The
    // signature above suppresses resubmission until at least one letter changes.
    setInvalidDraftWordId(activeClue.id);
    showFeedback(
      "wrong",
      t("game.notPuzzle"),
      t("game.tryOrder")
    );
  };

  useEffect(() => {
    if (
      !draftView.complete ||
      !draftView.submission ||
      !activeClue ||
      inspectedWordId !== undefined ||
      requiresTutorialDetail ||
      isSubmitting ||
      progress.completed
    ) {
      return;
    }
    const task = window.setTimeout(validateCompletedDraft, 0);
    return () => window.clearTimeout(task);
  }, [
    activeClue?.id,
    draftView.complete,
    draftView.submission,
    inspectedWordId,
    isSubmitting,
    progress.completed,
    requiresTutorialDetail
  ]);

  const continueFromDetail = () => {
    setInspectedWordId(undefined);
    const nextWord = level.targetWords.find(
      (word) => !progress.foundWords.includes(word.id)
    );
    setSelectedWordId(nextWord?.id);
    setCrosswordDraft(createEmptyCrosswordDraft(nextWord?.id));
    setInvalidDraftWordId(undefined);
  };

  useEffect(() => {
    if (
      isTutorialLevel &&
      progress.completed &&
      tutorial.phase === "first-word-detail" &&
      tutorial.firstWordDetailSeen
    ) {
      advanceTutorial("level-complete", { levelCompleted: true });
    }
  }, [
    advanceTutorial,
    isTutorialLevel,
    progress.completed,
    tutorial.firstWordDetailSeen,
    tutorial.phase
  ]);

  const revealHint = () => {
    if (
      progress.completed ||
      inspectedWordId !== undefined ||
      requiresTutorialDetail ||
      isReadOnly ||
      !sessionIsCurrent ||
      isHinting ||
      hintLockedRef.current
    ) {
      return;
    }

    lockHintBriefly();
    if (!activeClue || !hintAction) {
      showFeedback("duplicate", t("game.noClue"), t("game.boardClear"));
      return;
    }

    if (hintAction === "pronunciation") {
      const vocabulary = activeClue.vocabularyWordId
        ? getRuntimeVocabularyWordById(activeClue.vocabularyWordId)
        : undefined;
      speechRequestTokenRef.current += 1;
      const request = {
        token: speechRequestTokenRef.current,
        scopeId: `${activeProfileId}:${level.id}`,
        itemId: activeClue.id
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
        const actionContext = actionSessionRef.current;
        if (settled || !requestIsCurrent() || !actionContext) {
          return;
        }
        settled = true;
        const pronunciation = confirmPronunciationHint(
          actionContext,
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
            t("game.pronunciationFallback"),
            `${vocabulary.phonetic}. ${t("game.pronunciationNext")}`
          );
          return;
        }
        settled = true;
        showFeedback(
          "duplicate",
          t("game.pronunciationUnavailable"),
          t("game.noClueCharged")
        );
      };
      speakEnglishWord(activeClue.word, undefined, {
        onStarted: () =>
          commitHint(
            t("game.pronunciationPlayed"),
            t("game.pronunciationNext")
          ),
        onFailed: showFallback
      });
      return;
    }

    const hintUsage = useHint(level, progress, activeClue.id);
    const result = hintUsage.result;
    setAttemptProgress(hintUsage.attemptProgress);

    if (result.status === "read-only") {
      showFeedback("duplicate", t("storage.unsupported"));
      return;
    }

    if (result.status === "revealed") {
      setRecentHintCellKey(result.cellKey);
      showFeedback(
        "hint",
        hintAction === "first-letter"
          ? t("game.firstRevealed", { letter: result.letter })
          : t("game.positionRevealed", { letter: result.letter }),
        t("game.hintStars")
      );
      return;
    }

    showFeedback("duplicate", t("game.noHidden"), t("game.boardClear"));
  };

  const replayLevel = () => {
    if (isReadOnly) return;
    const historicalProgress =
      selectActiveGameProgress(useGameStore.getState()).levels[level.id] ?? progress;
    setAttemptProgress(createReplayLevelProgress(historicalProgress));
    restartLevelAttempt(level.id);
    setCrosswordDraft(createEmptyCrosswordDraft(level.targetWords[0]?.id));
    setSelectedWordId(level.targetWords[0]?.id);
    setRecentWordId(undefined);
    setRecentHintCellKey(undefined);
    showFeedback("neutral", t("game.freshAttempt"), t("game.bestPreserved"));
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        progress.completed ||
        inspectedWordId !== undefined ||
        requiresTutorialDetail ||
        isReadOnly ||
        !sessionIsCurrent ||
        isSubmitting ||
        !activeClue ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        clearWord();
        return;
      }

      const letter = event.key.toUpperCase();
      if (!/^[A-Z]$/.test(letter)) {
        return;
      }

      const nextIndex = level.letters.findIndex(
        (candidate, index) =>
          candidate === letter && !activeSelectedIndexes.includes(index)
      );
      if (nextIndex >= 0) {
        event.preventDefault();
        chooseLetter(nextIndex);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeClue,
    isSubmitting,
    isReadOnly,
    inspectedWordId,
    requiresTutorialDetail,
    level.letters,
    progress.completed,
    activeSelectedIndexes,
    sessionIsCurrent
  ]);

  return (
    <main className="game-stage min-h-screen overflow-hidden text-white">
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-3 py-3 sm:px-5 sm:py-5 lg:px-8">
        <header className="flex items-start justify-between gap-3">
          <Link
            href={returnTo}
            className="game-icon-button focus-ring"
            aria-label={safeText(t("nav.backPrevious"))}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>

          <div className="flex min-w-0 flex-1 justify-center px-2">
            <div className="game-level-tag max-w-full">
              <Sparkles className="h-4 w-4 shrink-0 text-sun" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-xs font-black uppercase tracking-[0.08em] text-amber-100/75">
                  {safeText(t(getDifficultyTranslationKey(level.difficulty)))}
                </p>
                <h1 className="truncate text-sm font-black text-white sm:text-base">
                  {safeText(levelTitle)}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher inverse />
            <div className="game-coin-hud" aria-label={safeText(t("game.coinsLabel", { count: coins }))}>
              <Gem className="h-5 w-5 text-fuchsia-200" aria-hidden="true" />
              <span>{coins}</span>
            </div>
          </div>
        </header>

        {isTutorialLevel && !tutorial.collapsed && !tutorialExplanationDismissed ? (
          <div className="mt-3">
            <LazyTutorialPanel
              compact
              language={language}
              section={
                tutorial.phase !== "first-word-detail" && tutorial.phase !== "level-complete"
                  ? "game"
                  : tutorial.phase === "first-word-detail" && inspectedWordId
                    ? "detail"
                    : tutorial.phase === "first-word-detail"
                      ? "open-solved"
                      : "complete"
              }
              onPrimary={
                tutorial.phase === "game-ui"
                  ? () => setTutorialExplanationDismissed(true)
                  : undefined
              }
              laterHref={returnTo}
              onLater={() => setTutorialCollapsed(true)}
            />
          </div>
        ) : isTutorialLevel && tutorial.collapsed ? (
          <button
            type="button"
            onClick={() => setTutorialCollapsed(false)}
            className="focus-ring mt-3 w-full rounded-xl border-2 border-ink bg-sun p-4 text-left font-black text-ink shadow-crisp"
          >
            {t("tutorial.resumeFirstLevel")}
          </button>
        ) : null}

        <section className="grid flex-1 gap-2 py-2 sm:gap-3 sm:py-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start lg:gap-5 lg:py-5">
          <div className="order-2 flex min-h-full flex-col items-center justify-start gap-2 sm:gap-4 lg:order-1 lg:justify-center">
            <div className="flex w-full max-w-[760px] items-center justify-center">
              <CrosswordGrid
                level={level}
                progress={progress}
                title={levelTitle}
                activeWordId={activeClue?.id}
                draftLetters={draftView.cellLetters}
                recentHintCellKey={sessionIsCurrent ? recentHintCellKey : undefined}
                recentWordId={sessionIsCurrent ? recentWordId : undefined}
                invalidWordId={invalidDraftWordId}
                sanitizeText={safeText}
              />
            </div>

            <div className="grid w-full max-w-[760px] items-center gap-3 md:grid-cols-[92px_minmax(0,1fr)_92px]">
              <div className="order-2 flex justify-center gap-3 md:order-1 md:flex-col md:items-center">
                <button
                  type="button"
                  onClick={revealHint}
                  disabled={progress.completed || isReadOnly || !sessionIsCurrent || isHinting || inspectedWordId !== undefined || requiresTutorialDetail}
                  aria-disabled={progress.completed || isReadOnly || !sessionIsCurrent || isHinting || inspectedWordId !== undefined || requiresTutorialDetail}
                  className="game-orb-button focus-ring disabled:cursor-not-allowed disabled:opacity-45"
                  aria-label={safeText(
                    hintAction === "pronunciation"
                      ? t("game.playPronunciation")
                      : hintAction === "first-letter"
                        ? t("game.revealFirst")
                        : t("game.revealPosition")
                  )}
                >
                  <Lightbulb className="h-6 w-6" aria-hidden="true" />
                  <span>
                    {isHinting
                      ? "..."
                      : safeText(
                          hintAction === "pronunciation"
                            ? t("game.listen")
                            : hintAction === "first-letter"
                              ? t("game.letter")
                              : t("game.meanings")
                        )}
                  </span>
                </button>
              </div>

              <div className="order-1 md:order-2">
                <LetterWheel
                  letters={level.letters}
                  selectedIndexes={activeSelectedIndexes}
                  currentWord={currentWord}
                  disabled={progress.completed || isReadOnly || !sessionIsCurrent || isSubmitting || inspectedWordId !== undefined || requiresTutorialDetail}
                  readOnlyDetail={inspectedWordId !== undefined}
                  invalid={invalidDraftWordId !== undefined}
                  isSubmitting={isSubmitting}
                  onBackspace={backspace}
                  onChoose={chooseLetter}
                  onClear={clearWord}
                  sanitizeText={safeText}
                />
                <p className="mt-2 text-center text-xs font-bold text-amber-100/75">
                  {safeText(
                    activeProfile.ageBand === "7-9"
                      ? t("game.youngGuide")
                      : activeProfile.ageBand === "10-12"
                        ? t("game.middleGuide")
                        : t("game.teenGuide")
                  )}
                </p>
              </div>

              <div className="order-3 flex justify-center md:flex-col md:items-center">
                <div
                  className={[
                    "game-progress-medal",
                    progress.completed ? "game-progress-medal-complete" : ""
                  ].join(" ")}
                  aria-label={
                    progress.completed
                      ? safeText(t("game.levelComplete"))
                      : safeText(t("game.wordsFound", {
                          done: progress.foundWords.length,
                          total: level.targetWords.length
                        }))
                  }
                >
                  {progress.completed ? (
                    <Trophy className="h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Coins className="h-6 w-6" aria-hidden="true" />
                  )}
                  <span>{progress.completed ? safeText(t("common.clear")) : `${progress.foundWords.length}/${level.targetWords.length}`}</span>
                </div>
              </div>
            </div>

            {isJumpAheadLevel ? (
              <p className="rounded-full border border-amber-100/25 bg-black/30 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.12em] text-amber-100 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
                {safeText(t("level.advanced"))}
              </p>
            ) : null}
          </div>

          <aside className="order-1 w-full lg:order-2 lg:sticky lg:top-5">
            <div className="rounded-[1.5rem] border border-amber-100/15 bg-black/16 p-2.5 shadow-[0_20px_40px_rgba(0,0,0,0.26)] backdrop-blur-sm sm:p-4">
              <div className="mb-2 hidden items-start justify-between gap-3 lg:flex">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-200/80">
                    {safeText(t("game.meanings"))}
                  </p>
                  <h2 className="text-2xl font-black text-white">
                    {safeText(t("game.currentClue"))}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-amber-50/78">
                    {safeText(t("game.clueGuide"))}
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
                hintTargetId={activeClue?.id}
                activeWordId={inspectedWordId ?? activeClue?.id}
                clueLanguage={activeProfile.preferences.clueLanguage}
                wordProgressById={wordProgressById}
                onToggleClueLanguage={() =>
                  updatePreferences({
                    clueLanguage:
                      activeProfile.preferences.clueLanguage === "en"
                        ? "zh-CN"
                        : "en"
                  })
                }
                onToggleFavorite={toggleFavorite}
                onSelectWord={selectClue}
                onContinueFromDetail={continueFromDetail}
                mutationDisabled={isReadOnly}
              />
              {sessionIsCurrent && (feedback.id > 0 || progress.completed) ? (
                <div className="mt-3" data-testid="game-feedback-region">
                  <FeedbackBanner
                    key={progress.completed ? `complete-${feedback.id}` : feedback.id}
                    type={
                      progress.completed && feedback.type !== "complete"
                        ? "complete"
                        : feedback.type
                    }
                    title={
                      progress.completed && feedback.type !== "complete"
                        ? t("game.everyWordFilled")
                        : feedback.title
                    }
                    description={
                      progress.completed && feedback.type !== "complete"
                        ? t("game.levelComplete")
                        : feedback.description
                    }
                    sanitizeText={safeText}
                  />
                </div>
              ) : null}
              {progress.completed ? (
                <CompletionActions
                  stars={scoreLevelAttempt(progress)}
                  nextLevelId={nextLevel?.id}
                  returnTo={returnTo}
                  onReplay={replayLevel}
                  replayDisabled={isReadOnly}
                  onFinishTutorial={
                    isTutorialLevel && tutorial.phase === "level-complete"
                      ? () => advanceTutorial("completed", { levelCompleted: true })
                      : undefined
                  }
                />
              ) : null}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

const LazyTutorialPanel = dynamic(
  () => import("@/components/TutorialPanel").then((module) => module.TutorialPanel),
  {
    ssr: false,
    loading: () => <div className="min-h-36 rounded-xl border border-amber-100/20 bg-black/15" aria-hidden="true" />
  }
);
