"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { TutorialCoach } from "@/components/TutorialCoach";
import type { UiLanguage } from "@/types/game";

export type TutorialPanelSection =
  | "home"
  | "map"
  | "game"
  | "open-solved"
  | "detail"
  | "complete";

type TutorialSectionCopy = {
  title: string;
  description: string;
  items: string[];
  primary?: string;
  later?: string;
};

type TutorialCopy = {
  eyebrow: string;
  referenceTitle: string;
  referenceDescription: string;
  sections: Record<TutorialPanelSection, TutorialSectionCopy>;
};

const copy: Record<UiLanguage, TutorialCopy> = {
  en: {
    eyebrow: "First adventure guide",
    referenceTitle: "Complete operation guide",
    referenceDescription:
      "Review every module without changing your tutorial or learning progress.",
    sections: {
      home: {
        title: "Know what every area does",
        description:
          "This guide stays available until you complete the first level. You may pause and continue later.",
        items: [
          "Vocabulary estimate: check an approximate receptive vocabulary range.",
          "Three course cards: New Concept English, IELTS preparation and Kaoyan starter vocabulary.",
          "Continue learning: opens the next suitable unfinished level.",
          "Map: choose a book, stage and individual level.",
          "Review: practise words scheduled from earlier learning.",
          "Vocabulary books: browse books, units and progress.",
          "Learning summary: view activity saved on this device.",
          "Language and settings: change display, clues, profiles and content access."
        ],
        primary: "Next: learn the map",
        later: "Continue later"
      },
      map: {
        title: "Read the course map",
        description: "The map shows where you are and what each level state means.",
        items: [
          "Book tabs and stages divide the course into learning paths.",
          "The highlighted marker is the recommended current level.",
          "Available levels can open; restricted levels explain why they are locked.",
          "Stars show your best result and progress shows completed levels."
        ],
        primary: "Start the guided first level",
        later: "Continue later"
      },
      game: {
        title: "How this level works",
        description:
          "Fill the crossing words. The guide remains active until the whole level is complete.",
        items: [
          "Top bar: return, level position, interface language and coins.",
          "Clue chips show number, across/down direction and letter count; switch English and Chinese clues here.",
          "Crossword board: words intersect and solved letters help another word.",
          "Letter wheel: tap letters in spelling order.",
          "Delete removes the last letter; clear starts the current spelling again.",
          "Listen plays pronunciation; hint steps can reveal letters and affect stars.",
          "There is no check button: a full spelling is checked automatically.",
          "A wrong full spelling stays red; edit it and the app checks again."
        ],
        primary: "Start spelling",
        later: "Continue later"
      },
      "open-solved": {
        title: "Open the word you just solved",
        description: "Tap its green clue chip before continuing the level.",
        items: [
          "Green clue chips are completed words and remain clickable.",
          "The detail view is read-only, so reviewing it cannot add rewards or change the answer."
        ],
        later: "Continue later"
      },
      detail: {
        title: "This is the word detail",
        description:
          "Review the complete learning record, then continue to the next unfinished word.",
        items: [
          "See spelling, phonetic, part of speech, CEFR, bilingual meanings, source and example.",
          "Listen repeats the pronunciation.",
          "Bookmark adds or removes the word from saved vocabulary.",
          "Continue next word returns to answer mode."
        ],
        later: "Continue later"
      },
      complete: {
        title: "Understand the completion actions",
        description:
          "You completed the required first level. Review these actions, then finish the guide.",
        items: [
          "Stars summarize this attempt; hints can affect the star result.",
          "Next level replaces this page while keeping the original return destination.",
          "Replay starts another attempt without duplicating saved rewards.",
          "Map is an explicit shortcut; the top-left back action returns to the entry screen."
        ],
        later: "Continue later"
      }
    }
  },
  "zh-CN": {
    eyebrow: "第一次冒险指引",
    referenceTitle: "完整操作说明",
    referenceDescription: "可以自由重看每个模块，不改变教程状态和学习进度。",
    sections: {
      home: {
        title: "先认识首页每个区域",
        description: "完成第一关前指引会一直保留；你可以暂时退出，之后接着完成。",
        items: [
          "词汇量测试：估算书面接受性词汇量范围。",
          "三套课程：新概念英语、IELTS 备考词汇和考研核心词汇起步篇。",
          "继续学习：打开当前最适合的未完成关卡。",
          "地图：选择词汇册、阶段和具体关卡。",
          "复习：练习从以往学习中安排到期的单词。",
          "词汇册：查看每册、单元和学习进度。",
          "学习摘要：查看保存在本机的学习记录。",
          "语言和设置：调整界面、提示、档案和内容访问范围。"
        ],
        primary: "下一步：认识地图",
        later: "稍后继续"
      },
      map: {
        title: "看懂课程地图",
        description: "地图会告诉你目前的位置，以及每种关卡状态的含义。",
        items: [
          "词汇册标签和阶段把课程分成不同学习路径。",
          "高亮标记是当前推荐挑战的关卡。",
          "可挑战关卡可以打开；受限关卡会说明锁定原因。",
          "星级显示历史最好成绩，进度显示已经完成的关卡数。"
        ],
        primary: "开始带指引的第一关",
        later: "稍后继续"
      },
      game: {
        title: "这一关怎样操作",
        description: "完成棋盘里全部交叉单词。整关完成前，新手指引不会结束。",
        items: [
          "顶部：返回、关卡位置、界面语言和金币。",
          "提示条：显示编号、横向/纵向和字母数，也可以切换中英文释义。",
          "棋盘：单词彼此交叉，已完成的字母会帮助后面的单词。",
          "字母区：按正确拼写顺序点击字母。",
          "删除会移除最后一个字母；清空会重新填写当前单词。",
          "发音可播放单词读音；提示可逐步显示字母，并会影响星级。",
          "没有验证按钮：字母填满后立即自动校验。",
          "拼错后输入会保留并标红；修改后系统会再次自动校验。"
        ],
        primary: "开始拼写",
        later: "稍后继续"
      },
      "open-solved": {
        title: "查看刚完成的单词",
        description: "继续之前，请点击它对应的绿色提示条。",
        items: [
          "绿色提示条代表已完成词条，完成后仍然可以点击。",
          "详情是只读状态，查看不会重复奖励，也不会改变作答。"
        ],
        later: "稍后继续"
      },
      detail: {
        title: "这里是单词详情",
        description: "查看完整学习信息，然后继续下一个未完成单词。",
        items: [
          "包含拼写、音标、词性、CEFR、中英文释义、来源和例句。",
          "听发音可以再次播放单词读音。",
          "收藏按钮可以把单词加入或移出词汇收藏。",
          "继续下一个单词会返回作答状态。"
        ],
        later: "稍后继续"
      },
      complete: {
        title: "认识通关后的操作",
        description: "你已完成规定的新手第一关。看完这些操作即可结束指引。",
        items: [
          "星级总结本次表现；使用提示可能影响星级。",
          "下一关会替换当前关卡，但仍保留最初的返回位置。",
          "重新挑战会开始新尝试，不会重复发放历史奖励。",
          "返回地图是明确快捷操作；左上角返回会回到进入关卡前的页面。"
        ],
        later: "稍后继续"
      }
    }
  }
};

export function getTutorialReferenceCopy(language: UiLanguage) {
  const value = copy[language];
  return {
    eyebrow: value.eyebrow,
    title: value.referenceTitle,
    description: value.referenceDescription
  };
}

type TutorialPanelProps = {
  language: UiLanguage;
  section: TutorialPanelSection;
  compact?: boolean;
  onPrimary?: () => void;
  onLater?: () => void;
  laterHref?: string;
  extraActions?: ReactNode;
};

export function TutorialPanel({
  language,
  section,
  compact = false,
  onPrimary,
  onLater,
  laterHref,
  extraActions
}: TutorialPanelProps) {
  const value = copy[language];
  const panel = value.sections[section];
  const primary = panel.primary && onPrimary ? (
    <button
      type="button"
      onClick={onPrimary}
      className="focus-ring min-h-11 rounded-lg border-2 border-ink bg-mint px-4 py-2 font-black text-white"
    >
      {panel.primary}
    </button>
  ) : null;
  const later = panel.later && onLater ? (
    laterHref ? (
      <Link
        href={laterHref}
        onClick={onLater}
        className="focus-ring inline-flex min-h-11 items-center rounded-lg border-2 border-ink bg-white px-4 py-2 font-black"
      >
        {panel.later}
      </Link>
    ) : (
      <button
        type="button"
        onClick={onLater}
        className="focus-ring min-h-11 rounded-lg border-2 border-ink bg-white px-4 py-2 font-black"
      >
        {panel.later}
      </button>
    )
  ) : null;

  return (
    <TutorialCoach
      compact={compact}
      eyebrow={value.eyebrow}
      title={panel.title}
      description={panel.description}
      items={panel.items}
      actions={primary || later || extraActions ? <>{primary}{extraActions}{later}</> : undefined}
    />
  );
}
