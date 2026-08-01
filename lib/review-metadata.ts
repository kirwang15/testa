import { curriculumContentVersion } from "./curriculum-index";
import { createReviewWordKey } from "../src/lib/review-metadata-key";
import type {
  ContentRating,
  ReviewMetadataIndex,
  ReviewWordMetadata
} from "../types/game";

const VALID_RATINGS = new Set<ContentRating>([
  "all-ages",
  "13-plus",
  "parent-review"
]);

let cachedIndex: ReviewMetadataIndex | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateReviewMetadataIndex(
  value: unknown,
  expectedContentVersion = curriculumContentVersion
): value is ReviewMetadataIndex {
  if (
    !isRecord(value) ||
    value.contentVersion !== expectedContentVersion ||
    expectedContentVersion !== curriculumContentVersion ||
    !isRecord(value.entries)
  ) {
    return false;
  }

  return Object.entries(value.entries).every(
    ([key, entry]) =>
      key.length > 0 &&
      Array.isArray(entry) &&
      entry.length === 2 &&
      Number.isInteger(entry[0]) &&
      Number(entry[0]) >= 1 &&
      Number(entry[0]) <= 4 &&
      VALID_RATINGS.has(entry[1] as ContentRating)
  );
}

export async function loadReviewMetadataIndex(
  contentVersion = curriculumContentVersion
) {
  if (contentVersion !== curriculumContentVersion) {
    return undefined;
  }
  if (cachedIndex?.contentVersion === contentVersion) {
    return cachedIndex;
  }

  try {
    const response = await fetch(
      `/content/runtime/review-metadata.json?v=${encodeURIComponent(contentVersion)}`,
      { credentials: "same-origin" }
    );
    if (!response.ok) return undefined;
    const candidate: unknown = await response.json();
    if (!validateReviewMetadataIndex(candidate, contentVersion)) return undefined;
    cachedIndex = candidate;
    return candidate;
  } catch {
    return undefined;
  }
}

export function resolveReviewWordMetadata(
  wordId: string,
  index: ReviewMetadataIndex
): ReviewWordMetadata | undefined {
  const entry = index.entries[createReviewWordKey(wordId)];
  if (!entry) return undefined;
  return { sourceBook: entry[0], contentRating: entry[1] };
}

export function resetReviewMetadataForTests() {
  cachedIndex = undefined;
}
