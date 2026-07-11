export type HintStage = {
  wordId: string;
  interactions: number;
};

export type HintAction = "pronunciation" | "first-letter" | "position";

export function getHintAction(
  stage: HintStage,
  wordId: string,
  firstPositionVisible = false
): HintAction {
  if (stage.wordId !== wordId || stage.interactions === 0) {
    return "pronunciation";
  }

  return stage.interactions === 1 && !firstPositionVisible
    ? "first-letter"
    : "position";
}

export function advanceHintStage(stage: HintStage, wordId: string): HintStage {
  return {
    wordId,
    interactions: stage.wordId === wordId ? stage.interactions + 1 : 1
  };
}
