"use client";

import { useI18n } from "@/lib/use-i18n";

export type FeedbackType =
  | "neutral"
  | "correct"
  | "wrong"
  | "duplicate"
  | "hint"
  | "complete";

type FeedbackBannerProps = {
  type: FeedbackType;
  title: string;
  description?: string;
  sanitizeText?: (text: string) => string;
};

const feedbackStyles: Record<FeedbackType, string> = {
  neutral: "border-amber-100/25 bg-black/35 text-amber-50",
  correct: "border-emerald-200/45 bg-emerald-700/70 text-white animate-feedback-pop",
  wrong: "border-red-200/45 bg-red-700/75 text-white animate-feedback-shake",
  duplicate: "border-amber-200/50 bg-amber-500/85 text-[#2a1208] animate-feedback-shake",
  hint: "border-amber-200/50 bg-amber-500/85 text-[#2a1208] animate-feedback-pop",
  complete: "border-teal-100/45 bg-teal-600/80 text-white animate-level-complete"
};

export function FeedbackBanner({
  type,
  title,
  description,
  sanitizeText = (text) => text
}: FeedbackBannerProps) {
  const { t } = useI18n();
  const feedbackEyebrows: Record<FeedbackType, string> = {
    neutral: t("feedback.neutral"),
    correct: t("feedback.correct"),
    wrong: t("feedback.wrong"),
    duplicate: t("feedback.duplicate"),
    hint: t("feedback.hint"),
    complete: t("feedback.complete")
  };
  return (
    <div
      className={[
        "w-full max-w-[520px] rounded-full border px-5 py-2.5 text-center shadow-[0_16px_38px_rgba(0,0,0,0.28)] backdrop-blur-md",
        type === "complete" ? "ring-4 ring-teal-200/15" : "",
        feedbackStyles[type]
      ].join(" ")}
      role={type === "neutral" ? "status" : "alert"}
      aria-live="polite"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.14em] opacity-75">
        {sanitizeText(feedbackEyebrows[type])}
      </p>
      <p className="text-sm font-black sm:text-base">{sanitizeText(title)}</p>
      {description ? (
        <p className="text-xs font-bold opacity-85">{sanitizeText(description)}</p>
      ) : null}
    </div>
  );
}
