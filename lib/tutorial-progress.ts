import type {
  TutorialPhase,
  TutorialProgress
} from "@/types/game";

export const TUTORIAL_VERSION = 1 as const;
export const DEFAULT_TUTORIAL_LEVEL_ID = "nce-1997-b1-level-001";

const phases: TutorialPhase[] = [
  "intro",
  "home",
  "course-map",
  "game-ui",
  "first-word-detail",
  "level-complete",
  "completed"
];

type AdvanceOptions = {
  firstWordDetailSeen?: boolean;
  levelCompleted?: boolean;
};

export function createFreshTutorialProgress(): TutorialProgress {
  return {
    version: TUTORIAL_VERSION,
    status: "in-progress",
    phase: "intro",
    tutorialLevelId: DEFAULT_TUTORIAL_LEVEL_ID,
    firstWordDetailSeen: false,
    collapsed: false
  };
}

export function createCompletedTutorialProgress(): TutorialProgress {
  return {
    version: TUTORIAL_VERSION,
    status: "completed",
    phase: "completed",
    tutorialLevelId: DEFAULT_TUTORIAL_LEVEL_ID,
    firstWordDetailSeen: true,
    collapsed: false
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeTutorialProgress(
  value: unknown,
  missing: "fresh" | "legacy" = "legacy"
): TutorialProgress {
  if (!isRecord(value) || value.version !== TUTORIAL_VERSION) {
    return missing === "fresh"
      ? createFreshTutorialProgress()
      : createCompletedTutorialProgress();
  }
  const phase = phases.includes(value.phase as TutorialPhase)
    ? (value.phase as TutorialPhase)
    : "home";
  const completed = value.status === "completed" || phase === "completed";
  const phaseIndex = phases.indexOf(phase);
  const detailSeen = completed
    ? true
    : phaseIndex < phases.indexOf("first-word-detail")
      ? false
      : value.firstWordDetailSeen === true;
  const normalizedPhase = phase === "level-complete" && !detailSeen
    ? "first-word-detail"
    : phase;
  return {
    version: TUTORIAL_VERSION,
    status: completed ? "completed" : "in-progress",
    phase: completed ? "completed" : normalizedPhase,
    tutorialLevelId:
      value.tutorialLevelId === DEFAULT_TUTORIAL_LEVEL_ID
        ? value.tutorialLevelId
        : DEFAULT_TUTORIAL_LEVEL_ID,
    firstWordDetailSeen: detailSeen,
    collapsed: !completed && value.collapsed === true
  };
}

export function setTutorialCollapsed(
  current: TutorialProgress,
  collapsed: boolean
): TutorialProgress {
  if (current.status === "completed" || current.collapsed === collapsed) {
    return current;
  }
  return { ...current, collapsed };
}

export function mustInspectTutorialWord(
  current: TutorialProgress,
  levelId: string
) {
  return (
    current.status === "in-progress" &&
    current.tutorialLevelId === levelId &&
    current.phase === "first-word-detail" &&
    !current.firstWordDetailSeen
  );
}

export function advanceTutorial(
  current: TutorialProgress,
  nextPhase: TutorialPhase,
  options: AdvanceOptions = {}
): TutorialProgress {
  if (current.status === "completed") return current;

  const currentIndex = phases.indexOf(current.phase);
  const nextIndex = phases.indexOf(nextPhase);
  if (
    nextIndex === currentIndex &&
    nextPhase === "first-word-detail" &&
    options.firstWordDetailSeen &&
    !current.firstWordDetailSeen
  ) {
    return { ...current, firstWordDetailSeen: true };
  }
  if (nextIndex !== currentIndex + 1) return current;
  if (
    nextPhase === "level-complete" &&
    (!options.levelCompleted || !current.firstWordDetailSeen)
  ) {
    return current;
  }
  if (
    nextPhase === "completed" &&
    (!options.levelCompleted || current.phase !== "level-complete")
  ) {
    return current;
  }

  const completed = nextPhase === "completed";
  return {
    ...current,
    status: completed ? "completed" : "in-progress",
    phase: nextPhase,
    firstWordDetailSeen:
      current.firstWordDetailSeen || options.firstWordDetailSeen === true,
    collapsed: false
  };
}
