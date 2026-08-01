import { getDueWords } from "../src/lib/review-engine";
import { canAccessReviewProgress, getContentBookNumber } from "./content-access";
import { resolveReviewWordMetadata } from "./review-metadata";
import type {
  AgeBand,
  PlayerProfile,
  ReviewMetadataIndex,
  RuntimeVocabularyWord,
  WordLearningProgress
} from "../types/game";

export const DUE_REVIEW_LIMIT_BY_AGE: Record<AgeBand, number> = {
  "7-9": 5,
  "10-12": 8,
  "13-15": 12
};

type ReviewProfile = Pick<PlayerProfile, "ageBand" | "contentAccessLevel">;

export type DueReviewSnapshot = {
  available: WordLearningProgress[];
  sessionCandidates: WordLearningProgress[];
  restricted: WordLearningProgress[];
  recoverable: WordLearningProgress[];
  limit: number;
};

/**
 * The one access-aware due selector used by Home and Review. Every known word
 * is upgraded from the current answer-free metadata index before policy is
 * evaluated. A whole-release content version change therefore cannot erase
 * old review debt, while removed/unknown ids stay recoverable and separate
 * from genuine parent/age restrictions.
 */
export function getDueReviewSnapshot(
  progressByWordId: Record<string, WordLearningProgress>,
  profile: ReviewProfile,
  metadataIndex: ReviewMetadataIndex,
  now = new Date()
): DueReviewSnapshot {
  const partition = getDueWords(progressByWordId, now).reduce<
    Pick<DueReviewSnapshot, "available" | "restricted" | "recoverable">
  >(
    (result, progress) => {
      const metadata = resolveReviewWordMetadata(progress.wordId, metadataIndex);
      if (!metadata) {
        result.recoverable.push(progress);
        return result;
      }

      const upgraded: WordLearningProgress = {
        ...progress,
        ...metadata,
        contentVersion: metadataIndex.contentVersion
      };
      if (canAccessReviewProgress(profile, upgraded)) {
        result.available.push(upgraded);
      } else {
        result.restricted.push(upgraded);
      }
      return result;
    },
    { available: [], restricted: [], recoverable: [] }
  );
  const limit = DUE_REVIEW_LIMIT_BY_AGE[profile.ageBand];

  return {
    ...partition,
    limit,
    sessionCandidates: partition.available.slice(0, limit)
  };
}

export function getDueReviewCandidates(
  progressByWordId: Record<string, WordLearningProgress>,
  profile: ReviewProfile,
  metadataIndex: ReviewMetadataIndex,
  now = new Date()
) {
  return getDueReviewSnapshot(progressByWordId, profile, metadataIndex, now)
    .sessionCandidates;
}

export function getRestrictedDueReviewCount(
  progressByWordId: Record<string, WordLearningProgress>,
  profile: ReviewProfile,
  metadataIndex: ReviewMetadataIndex,
  now = new Date()
) {
  return getDueReviewSnapshot(progressByWordId, profile, metadataIndex, now)
    .restricted.length;
}

export function getRecoverableDueReviewCount(
  progressByWordId: Record<string, WordLearningProgress>,
  profile: ReviewProfile,
  metadataIndex: ReviewMetadataIndex,
  now = new Date()
) {
  return getDueReviewSnapshot(progressByWordId, profile, metadataIndex, now)
    .recoverable.length;
}

export function runtimeWordMatchesReviewProgress(
  word: RuntimeVocabularyWord,
  progress: WordLearningProgress
) {
  return Boolean(
    progress.sourceBook &&
    getContentBookNumber(word.bookId) === progress.sourceBook &&
    word.rating === progress.contentRating
  );
}

export type LoadedReviewWords = {
  available: Array<{
    progress: WordLearningProgress;
    word: RuntimeVocabularyWord;
  }>;
  missingWordIds: string[];
  attemptedWordIds: string[];
};

/**
 * Load in ordered batches until enough healthy words are available. Missing
 * files are isolated, but they never let the first N broken ids starve a later
 * healthy review item.
 */
export async function loadReviewWordsUntilLimit(
  candidates: readonly WordLearningProgress[],
  limit: number,
  loadWord: (
    progress: WordLearningProgress
  ) => Promise<RuntimeVocabularyWord | undefined>
): Promise<LoadedReviewWords> {
  const available: LoadedReviewWords["available"] = [];
  const missingWordIds: string[] = [];
  const attemptedWordIds: string[] = [];
  let cursor = 0;

  while (cursor < candidates.length && available.length < limit) {
    const needed = limit - available.length;
    const batch = candidates.slice(cursor, cursor + needed);
    cursor += batch.length;
    const words = await Promise.all(
      batch.map(async (progress) => ({ progress, word: await loadWord(progress) }))
    );

    for (const entry of words) {
      attemptedWordIds.push(entry.progress.wordId);
      if (
        entry.word &&
        entry.word.id === entry.progress.wordId &&
        runtimeWordMatchesReviewProgress(entry.word, entry.progress)
      ) {
        available.push({ progress: entry.progress, word: entry.word });
      } else {
        missingWordIds.push(entry.progress.wordId);
      }
    }
  }

  return { available, missingWordIds, attemptedWordIds };
}

export function partitionLoadedReviewWords(
  candidates: readonly WordLearningProgress[],
  loadedWords: readonly RuntimeVocabularyWord[]
) {
  const loadedById = new Map(loadedWords.map((word) => [word.id, word]));
  return {
    available: candidates.flatMap((progress) => {
      const word = loadedById.get(progress.wordId);
      return word ? [{ progress, word }] : [];
    }),
    missingWordIds: candidates
      .map((progress) => progress.wordId)
      .filter((wordId) => !loadedById.has(wordId))
  };
}

export function getLocalReviewDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getReviewRuntimeStatus(
  loadedCount: number,
  hasLoadedAnyReview: boolean
): "ready" | "error" {
  return loadedCount > 0 || hasLoadedAnyReview ? "ready" : "error";
}
