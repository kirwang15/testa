const SAFE_PATH_PATTERNS = [
  /^\/$/,
  /^\/review$/,
  /^\/courses\/[a-z0-9][a-z0-9-]*$/,
  /^\/books\/[a-z0-9][a-z0-9-]*$/,
  /^\/books\/[a-z0-9][a-z0-9-]*\/units\/[a-z0-9][a-z0-9-]*$/
] as const;

const SAFE_MAP_QUERY = /^\/map\?book=[a-z0-9][a-z0-9-]*$/;

/**
 * Keeps a level's return destination inside the small set of screens that can
 * launch a level. The exact allow-list prevents open redirects and prevents a
 * stale arbitrary application route from becoming navigation state.
 */
export function sanitizeLevelReturnTo(value: string | null | undefined) {
  const candidate = value?.trim();
  if (!candidate || candidate.includes("\\") || /[\u0000-\u001f]/.test(candidate)) {
    return undefined;
  }

  if (SAFE_PATH_PATTERNS.some((pattern) => pattern.test(candidate))) {
    return candidate;
  }
  return SAFE_MAP_QUERY.test(candidate) ? candidate : undefined;
}

export function buildLevelHref(levelId: string, returnTo?: string | null) {
  const safeReturnTo = sanitizeLevelReturnTo(returnTo);
  const base = `/levels/${encodeURIComponent(levelId)}`;
  return safeReturnTo
    ? `${base}?returnTo=${encodeURIComponent(safeReturnTo)}`
    : base;
}

export function getDirectLevelFallback(
  curriculumId: string | undefined,
  bookId: string
) {
  return curriculumId && curriculumId !== "nce-1997"
    ? `/courses/${curriculumId}`
    : `/books/${bookId}`;
}
