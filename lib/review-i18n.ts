import type { UiLanguage } from "@/types/game";

const reviewMessages = {
  en: {
    back: "Back to adventure",
    eyebrow: "Review challenge",
    title: "Listen and spell",
    description: "Use the clue first. The answer appears only after a correct spelling.",
    progress: "Review progress",
    remaining: "Remaining",
    spelling: "Spelling practice",
    correct: "Correct spelling",
    next: "Next clue",
    meaning: "Meaning",
    guessSound: "Use the pronunciation and clue",
    listen: "Listen",
    answerLabel: "Your spelling",
    answerPlaceholder: "Type the word",
    check: "Check spelling",
    emptyTitle: "No review due",
    emptyDescription: "Complete an adventure or use a clue, then review items will appear here.",
    completeTitle: "Review complete",
    completeDescription: "You finished every item currently due for extra practice.",
    wrong: "Almost there. Try again.",
    unknown: "This clue cannot be loaded. Return to the adventure and try again.",
    correctFeedback: "Correct! The answer is now visible.",
    playing: "Playing pronunciation...",
    played: "Pronunciation played. Spell it again.",
    fallback: "Pronunciation is unavailable, so a phonetic clue is shown.",
    noAudio: "This device cannot play pronunciation",
    noAudioOrPhonetic: "Pronunciation and phonetic help are unavailable. Continue from the clue.",
    loading: "Loading today’s review…",
    loadErrorTitle: "Review content unavailable",
    loadErrorDescription: "Today’s review couldn’t be loaded. Your schedule and progress haven’t changed.",
    retry: "Try loading reviews again",
    partialWarning: "{count} due item(s) are temporarily unavailable. Continue with the remaining review words.",
    partialRetry: "Retry skipped items",
    partialCompleteDescription: "Available review is complete. {count} skipped item(s) remain due and can be retried later.",
    restrictedSkipped: "{count} scheduled item(s) are hidden by this learner’s content access setting.",
    reviewAccess: "Review content access",
    recoverableSkipped: "{count} scheduled item(s) are temporarily unavailable."
  },
  "zh-CN": {
    back: "返回冒险",
    eyebrow: "复习挑战",
    title: "听一听，拼一拼",
    description: "先看提示，答对后才会显示答案。",
    progress: "复习进度",
    remaining: "待完成",
    spelling: "拼写练习",
    correct: "拼写正确",
    next: "下一题",
    meaning: "意思",
    guessSound: "结合发音和提示猜一猜",
    listen: "听发音",
    answerLabel: "你的拼写",
    answerPlaceholder: "输入单词",
    check: "检查拼写",
    emptyTitle: "暂时没有待复习内容",
    emptyDescription: "完成冒险或使用提示后，需要复习的内容会出现在这里。",
    completeTitle: "复习完成",
    completeDescription: "当前需要加练的内容都完成了。",
    wrong: "还差一点，再试一次。",
    unknown: "这道题暂时无法读取，请返回冒险后重试。",
    correctFeedback: "拼对了！答案现在可以看啦。",
    playing: "正在播放发音…",
    played: "发音已播放，再拼一次吧。",
    fallback: "发音不可用，已显示音标提示。",
    noAudio: "设备暂时无法播放发音",
    noAudioOrPhonetic: "发音和音标提示都不可用，请根据意思继续。",
    loading: "正在加载今天的复习…",
    loadErrorTitle: "复习内容暂时无法加载",
    loadErrorDescription: "暂时无法加载今天的复习，复习计划和学习进度没有变化。",
    retry: "重新加载复习",
    partialWarning: "有 {count} 个到期词暂时无法使用，请先完成其余复习。",
    partialRetry: "重试跳过的词",
    partialCompleteDescription: "可用的复习已完成，仍有 {count} 个跳过的到期词，可稍后重试。",
    restrictedSkipped: "有 {count} 个计划复习词因当前学习者的内容权限而隐藏。",
    reviewAccess: "查看内容权限",
    recoverableSkipped: "有 {count} 个计划复习词暂时无法使用。"
  }
} as const;

export type ReviewTranslationKey = keyof typeof reviewMessages.en;

export function translateReview(
  language: UiLanguage,
  key: ReviewTranslationKey,
  params: Record<string, string | number> = {}
) {
  return reviewMessages[language][key].replace(/\{(\w+)\}/g, (match, paramName) =>
    Object.prototype.hasOwnProperty.call(params, paramName)
      ? String(params[paramName])
      : match
  );
}
