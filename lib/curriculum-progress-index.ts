import ratingCodes from "../src/content/vocabulary/generated/level-rating-codes.json";
import type {
  CurriculumLevelIndex,
  GameProgress,
  LevelProgress
} from "@/types/game";

export const compactCourses = [
  { id: "nce-1997", titleEn: "New Concept English", titleZh: "新概念英语", levelCount: 400 },
  { id: "ielts-nawl-v1", titleEn: "IELTS Academic Vocabulary", titleZh: "IELTS 备考词汇", levelCount: 200 },
  { id: "kaoyan-core-v1", titleEn: "Kaoyan Core Starter", titleZh: "考研核心词汇·起步篇", levelCount: 200 }
] as const;

export const compactBooks = [
  { id: "nce-1997-b1", level: "A1" },
  { id: "nce-1997-b2", level: "A2" },
  { id: "nce-1997-b3", level: "B1" },
  { id: "nce-1997-b4", level: "B2" }
] as const;

const ids = [
  ...Array.from({ length: 4 }, (_, bookIndex) =>
    Array.from(
      { length: 100 },
      (_, index) => `nce-1997-b${bookIndex + 1}-level-${String(index + 1).padStart(3, "0")}`
    )
  ).flat(),
  ...["ielts-nawl-v1", "kaoyan-core-v1"].flatMap((curriculumId) =>
    Array.from(
      { length: 200 },
      (_, index) => `${curriculumId}-level-${String(index + 1).padStart(3, "0")}`
    )
  )
];

export function getProgressLevelIds() {
  return ids;
}

export function getProgressLevelById(levelId: string): CurriculumLevelIndex | undefined {
  const rating = getContentRatingForLevelId(levelId);
  const nce = /^nce-1997-b([1-4])-level-(\d{3})$/.exec(levelId);
  if (nce) {
    const book = Number(nce[1]);
    const levelNumber = Number(nce[2]);
    if (levelNumber < 1 || levelNumber > 100) return undefined;
    const phaseLevel = ((levelNumber - 1) % 50) + 1;
    const unit = Math.floor((phaseLevel - 1) / 10) + 1;
    return {
      id: levelId,
      bookId: `nce-1997-b${book}`,
      unitId: `nce-1997-b${book}-u${unit}`,
      curriculumId: "nce-1997",
      trackId: `nce-1997-b${book}`,
      levelNumber,
      wordCount: phaseLevel <= 15 ? 3 : phaseLevel <= 35 ? 4 : 5,
      releaseStatus: "automated-beta",
      rating
    };
  }

  const course = /^(ielts-nawl-v1|kaoyan-core-v1)-level-(\d{3})$/.exec(levelId);
  if (!course) return undefined;
  const levelNumber = Number(course[2]);
  if (levelNumber < 1 || levelNumber > 200) return undefined;
  const stage = Math.ceil(levelNumber / 50);
  return {
    id: levelId,
    bookId: `${course[1]}-s${stage}`,
    unitId: `${course[1]}-s${stage}`,
    curriculumId: course[1],
    trackId: `${course[1]}-s${stage}`,
    levelNumber,
    wordCount: 3,
    releaseStatus: "automated-beta",
    rating
  };
}

export function getContentRatingForLevelId(levelId: string) {
  const ordinal = ids.indexOf(levelId);
  for (let index = 0; index < ratingCodes.length; index += 2) {
    if (ratingCodes[index] === ordinal) {
      return ratingCodes[index + 1] === 1 ? "13-plus" : "parent-review";
    }
  }
  return "all-ages";
}

export function getProgressLevelsByCurriculumId(curriculumId: string) {
  return ids
    .filter((id) => id.startsWith(`${curriculumId}-`))
    .map((id) => getProgressLevelById(id)!)
}

export function getProgressLevelsByBookId(bookId: string) {
  return ids
    .filter((id) => id.startsWith(`${bookId}-level-`))
    .map((id) => getProgressLevelById(id)!)
}

export function getCompactBookProgress(bookId: string, progress: GameProgress) {
  const levels = getProgressLevelsByBookId(bookId);
  const completedLevels = levels.filter((level) => progress.levels[level.id]?.completed).length;
  const words = Object.values(progress.words).filter((word) => word.wordId.startsWith(`${bookId}-`));
  return {
    totalLevels: levels.length,
    completedLevels,
    completionPercent: levels.length === 0 ? 0 : Math.round(completedLevels / levels.length * 100),
    learnedWords: words.filter((word) => word.correctCount > 0 || word.masteryLevel > 0).length,
    masteredWords: words.filter((word) => word.masteryLevel >= 4).length
  };
}

export function getFirstProgressLevel() {
  return getProgressLevelById(ids[0]);
}

export function getRecommendedProgressLevel(
  progressByLevelId: Record<string, LevelProgress>
) {
  const levelId = ids.find((id) => !progressByLevelId[id]?.completed);
  return levelId ? getProgressLevelById(levelId) : undefined;
}
