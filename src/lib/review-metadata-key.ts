/**
 * A compact deterministic fingerprint for answer-free review metadata.
 * This is an identity key, not a password hash. The content build rejects
 * collisions before publishing the index.
 */
export function createReviewWordKey(wordId: string) {
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;

  for (let index = 0; index < wordId.length; index += 1) {
    const code = wordId.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193) >>> 0;
    right = Math.imul(right ^ code, 0x85ebca6b) >>> 0;
  }

  return `${left.toString(36)}.${right.toString(36)}`;
}
