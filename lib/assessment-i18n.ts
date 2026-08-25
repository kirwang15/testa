"use client";

import { useCallback } from "react";
import { useI18n } from "./use-i18n";

const messages = {
  en: {
    beta: "Vocabulary estimate Beta",
    introTitle: "Find your written vocabulary range",
    introBody: "Choose a study stage as the starting reference. It will not limit the final estimate.",
    private: "Runs only in this browser · Answers are not uploaded",
    chooseAnchor: "Choose your current stage",
    "anchor.primarySchool": "Primary school",
    "anchor.middleSchool": "Middle school",
    "anchor.highSchool": "High school",
    "anchor.kaoyan": "Kaoyan",
    "anchor.ielts": "IELTS",
    "anchor.toefl": "TOEFL",
    "anchor.unrestricted": "Any range",
    start: "Start estimate",
    resume: "Resume unfinished test",
    note: "This estimates receptive written vocabulary. It is not an exam score or a measure of overall English ability.",
    progressStart: "Getting started",
    progressMiddle: "About halfway",
    progressEnd: "Almost finished",
    yesNoPrompt: "Do you recognize this word?",
    choicePrompt: "Which meaning fits this word best?",
    no: "Not sure",
    yes: "I know it",
    skip: "Skip this item",
    slow: "Go with your first impression, or skip this item.",
    careful: "Please answer carefully. Options will unlock in 2 seconds.",
    pause: "Pause test",
    pauseTitle: "Pause this test?",
    pauseBody: "Your current question will be saved in this browser.",
    keepGoing: "Keep going",
    exit: "Save and leave",
    loading: "Loading the offline question bank…",
    unavailable: "The offline question bank could not be loaded.",
    resultTitle: "Your vocabulary range",
    rangeHeadline: "Estimated vocabulary: {lower}–{upper} words",
    estimate: "About {estimate} words",
    range: "95% interval: {lower}–{upper}",
    "reliability.good": "Stable result",
    "reliability.caution": "Use this result with caution",
    "reliability.invalid": "This result is not stable",
    invalidBody: "This range is still shown for reference, but the response pattern was inconsistent. Retake the test for a more reliable result.",
    profile: "Vocabulary coverage",
    basic: "Basic high-frequency",
    advanced: "Advanced / academic",
    target: "Selected-stage reference",
    lowFrequency: "Low-frequency coverage",
    savePoster: "Save result poster",
    posterSaved: "Poster downloaded",
    retest: "Retake test",
    backHome: "Return home",
    posterQuote: "Learning has no shortcut. Progress comes from daily practice."
  },
  "zh-CN": {
    beta: "词汇量快速估算 Beta",
    introTitle: "看看你的书面词汇范围",
    introBody: "选择当前学习阶段作为起始参考，不会限制最终估算范围。",
    private: "全程只在当前浏览器运行 · 答案不会上传",
    chooseAnchor: "选择当前阶段",
    "anchor.primarySchool": "小学",
    "anchor.middleSchool": "初中",
    "anchor.highSchool": "高中",
    "anchor.kaoyan": "考研",
    "anchor.ielts": "雅思",
    "anchor.toefl": "托福",
    "anchor.unrestricted": "不限定范围",
    start: "开始估算",
    resume: "继续未完成测试",
    note: "本功能估算书面接受性词汇量，不代表考试成绩或综合英语能力。",
    progressStart: "正在开始",
    progressMiddle: "接近一半",
    progressEnd: "接近完成",
    yesNoPrompt: "你认识这个词吗？",
    choicePrompt: "下面哪个释义最符合这个词？",
    no: "不确定",
    yes: "认识",
    skip: "跳过本题",
    slow: "凭第一感觉作答，或者跳过本题。",
    careful: "请认真作答，选项将在 2 秒后恢复。",
    pause: "暂停测试",
    pauseTitle: "暂停本次测试吗？",
    pauseBody: "当前题目会保存在这个浏览器中。",
    keepGoing: "继续作答",
    exit: "保存并退出",
    loading: "正在加载离线题库…",
    unavailable: "无法加载离线题库。",
    resultTitle: "你的词汇量范围",
    rangeHeadline: "估算词汇量：{lower}–{upper} 词",
    estimate: "约 {estimate} 词",
    range: "95% 区间：{lower}–{upper}",
    "reliability.good": "结果稳定",
    "reliability.caution": "本次结果需谨慎参考",
    "reliability.invalid": "本次结果不稳定",
    invalidBody: "仍为你保留本次估算范围，但作答模式存在矛盾；建议重新测试以获得更可靠的结果。",
    profile: "词汇覆盖画像",
    basic: "基础高频词汇",
    advanced: "进阶／学术词汇",
    target: "所选阶段参考词汇",
    lowFrequency: "低频覆盖",
    savePoster: "保存结果海报",
    posterSaved: "海报已下载",
    retest: "重新测试",
    backHome: "返回首页",
    posterQuote: "学习没有捷径，进步来自每天的积累。"
  }
} as const;

export type AssessmentTranslationKey = keyof typeof messages.en;

export function useAssessmentI18n() {
  const { language } = useI18n();
  return useCallback(
    (key: AssessmentTranslationKey, params: Record<string, string | number> = {}) => {
      let result: string = messages[language][key];
      for (const [name, value] of Object.entries(params)) {
        result = result.replaceAll(`{${name}}`, String(value));
      }
      return result;
    },
    [language]
  );
}
