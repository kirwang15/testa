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
};

const feedbackStyles: Record<FeedbackType, string> = {
  neutral: "border-ink bg-white text-ink",
  correct: "border-ink bg-leaf text-white animate-feedback-pop",
  wrong: "border-ink bg-coral text-white animate-feedback-shake",
  duplicate: "border-ink bg-sun text-ink animate-feedback-shake",
  hint: "border-ink bg-sun text-ink animate-feedback-pop",
  complete: "border-ink bg-mint text-white animate-level-complete"
};

const feedbackEyebrows: Record<FeedbackType, string> = {
  neutral: "Ready",
  correct: "Correct word",
  wrong: "Try again",
  duplicate: "Already found",
  hint: "Hint used",
  complete: "Level clear"
};

export function FeedbackBanner({
  type,
  title,
  description
}: FeedbackBannerProps) {
  return (
    <div
      className={[
        "w-full max-w-[560px] rounded-lg border-2 p-4 text-center shadow-crisp sm:p-5",
        type === "complete" ? "ring-4 ring-mint/15" : "",
        feedbackStyles[type]
      ].join(" ")}
      role={type === "neutral" ? "status" : "alert"}
      aria-live="polite"
    >
      <p className="text-xs font-black uppercase opacity-80">
        {feedbackEyebrows[type]}
      </p>
      <p className="mt-1 text-lg font-black sm:text-xl">{title}</p>
      {description ? (
        <p className="mt-1 text-sm font-bold opacity-90">{description}</p>
      ) : null}
    </div>
  );
}
