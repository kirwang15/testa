import type {
  AgeBand,
  ContentAccessLevel,
  ContentRating,
  CurriculumBookIndex,
  CurriculumLevelIndex,
  LevelProgress,
  PlayerProfile,
  RuntimeVocabularyWord,
  WordLearningProgress
} from "@/types/game";

const ACCESS_SEVERITY: Record<ContentAccessLevel, number> = {
  "all-ages": 0,
  "13-plus": 1,
  "parent-review": 2
};

const MAX_BOOK_BY_AGE: Record<AgeBand, 1 | 2 | 4> = {
  "7-9": 1,
  "10-12": 2,
  "13-15": 4
};

type ContentPolicyProfile = Pick<
  PlayerProfile,
  "ageBand" | "contentAccessLevel"
>;
type EligibleProgressStatus = "completed" | "recommended" | "available";

export function getContentBookNumber(contentId: string) {
  const match = /^(?:nce-1997-b|(?:legacy:)?nce-)([1-4])(?:-|$)/.exec(contentId);
  if (match) return Number(match[1]) as 1 | 2 | 3 | 4;
  return /^(?:ielts-nawl-v1|kaoyan-core-v1)(?:-|$)/.test(contentId)
    ? 1
    : undefined;
}

export function getMaximumBookForAge(ageBand: AgeBand) {
  return MAX_BOOK_BY_AGE[ageBand];
}

export function canAccessBook(
  profile: Pick<PlayerProfile, "ageBand">,
  book: string | Pick<CurriculumBookIndex, "id">
) {
  const bookNumber = getContentBookNumber(
    typeof book === "string" ? book : book.id
  );
  return Boolean(bookNumber && bookNumber <= getMaximumBookForAge(profile.ageBand));
}

export function getDefaultContentAccessLevel(ageBand: AgeBand): ContentAccessLevel {
  return ageBand === "13-15" ? "13-plus" : "all-ages";
}

export function canAccessRating(
  accessLevel: ContentAccessLevel,
  rating: ContentRating
) {
  return ACCESS_SEVERITY[accessLevel] >= ACCESS_SEVERITY[rating];
}

export function canAccessLevel(
  profile: ContentPolicyProfile,
  level: Pick<CurriculumLevelIndex, "bookId" | "rating">
) {
  return (
    canAccessBook(profile, level.bookId) &&
    canAccessRating(profile.contentAccessLevel, level.rating)
  );
}

export function canAccessReviewProgress(
  profile: ContentPolicyProfile,
  progress: Pick<
    WordLearningProgress,
    "wordId" | "sourceBook" | "contentRating" | "contentVersion"
  >
) {
  const sourceBook = progress.sourceBook ?? getContentBookNumber(progress.wordId);
  // Content versions identify whole releases, not stable word identities.
  // Callers must first resolve current answer-free metadata; access is then
  // based only on the current book/rating policy.
  return Boolean(
    sourceBook &&
    progress.contentRating &&
    sourceBook <= getMaximumBookForAge(profile.ageBand) &&
    canAccessRating(profile.contentAccessLevel, progress.contentRating)
  );
}

export function canAccessRuntimeWord(
  profile: ContentPolicyProfile,
  word: Pick<RuntimeVocabularyWord, "bookId" | "rating">
) {
  return (
    canAccessBook(profile, word.bookId) &&
    canAccessRating(profile.contentAccessLevel, word.rating)
  );
}

export function getRecommendedEligibleLevel(
  levels: readonly CurriculumLevelIndex[],
  progressByLevelId: Record<string, LevelProgress>,
  profile: ContentPolicyProfile
) {
  const eligible = levels.filter((level) => canAccessLevel(profile, level));
  return eligible.find((level) => !progressByLevelId[level.id]?.completed);
}

export function getEligibleLevelStatus(
  levels: readonly CurriculumLevelIndex[],
  levelId: string,
  progressByLevelId: Record<string, LevelProgress>,
  profile: ContentPolicyProfile
): EligibleProgressStatus {
  if (progressByLevelId[levelId]?.completed) return "completed";
  return getRecommendedEligibleLevel(levels, progressByLevelId, profile)?.id === levelId
    ? "recommended"
    : "available";
}

export function getEligibleUnitStatus(
  levels: readonly CurriculumLevelIndex[],
  unitId: string,
  progressByLevelId: Record<string, LevelProgress>,
  profile: ContentPolicyProfile
): EligibleProgressStatus {
  const unitLevels = levels.filter((level) => level.unitId === unitId);
  if (
    unitLevels.length > 0 &&
    unitLevels.every((level) => progressByLevelId[level.id]?.completed)
  ) {
    return "completed";
  }
  return getRecommendedEligibleLevel(levels, progressByLevelId, profile)?.unitId === unitId
    ? "recommended"
    : "available";
}

export function getEligibleBookStatus(
  levels: readonly CurriculumLevelIndex[],
  bookId: string,
  progressByLevelId: Record<string, LevelProgress>,
  profile: ContentPolicyProfile
): EligibleProgressStatus {
  const bookLevels = levels.filter((level) => level.bookId === bookId);
  if (
    bookLevels.length > 0 &&
    bookLevels.every((level) => progressByLevelId[level.id]?.completed)
  ) {
    return "completed";
  }
  return getRecommendedEligibleLevel(levels, progressByLevelId, profile)?.bookId === bookId
    ? "recommended"
    : "available";
}

export function getNextEligibleLevel(
  levels: readonly CurriculumLevelIndex[],
  currentLevelId: string,
  profile: ContentPolicyProfile
) {
  const currentIndex = levels.findIndex((level) => level.id === currentLevelId);
  if (currentIndex < 0) return undefined;
  return levels
    .slice(currentIndex + 1)
    .find((level) => canAccessLevel(profile, level));
}

export function isLevelAheadOfEligibleRecommendation(
  levels: readonly CurriculumLevelIndex[],
  levelId: string,
  progressByLevelId: Record<string, LevelProgress>,
  profile: ContentPolicyProfile
) {
  const eligible = levels.filter((level) => canAccessLevel(profile, level));
  const recommended = eligible.find(
    (level) => !progressByLevelId[level.id]?.completed
  );
  if (!recommended) return false;
  return (
    eligible.findIndex((level) => level.id === levelId) >
    eligible.findIndex((level) => level.id === recommended.id)
  );
}

export type AccessibleReviewPartition = {
  available: Array<{
    progress: WordLearningProgress;
    word: RuntimeVocabularyWord;
  }>;
  restricted: Array<{
    progress: WordLearningProgress;
    word: RuntimeVocabularyWord;
  }>;
};

export function partitionReviewWordsByAccess(
  loaded: Array<{
    progress: WordLearningProgress;
    word: RuntimeVocabularyWord;
  }>,
  profile: ContentPolicyProfile
): AccessibleReviewPartition {
  return loaded.reduce<AccessibleReviewPartition>(
    (partition, entry) => {
      const target = canAccessRuntimeWord(profile, entry.word)
        ? partition.available
        : partition.restricted;
      target.push(entry);
      return partition;
    },
    { available: [], restricted: [] }
  );
}
