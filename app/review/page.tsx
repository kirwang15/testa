"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getReviewReasonSummary } from "@/lib/progress";
import { sanitizePresentationTextForAnswers } from "@/lib/word-card-presentation";
import { speakEnglishWord } from "@/lib/speech";
import { isSpeechRequestCurrent } from "@/lib/speech-request";
import { getReviewableDifficultWords } from "@/src/lib/learning-engine";
import { getWordById } from "@/src/lib/vocabulary-loader";
import { useGameStore } from "@/store/gameStore";

export default function ReviewPage() {
  const savedWords = useGameStore((state) => state.words);
  const submitReviewWord = useGameStore((state) => state.submitReviewWord);
  const [attempt, setAttempt] = useState("");
  const [feedback, setFeedback] = useState("");
  const [answeredWord, setAnsweredWord] = useState<string>();
  const [speechFallback, setSpeechFallback] = useState("");
  const speechRequestTokenRef = useRef(0);
  const mountedRef = useRef(true);
  const currentWordIdRef = useRef<string | undefined>(undefined);
  const reviewWords = useMemo(
    () =>
      getReviewableDifficultWords(savedWords)
        .map((progress) => ({ progress, word: getWordById(progress.wordId) }))
        .filter(
          (item): item is typeof item & { word: NonNullable<typeof item.word> } =>
            Boolean(item.word)
        ),
    [savedWords]
  );
  const unresolvedAnswers = reviewWords.map(({ word }) => word.word);
  const safeText = (text: string) =>
    sanitizePresentationTextForAnswers(text, unresolvedAnswers) ?? "";
  const current = reviewWords[0];
  currentWordIdRef.current = current?.word.id;
  const spellingPracticeCount = reviewWords.filter(({ progress }) =>
    progress.reviewReasons?.includes("wrong")
  ).length;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      speechRequestTokenRef.current += 1;
    };
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!current || !attempt.trim()) {
      return;
    }

    speechRequestTokenRef.current += 1;
    const result = submitReviewWord(current.word.id, attempt);
    if (result === "wrong") {
      setFeedback("还差一点，再试一次。");
      return;
    }
    if (result === "unknown-word") {
      setFeedback("这道题暂时无法读取，请返回冒险后重试。");
      return;
    }

    setAnsweredWord(current.word.displayText);
    setAttempt("");
    setFeedback("拼对了！答案现在可以看啦。");
    setSpeechFallback("");
  };

  const playPronunciation = () => {
    if (!current) {
      return;
    }

    speechRequestTokenRef.current += 1;
    const request = {
      token: speechRequestTokenRef.current,
      scopeId: "review",
      itemId: current.word.id
    };
    let settled = false;
    const requestIsCurrent = () =>
      isSpeechRequestCurrent(
        request,
        speechRequestTokenRef.current,
        "review",
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
    setFeedback("正在播放发音…");
    speakEnglishWord(current.word.word, undefined, {
      onStarted: () =>
        settle(() => {
          setSpeechFallback("");
          setFeedback("发音已播放，再拼一次吧。");
        }),
      onFailed: () =>
        settle(() => {
          if (current.word.phonetic) {
            setSpeechFallback(current.word.phonetic);
            setFeedback("发音不可用，已显示发音提示。");
          } else {
            setSpeechFallback("设备暂时无法播放发音");
            setFeedback("发音和发音提示都不可用，请根据意思继续。");
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
        <Link
          href="/"
          className="focus-ring inline-flex min-h-11 items-center rounded-lg border-2 border-ink bg-white px-4 py-2 text-sm font-black text-ink"
        >
          {safeText("返回冒险")}
        </Link>

        <header className="mt-5 rounded-lg border-2 border-ink bg-white p-5 shadow-crisp">
          <p className="text-sm font-black uppercase text-coral">
            {safeText("Review challenge")}
          </p>
          <h1 className="mt-1 text-3xl font-black text-ink">
            {safeText("听一听，拼一拼")}
          </h1>
          <p className="mt-2 font-semibold text-ink/70">
            {safeText("先看提示，答对后才会揭晓答案。")}
          </p>
        </header>

        <section className="mt-5 grid grid-cols-2 gap-3" aria-label={safeText("复习进度")}>
          <div className="rounded-lg border-2 border-ink bg-paper p-4 shadow-crisp">
            <p className="text-xs font-black uppercase text-coral">
              {safeText("待完成")}
            </p>
            <p className="mt-1 text-3xl font-black text-ink">{reviewWords.length}</p>
          </div>
          <div className="rounded-lg border-2 border-ink bg-paper p-4 shadow-crisp">
            <p className="text-xs font-black uppercase text-leaf">
              {safeText("拼写练习")}
            </p>
            <p className="mt-1 text-3xl font-black text-ink">{spellingPracticeCount}</p>
          </div>
        </section>

        {answeredWord ? (
          <section className="mt-5 rounded-lg border-2 border-emerald-800 bg-emerald-100 p-6 text-center shadow-crisp" aria-live="polite">
            <p className="text-sm font-black text-emerald-900">拼写正确</p>
            <p className="mt-2 text-4xl font-black tracking-wider text-emerald-950">
              {answeredWord}
            </p>
            <button
              type="button"
              onClick={nextClue}
              className="focus-ring mt-5 min-h-12 rounded-lg border-2 border-ink bg-mint px-6 py-3 font-black text-white shadow-crisp"
            >
              下一题
            </button>
          </section>
        ) : current ? (
          <section className="mt-5 rounded-lg border-2 border-ink bg-paper p-5 shadow-crisp">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-coral">
                  {safeText("Clue 1")}
                </p>
                <p className="mt-1 text-sm font-bold text-ink/70">
                  {safeText(getReviewReasonSummary(current.progress))}
                </p>
              </div>
              <span className="rounded-full border-2 border-ink bg-white px-3 py-2 text-sm font-black text-ink">
                {current.word.word.length} 个字母
              </span>
            </div>

            <div className="mt-5 rounded-lg border-2 border-ink/20 bg-white p-4">
              <p className="text-sm font-black text-ink/60">意思</p>
              <p className="mt-1 text-lg font-bold text-ink">
                {safeText(
                  current.word.chineseMeaning ??
                    current.word.englishMeaning ??
                    "根据发音猜一猜"
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={playPronunciation}
              className="focus-ring mt-4 min-h-12 w-full rounded-lg border-2 border-ink bg-white px-5 py-3 font-black text-ink"
            >
              听发音
            </button>
            {speechFallback ? (
              <p className="mt-2 rounded-lg bg-white px-4 py-3 text-center font-bold text-ink" aria-live="polite">
                {speechFallback}
              </p>
            ) : null}

            <form className="mt-4" onSubmit={submit}>
              <label htmlFor="review-answer" className="text-sm font-black text-ink">
                {safeText("输入拼写")}
              </label>
              <input
                id="review-answer"
                type="text"
                value={attempt}
                onChange={(event) => setAttempt(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="focus-ring mt-2 min-h-12 w-full rounded-lg border-2 border-ink bg-white px-4 py-3 text-lg font-black uppercase tracking-wider text-ink"
              />
              <button
                type="submit"
                disabled={!attempt.trim()}
                className="focus-ring mt-3 min-h-12 w-full rounded-lg border-2 border-ink bg-coral px-5 py-3 font-black text-white shadow-crisp disabled:cursor-not-allowed disabled:opacity-50"
              >
                检查拼写
              </button>
            </form>
            <p className="mt-3 min-h-11 rounded-lg px-3 py-2 font-bold text-ink" aria-live="polite">
              {feedback}
            </p>
          </section>
        ) : (
          <section className="mt-5 rounded-lg border-2 border-ink bg-white p-6 text-center shadow-crisp" aria-live="polite">
            <p className="text-3xl" aria-hidden="true">🎉</p>
            <h2 className="mt-2 text-2xl font-black text-ink">复习完成</h2>
            <p className="mt-2 font-semibold text-ink/70">当前需要加练的内容都完成了。</p>
            <Link
              href="/"
              className="focus-ring mt-5 inline-flex min-h-12 items-center rounded-lg border-2 border-ink bg-mint px-6 py-3 font-black text-white shadow-crisp"
            >
              返回冒险
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
