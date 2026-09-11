export type LetterHintAction = "first-letter" | "position";

/**
 * Pronunciation is deliberately not part of this state machine. Listening is
 * always replayable; only a letter reveal advances the persisted hint state.
 */
export function getLetterHintAction(
  firstPositionVisible = false
): LetterHintAction {
  return firstPositionVisible ? "position" : "first-letter";
}
