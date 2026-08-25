export type AutoSubmissionClaim = {
  accepted: boolean;
  lastSignature?: string;
};

/** Claims one complete spelling. Editing resets the stored signature, so even
 * an identical repaired spelling can be checked again exactly once. */
export function claimAutoSubmission(
  lastSignature: string | undefined,
  nextSignature: string
): AutoSubmissionClaim {
  return lastSignature === nextSignature
    ? { accepted: false, lastSignature }
    : { accepted: true, lastSignature: nextSignature };
}

export function resetAutoSubmission() {
  return undefined;
}
