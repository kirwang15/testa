"use client";

import { Pause, TimerReset } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadAssessmentBank,
  loadAssessmentState,
  nextAssessmentQuestion,
  saveAssessmentState,
  submitAssessmentAnswer,
  type AssessmentBank,
  type AssessmentQuestion,
  type AssessmentSession
} from "@/lib/web-assessment";
import { useAssessmentI18n } from "@/lib/assessment-i18n";
import { selectActiveProfile, useGameStore } from "@/store/gameStore";

export function WebAssessmentTest() {
  const t = useAssessmentI18n();
  const router = useRouter();
  const profile = useGameStore(selectActiveProfile);
  const [bank, setBank] = useState<AssessmentBank>();
  const [session, setSession] = useState<AssessmentSession>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [showPause, setShowPause] = useState(false);
  const [slow, setSlow] = useState(false);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    selected: boolean | number;
    correctAnswer: string;
  }>();
  const startedQuestionAt = useRef(Date.now());
  const submitting = useRef(false);
  const feedbackTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    loadAssessmentBank(controller.signal)
      .then((loaded) => {
        const active = loadAssessmentState(profile.id).active;
        if (!active || active.bankVersion !== loaded.bankVersion) {
          router.replace("/assessment");
          return;
        }
        setBank(loaded);
        setSession(active);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
    return () => controller.abort();
  }, [profile.id, router]);

  const question = useMemo<AssessmentQuestion | undefined>(() => {
    if (!bank || !session || session.phase === "complete") return undefined;
    return nextAssessmentQuestion(bank, session);
  }, [bank, session]);

  useEffect(() => {
    startedQuestionAt.current = Date.now();
    submitting.current = false;
    setFeedback(undefined);
    setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), 30_000);
    return () => window.clearTimeout(timer);
  }, [question?.questionId]);

  const answer = (input: {
    recognized?: boolean;
    selectedOptionIndex?: number;
    skipped?: boolean;
  }) => {
    if (!bank || !session || !question || locked || submitting.current) return;
    submitting.current = true;
    const step = submitAssessmentAnswer(bank, session, question, {
      ...input,
      responseTimeMs: Date.now() - startedQuestionAt.current
    });
    const advance = () => {
      const stored = loadAssessmentState(profile.id);
      if (step.session.phase === "complete") {
        saveAssessmentState(profile.id, {
          history: [step.session, ...stored.history].slice(0, 10)
        });
        router.replace("/assessment/result");
      } else {
        saveAssessmentState(profile.id, {
          active: step.session,
          history: stored.history
        });
        setSession(step.session);
        if (step.showCarefulWarning) {
          setLocked(true);
          window.setTimeout(() => setLocked(false), 2_000);
        }
      }
    };
    if (input.skipped) {
      advance();
      return;
    }
    const response = step.session.responses.at(-1)!;
    const correctAnswer = question.type === "yesNo"
      ? t(question.item.itemType === "pseudoword" ? "no" : "yes")
      : question.item.options[question.item.correctOptionIndex];
    setFeedback({
      correct: response.correct,
      selected: question.type === "yesNo"
        ? input.recognized === true
        : input.selectedOptionIndex ?? -1,
      correctAnswer
    });
    feedbackTimer.current = window.setTimeout(() => {
      advance();
    }, 850);
  };

  const yesNoClass = (recognized: boolean, base: string) => {
    if (!feedback) return base;
    const isCorrectAnswer = recognized === (question!.item.itemType === "realWord");
    if (isCorrectAnswer) {
      return `${base} border-emerald-700 bg-emerald-600 text-white ring-4 ring-emerald-200`;
    }
    if (feedback.selected === recognized) {
      return `${base} border-red-700 bg-red-600 text-white ring-4 ring-red-200`;
    }
    return `${base} opacity-45`;
  };

  const choiceClass = (index: number) => {
    const base = "focus-ring min-h-16 rounded-xl border-2 px-4 text-left text-sm font-black transition";
    if (!feedback) {
      return `${base} border-ink bg-paper text-ink hover:-translate-y-0.5 hover:bg-sun`;
    }
    if (index === question!.item.correctOptionIndex) {
      return `${base} border-emerald-700 bg-emerald-600 text-white ring-4 ring-emerald-200`;
    }
    if (feedback.selected === index) {
      return `${base} border-red-700 bg-red-600 text-white ring-4 ring-red-200`;
    }
    return `${base} border-ink/20 bg-paper text-ink opacity-45`;
  };

  if (status !== "ready" || !question || !session) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <p className="rounded-xl border-2 border-ink bg-white px-6 py-5 font-black shadow-crisp">
          {status === "error" ? t("unavailable") : t("loading")}
        </p>
      </main>
    );
  }

  const progress =
    session.responses.length < 10
      ? { width: "18%", label: t("progressStart") }
      : session.responses.length < 22
        ? { width: "55%", label: t("progressMiddle") }
        : { width: "90%", label: t("progressEnd") };

  return (
    <main className="assessment-stage min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="rounded-xl border border-white/20 bg-black/35 p-4 text-white backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.13em] text-sun">{t("beta")}</p>
              <p className="mt-1 text-sm font-bold text-white/65" aria-live="polite">{progress.label}</p>
            </div>
            <button
              type="button"
              disabled={submitting.current}
              onClick={() => setShowPause(true)}
              className="focus-ring grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
              aria-label={t("pause")}
            >
              <Pause className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
            <span className="block h-full rounded-full bg-sun transition-all duration-500" style={{ width: progress.width }} />
          </div>
        </header>

        <section className="rounded-2xl border-2 border-ink bg-white p-5 shadow-[8px_8px_0_#161616] sm:p-8">
          <p className="text-center text-sm font-black text-ink/55">
            {question.type === "yesNo" ? t("yesNoPrompt") : t("choicePrompt")}
          </p>
          <h1 className="mt-5 text-center text-4xl font-black lowercase tracking-[0.08em] text-ink sm:text-5xl">
            {question.item.spelling.toLocaleLowerCase("en")}
          </h1>

          {feedback ? (
            <p
              className={`mt-6 rounded-lg border-2 px-4 py-3 text-center text-sm font-black ${
                feedback.correct
                  ? "border-emerald-700 bg-emerald-50 text-emerald-800"
                  : "border-red-700 bg-red-50 text-red-800"
              }`}
              aria-live="assertive"
            >
              {feedback.correct
                ? t("correct")
                : t("wrong", { answer: feedback.correctAnswer })}
            </p>
          ) : null}

          {locked ? (
            <p className="mt-6 rounded-lg border-2 border-coral bg-red-50 px-4 py-3 text-center text-sm font-black text-coral" aria-live="assertive">
              {t("careful")}
            </p>
          ) : null}

          {question.type === "yesNo" ? (
            <div className="mt-8 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={locked || submitting.current}
                onClick={() => answer({ recognized: false })}
                className={yesNoClass(false, "focus-ring min-h-16 rounded-xl border-2 border-ink bg-paper px-4 text-lg font-black text-ink")}
              >
                {t("no")}
              </button>
              <button
                type="button"
                disabled={locked || submitting.current}
                onClick={() => answer({ recognized: true })}
                className={yesNoClass(true, "focus-ring min-h-16 rounded-xl border-2 border-ink bg-mint px-4 text-lg font-black text-white")}
              >
                {t("yes")}
              </button>
            </div>
          ) : (
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {question.item.options.map((option, index) => (
                <button
                  key={`${question.item.itemId}-${option}`}
                  type="button"
                  disabled={locked || submitting.current}
                  onClick={() => answer({ selectedOptionIndex: index })}
                  className={choiceClass(index)}
                >
                  <span className="mr-2 text-coral">{String.fromCharCode(65 + index)}</span>
                  {option}
                </button>
              ))}
            </div>
          )}

          <div className="mt-6 flex min-h-11 items-center justify-between gap-3">
            <p className={`flex items-center gap-2 text-xs font-bold text-ink/55 ${slow ? "visible" : "invisible"}`} aria-live="polite">
              <TimerReset className="h-4 w-4" aria-hidden="true" />
              {t("slow")}
            </p>
            <button
              type="button"
              disabled={locked || submitting.current}
              onClick={() => answer({ skipped: true })}
              className="focus-ring min-h-11 flex-none rounded-lg border-2 border-ink px-3 text-xs font-black text-ink disabled:opacity-40"
            >
              {t("skip")}
            </button>
          </div>
        </section>
      </div>

      {showPause ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 px-4" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <section className="w-full max-w-md rounded-xl border-2 border-ink bg-white p-6 shadow-crisp">
            <h2 id="pause-title" className="text-2xl font-black text-ink">{t("pauseTitle")}</h2>
            <p className="mt-2 font-semibold text-ink/65">{t("pauseBody")}</p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setShowPause(false)} className="focus-ring min-h-12 rounded-lg border-2 border-ink bg-sun font-black text-ink">
                {t("keepGoing")}
              </button>
              <button type="button" onClick={() => router.push("/")} className="focus-ring min-h-12 rounded-lg border-2 border-ink bg-paper font-black text-ink">
                {t("exit")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
