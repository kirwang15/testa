"use client";

import Link from "next/link";
import { CircleCheck, Languages, LoaderCircle, RefreshCcw } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getActiveCluePresentation } from "@/lib/clue-presentation";
import { sanitizePresentationTextForAnswers } from "@/lib/word-card-presentation";
import { speakEnglishWord } from "@/lib/speech";
import { isSpeechRequestCurrent } from "@/lib/speech-request";
import { curriculumContentVersion } from "@/lib/curriculum-index";
import { loadRuntimeVocabularyWord } from "@/lib/content-runtime";
import { partitionReviewWordsByAccess } from "@/lib/content-access";
import { loadReviewMetadataIndex } from "@/lib/review-metadata";
import {
  getDueReviewSnapshot,
  getLocalReviewDateKey,
  getReviewRuntimeStatus,
  loadReviewWordsUntilLimit,
  partitionLoadedReviewWords
} from "@/lib/review-queue";
import {
  selectActiveGameProgress,
  selectActiveProfile,
  selectIsReadOnly,
  useGameStore
} from "@/store/gameStore";
import { useLevelI18n } from "@/lib/level-i18n";
import { translateReview, type ReviewTranslationKey } from "@/lib/review-i18n";
import type {
  ProfileActionContext,
  ReviewMetadataIndex,
  RuntimeVocabularyWord
} from "@/types/game";

let reviewActionSessionSequence = 0;

export default function ReviewPage() {
  const { language, t } = useLevelI18n();
  const rt = (key: ReviewTranslationKey, params?: Record<string, string | number>) =>
    translateReview(language, key, params);
  const activeProgress = useGameStore(selectActiveGameProgress);
  const activeProfile = useGameStore(selectActiveProfile);
  const hasHydrated = useGameStore((state) => state.hasHydrated);
  const isReadOnly = useGameStore(selectIsReadOnly);
  const savedWords = activeProgress.words;
  const submitReviewWord = useGameStore((state) => state.submitReviewWord);
  const beginActionSession = useGameStore((state) => state.beginActionSession);
  const endActionSession = useGameStore((state) => state.endActionSession);
  const updatePreferences = useGameStore((state) => state.updatePreferences);
  const [attempt, setAttempt] = useState("");
  const [feedback, setFeedback] = useState("");
  const [answeredWord, setAnsweredWord] = useState<string>();
  const [speechFallback, setSpeechFallback] = useState("");
  const [runtimeWords, setRuntimeWords] = useState<Record<string, RuntimeVocabularyWord>>({});
  const [runtimeStatus, setRuntimeStatus] = useState<"loading" | "ready" | "error">("loading");
  const [quarantinedWordIds, setQuarantinedWordIds] = useState<string[]>([]);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [completedReview, setCompletedReview] = useState(false);
  const [reviewNow, setReviewNow] = useState(() => new Date());
  const [reviewMetadata, setReviewMetadata] = useState<ReviewMetadataIndex>();
  const [metadataStatus, setMetadataStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const speechRequestTokenRef = useRef(0);
  const mountedRef = useRef(true);
  const currentWordIdRef = useRef<string | undefined>(undefined);
  const actionSessionRef = useRef<ProfileActionContext | null>(null);
  const loadedAnyReviewRef = useRef(false);
  const quarantineProfileIdRef = useRef(activeProfile.id);
  const dueSnapshot = useMemo(
    () => reviewMetadata
      ? getDueReviewSnapshot(savedWords, activeProfile, reviewMetadata, reviewNow)
      : undefined,
    [activeProfile, reviewMetadata, reviewNow, savedWords]
  );
  const reviewCandidates = dueSnapshot?.available ?? [];
  const reviewLimit = dueSnapshot?.limit ?? 0;
  const prefilteredRestrictedReviewCount = dueSnapshot?.restricted.length ?? 0;
  const recoverableReviewCount = dueSnapshot?.recoverable.length ?? 0;
  const reviewCandidateKey = reviewCandidates.map((progress) => progress.wordId).join("\u0000");
  const reviewPartition = useMemo(
    () => partitionReviewWordsByAccess(
      partitionLoadedReviewWords(reviewCandidates, Object.values(runtimeWords)).available,
      activeProfile
    ),
    [activeProfile, reviewCandidates, runtimeWords]
  );
  const reviewWords = reviewPartition.available;
  const restrictedReviewCount =
    prefilteredRestrictedReviewCount + reviewPartition.restricted.length;
  const unavailableReviewCount =
    quarantinedWordIds.length + recoverableReviewCount;
  const remainingCount = runtimeStatus === "loading"
    ? Math.min(reviewCandidates.length, reviewLimit)
    : reviewWords.length;
  const unresolvedAnswers = reviewWords.map(({ word }) => word.word);
  const safeText = (text: string) =>
    sanitizePresentationTextForAnswers(text, unresolvedAnswers) ?? "";
  const current = reviewWords[0];
  currentWordIdRef.current = current?.word.id;
  const cluePresentation = current
    ? getActiveCluePresentation(
        activeProfile.preferences.clueLanguage,
        {
          english: current.word.englishMeaning,
          chinese: current.word.chineseMeaning
        },
        rt("guessSound"),
        current.word.source
      )
    : undefined;
  const spellingPracticeCount = runtimeStatus === "loading"
    ? reviewCandidates.filter((progress) => progress.reviewReasons?.includes("wrong")).length
    : reviewWords.filter(({ progress }) => progress.reviewReasons?.includes("wrong")).length;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      speechRequestTokenRef.current += 1;
    };
  }, []);

  useEffect(() => {
    let current = true;
    setMetadataStatus("loading");
    loadReviewMetadataIndex(curriculumContentVersion).then((metadata) => {
      if (!current) return;
      setReviewMetadata(metadata);
      setMetadataStatus(metadata ? "ready" : "error");
      if (!metadata) setRuntimeStatus("error");
    });
    return () => {
      current = false;
    };
  }, [loadAttempt]);

  useEffect(() => {
    const refreshNow = () => setReviewNow(new Date());
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshNow();
    };
    let dateKey = getLocalReviewDateKey(reviewNow);
    const interval = window.setInterval(() => {
      const next = new Date();
      const nextKey = getLocalReviewDateKey(next);
      if (nextKey !== dateKey) {
        dateKey = nextKey;
        setReviewNow(next);
      }
    }, 60_000);
    window.addEventListener("focus", refreshNow);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshNow);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [getLocalReviewDateKey(reviewNow)]);

  useEffect(() => {
    let current = true;
    if (metadataStatus !== "ready") {
      setRuntimeWords({});
      setRuntimeStatus(metadataStatus === "error" ? "error" : "loading");
      return () => {
        current = false;
      };
    }
    if (reviewCandidates.length === 0) {
      setRuntimeWords({});
      setRuntimeStatus("ready");
      return () => {
        current = false;
      };
    }

    const candidateIds = reviewCandidates.map((progress) => progress.wordId);
    const profileChanged = quarantineProfileIdRef.current !== activeProfile.id;
    if (profileChanged) {
      quarantineProfileIdRef.current = activeProfile.id;
      setQuarantinedWordIds([]);
    }
    const quarantined = new Set(profileChanged ? [] : quarantinedWordIds);
    const candidatesToLoad = reviewCandidates.filter(
      (progress) => !quarantined.has(progress.wordId)
    );
    if (candidatesToLoad.length === 0) {
      setRuntimeWords({});
      setRuntimeStatus(getReviewRuntimeStatus(0, loadedAnyReviewRef.current));
      return () => {
        current = false;
      };
    }

    setRuntimeStatus("loading");
    loadReviewWordsUntilLimit(
      candidatesToLoad,
      reviewLimit,
      (progress) =>
        loadRuntimeVocabularyWord(progress.wordId, curriculumContentVersion)
    ).then((result) => {
      if (!current) return;
      setRuntimeWords(
        Object.fromEntries(result.available.map(({ word }) => [word.id, word]))
      );
      setQuarantinedWordIds((existing) =>
        Array.from(new Set([
          ...existing.filter((wordId) => candidateIds.includes(wordId)),
          ...result.missingWordIds
        ]))
      );
      if (result.available.length > 0) loadedAnyReviewRef.current = true;
      setRuntimeStatus(
        getReviewRuntimeStatus(result.available.length, loadedAnyReviewRef.current)
      );
    }).catch(() => {
      if (!current) return;
      setQuarantinedWordIds((existing) =>
        Array.from(new Set([
          ...existing,
          ...candidatesToLoad.map((progress) => progress.wordId)
        ]))
      );
      setRuntimeStatus(getReviewRuntimeStatus(0, loadedAnyReviewRef.current));
    });
    return () => {
      current = false;
    };
  }, [activeProfile.id, loadAttempt, metadataStatus, reviewCandidateKey, reviewLimit]);

  useEffect(() => {
    speechRequestTokenRef.current += 1;
    setAttempt("");
    setFeedback("");
    setAnsweredWord(undefined);
    setSpeechFallback("");
    setRuntimeWords({});
    setQuarantinedWordIds([]);
    loadedAnyReviewRef.current = false;
    setCompletedReview(false);
  }, [activeProfile.id]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    reviewActionSessionSequence += 1;
    const context: ProfileActionContext = {
      profileId: activeProfile.id,
      sessionId: `review:${activeProfile.id}:${reviewActionSessionSequence}`
    };
    actionSessionRef.current = context;
    beginActionSession(context);

    return () => {
      endActionSession(context);
      if (actionSessionRef.current === context) {
        actionSessionRef.current = null;
      }
    };
  }, [activeProfile.id, beginActionSession, endActionSession, hasHydrated]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isReadOnly) return;
    const actionContext = actionSessionRef.current;
    if (!current || !attempt.trim() || !actionContext) {
      return;
    }

    speechRequestTokenRef.current += 1;
    const result = submitReviewWord(actionContext, current.word.id, attempt);
    if (result === "stale") {
      return;
    }
    if (result === "wrong") {
      setFeedback(rt("wrong"));
      return;
    }
    if (result === "unknown-word") {
      setFeedback(rt("unknown"));
      return;
    }

    setAnsweredWord(current.word.displayText);
    setCompletedReview(true);
    setAttempt("");
    setFeedback(rt("correctFeedback"));
    setSpeechFallback("");
  };

  const playPronunciation = () => {
    if (!current) {
      return;
    }

    speechRequestTokenRef.current += 1;
    const request = {
      token: speechRequestTokenRef.current,
      scopeId: `${activeProfile.id}:review`,
      itemId: current.word.id
    };
    let settled = false;
    const requestIsCurrent = () =>
      isSpeechRequestCurrent(
        request,
        speechRequestTokenRef.current,
        `${activeProfile.id}:review`,
        currentWordIdRef.current,
        mountedRef.current
      );
    const settle = (callback: () => void) => {
      if (settled || !requestIsCurrent()) {
        return;
      }
      settled = true;
      callback();
    };
    setSpeechFallback("");
    setFeedback(rt("playing"));
    speakEnglishWord(current.word.word, undefined, {
      onStarted: () =>
        settle(() => {
          setSpeechFallback("");
          setFeedback(rt("played"));
        }),
      onFailed: () =>
        settle(() => {
          if (current.word.phonetic) {
            setSpeechFallback(current.word.phonetic);
            setFeedback(rt("fallback"));
          } else {
            setSpeechFallback(rt("noAudio"));
            setFeedback(rt("noAudioOrPhonetic"));
          }
        })
    });
  };

  const nextClue = () => {
    speechRequestTokenRef.current += 1;
    setAnsweredWord(undefined);
    setAttempt("");
    setFeedback("");
    setSpeechFallback("");
  };

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="focus-ring inline-flex min-h-11 items-center rounded-lg border-2 border-ink bg-white px-4 py-2 text-sm font-black text-ink"
          >
            {safeText(rt("back"))}
          </Link>
          <LanguageSwitcher />
        </div>

        <header className="mt-5 rounded-lg border-2 border-ink bg-white p-5 shadow-crisp">
          <p className="text-sm font-black uppercase text-coral">
            {safeText(rt("eyebrow"))}
          </p>
          <h1 className="mt-1 text-3xl font-black text-ink">
            {safeText(rt("title"))}
          </h1>
          <p className="mt-2 font-semibold text-ink/70">
            {safeText(rt("description"))}
          </p>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-3" aria-label={safeText(rt("progress"))}>
          <div className="rounded-lg border-2 border-ink bg-paper p-4 shadow-crisp">
            <p className="text-xs font-black uppercase text-coral">
              {safeText(rt("remaining"))}
            </p>
            <p className="mt-1 text-3xl font-black text-ink">{remainingCount}</p>
          </div>
          <div className="rounded-lg border-2 border-ink bg-paper p-4 shadow-crisp">
            <p className="text-xs font-black uppercase text-leaf">
              {safeText(rt("spelling"))}
            </p>
            <p className="mt-1 text-3xl font-black text-ink">{spellingPracticeCount}</p>
          </div>
        </section>

        {runtimeStatus === "ready" && quarantinedWordIds.length > 0 ? (
          <section className="mt-5 rounded-lg border-2 border-amber-800 bg-amber-50 p-4 text-amber-950 shadow-crisp" role="status">
            <p className="font-black">
              {rt("partialWarning", { count: quarantinedWordIds.length })}
            </p>
            <button
              type="button"
              onClick={() => {
                setQuarantinedWordIds([]);
                setLoadAttempt((attemptNumber) => attemptNumber + 1);
              }}
              className="focus-ring mt-3 min-h-11 rounded-lg border-2 border-amber-900 bg-white px-4 py-2 text-sm font-black"
            >
              {rt("partialRetry")}
            </button>
          </section>
        ) : null}

        {runtimeStatus === "ready" && restrictedReviewCount > 0 ? (
          <section
            className="mt-5 rounded-lg border-2 border-indigo-800 bg-indigo-50 p-4 text-indigo-950 shadow-crisp"
            role="status"
          >
            <p className="font-black">
              {rt("restrictedSkipped", { count: restrictedReviewCount })}
            </p>
            <Link
              href="/parent"
              className="focus-ring mt-3 inline-flex min-h-11 items-center rounded-lg border-2 border-indigo-900 bg-white px-4 py-2 text-sm font-black"
            >
              {rt("reviewAccess")}
            </Link>
          </section>
        ) : null}

        {runtimeStatus === "ready" && recoverableReviewCount > 0 ? (
          <section
            className="mt-5 rounded-lg border-2 border-slate-700 bg-slate-50 p-4 text-slate-900 shadow-crisp"
            role="status"
          >
            <p className="font-black">
              {rt("recoverableSkipped", { count: recoverableReviewCount })}
            </p>
          </section>
        ) : null}

        {answeredWord ? (
          <section className="mt-5 rounded-lg border-2 border-emerald-800 bg-emerald-100 p-6 text-center shadow-crisp" aria-live="polite">
            <p className="text-sm font-black text-emerald-900">{rt("correct")}</p>
            <p className="mt-2 text-4xl font-black tracking-wider text-emerald-950">
              {answeredWord}
            </p>
            <button
              type="button"
              onClick={nextClue}
              className="focus-ring mt-5 min-h-12 rounded-lg border-2 border-ink bg-mint px-6 py-3 font-black text-white shadow-crisp"
            >
              {rt("next")}
            </button>
          </section>
        ) : runtimeStatus === "loading" ? (
          <section
            className="mt-5 rounded-lg border-2 border-ink bg-white p-6 text-center shadow-crisp"
            aria-live="polite"
            aria-busy="true"
          >
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-mint" aria-hidden="true" />
            <p className="mt-3 font-black text-ink">{rt("loading")}</p>
          </section>
        ) : runtimeStatus === "error" ? (
          <section
            className="mt-5 rounded-lg border-2 border-coral bg-white p-6 text-center shadow-crisp"
            role="alert"
          >
            <h2 className="text-2xl font-black text-ink">{rt("loadErrorTitle")}</h2>
            <p className="mt-2 font-semibold text-ink/70">{rt("loadErrorDescription")}</p>
            <button
              type="button"
              onClick={() => {
                setQuarantinedWordIds([]);
                setLoadAttempt((attemptNumber) => attemptNumber + 1);
              }}
              className="focus-ring mt-5 inline-flex min-h-12 items-center gap-2 rounded-lg border-2 border-ink bg-coral px-5 py-3 font-black text-white shadow-crisp"
            >
              <RefreshCcw className="h-5 w-5" aria-hidden="true" />
              {rt("retry")}
            </button>
          </section>
        ) : current ? (
          <section className="mt-5 rounded-lg border-2 border-ink bg-paper p-5 shadow-crisp">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-coral">
                  {safeText(t("game.clue", { number: 1 }))}
                </p>
                <p className="mt-1 text-sm font-bold text-ink/70">
                  {safeText(
                    current.progress.reviewReasons?.includes("wrong")
                      ? rt("spelling")
                      : t("game.meanings")
                  )}
                </p>
              </div>
              <span className="rounded-full border-2 border-ink bg-white px-3 py-2 text-sm font-black text-ink">
                {t("common.letters", { count: current.word.word.length })}
              </span>
            </div>

            <div className="mt-5 rounded-lg border-2 border-ink/20 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-ink/60">{rt("meaning")}</p>
                <button
                  type="button"
                  disabled={isReadOnly}
                  onClick={() =>
                    updatePreferences({
                      clueLanguage:
                        activeProfile.preferences.clueLanguage === "en"
                          ? "zh-CN"
                          : "en"
                    })
                  }
                  className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-ink px-3 py-2 text-xs font-black text-ink"
                  aria-label={
                    activeProfile.preferences.clueLanguage === "en"
                      ? t("language.showChineseClue")
                      : t("language.showEnglishClue")
                  }
                >
                  <Languages className="h-4 w-4" aria-hidden="true" />
                  {activeProfile.preferences.clueLanguage === "en"
                    ? t("language.clueEnglish")
                    : t("language.clueChinese")}
                </button>
              </div>
              <p className="mt-1 text-lg font-bold text-ink">
                {safeText(cluePresentation?.text ?? rt("guessSound"))}
              </p>
              {current.word.source ? (
                <p className="mt-2 text-xs font-bold text-ink/55">
                  {safeText(
                    current.word.source.type === "ielts"
                      ? t("game.sourceIelts", {
                          list: current.word.source.listId,
                          rank: current.word.source.rank
                        })
                      : current.word.source.type === "kaoyan"
                        ? t("game.sourceKaoyan", {
                            list: current.word.source.listId,
                            rank: current.word.source.rank
                          })
                        : t("game.source", {
                            book: current.word.source.book,
                            lesson: current.word.source.lesson
                          })
                  )}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={playPronunciation}
              className="focus-ring mt-4 min-h-12 w-full rounded-lg border-2 border-ink bg-white px-5 py-3 font-black text-ink"
            >
              {rt("listen")}
            </button>
            {speechFallback ? (
              <p className="mt-2 rounded-lg bg-white px-4 py-3 text-center font-bold text-ink" aria-live="polite">
                {speechFallback}
              </p>
            ) : null}

            <form className="mt-4" onSubmit={submit}>
              <label htmlFor="review-answer" className="text-sm font-black text-ink">
                {safeText(rt("answerLabel"))}
              </label>
              <input
                id="review-answer"
                type="text"
                disabled={isReadOnly}
                value={attempt}
                onChange={(event) => setAttempt(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder={safeText(rt("answerPlaceholder"))}
                className="focus-ring mt-2 min-h-12 w-full rounded-lg border-2 border-ink bg-white px-4 py-3 text-lg font-black uppercase tracking-wider text-ink"
              />
              <button
                type="submit"
                disabled={isReadOnly || !attempt.trim()}
                className="focus-ring mt-3 min-h-12 w-full rounded-lg border-2 border-ink bg-coral px-5 py-3 font-black text-white shadow-crisp disabled:cursor-not-allowed disabled:opacity-50"
              >
                {rt("check")}
              </button>
            </form>
            <p className="mt-3 min-h-11 rounded-lg px-3 py-2 font-bold text-ink" aria-live="polite">
              {feedback}
            </p>
          </section>
        ) : (
          <section className="mt-5 rounded-lg border-2 border-ink bg-white p-6 text-center shadow-crisp" aria-live="polite">
            <CircleCheck className="mx-auto h-10 w-10 text-leaf" aria-hidden="true" />
            <h2 className="mt-2 text-2xl font-black text-ink">
              {completedReview ? rt("completeTitle") : rt("emptyTitle")}
            </h2>
            <p className="mt-2 font-semibold text-ink/70">
              {completedReview
                ? unavailableReviewCount > 0
                  ? rt("partialCompleteDescription", {
                      count: unavailableReviewCount
                    })
                  : rt("completeDescription")
                : recoverableReviewCount > 0
                  ? rt("recoverableSkipped", {
                      count: recoverableReviewCount
                    })
                  : restrictedReviewCount > 0
                    ? rt("restrictedSkipped", {
                        count: restrictedReviewCount
                      })
                    : rt("emptyDescription")}
            </p>
            <Link
              href="/"
              className="focus-ring mt-5 inline-flex min-h-12 items-center rounded-lg border-2 border-ink bg-mint px-6 py-3 font-black text-white shadow-crisp"
            >
              {rt("back")}
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
