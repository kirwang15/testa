import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  advanceTutorial,
  createCompletedTutorialProgress,
  createFreshTutorialProgress,
  normalizeTutorialProgress,
  mustInspectTutorialWord,
  setTutorialCollapsed
} from "../lib/tutorial-progress";

describe("required first-level tutorial progress", () => {
  test("fresh learners must finish the guided level and cannot skip to completed", () => {
    const fresh = createFreshTutorialProgress();
    assert.deepEqual(fresh, {
      version: 1,
      status: "in-progress",
      phase: "intro",
      tutorialLevelId: "nce-1997-b1-level-001",
      firstWordDetailSeen: false,
      collapsed: false
    });
    assert.equal(advanceTutorial(fresh, "completed").phase, "intro");
    assert.equal(
      advanceTutorial(fresh, "completed", { levelCompleted: true }).phase,
      "intro"
    );
  });

  test("cannot mark the level complete before the solved-word detail was opened", () => {
    let tutorial = createFreshTutorialProgress();
    tutorial = advanceTutorial(tutorial, "home");
    tutorial = advanceTutorial(tutorial, "course-map");
    tutorial = advanceTutorial(tutorial, "game-ui");
    tutorial = advanceTutorial(tutorial, "first-word-detail");
    assert.equal(mustInspectTutorialWord(tutorial, tutorial.tutorialLevelId), true);
    assert.equal(
      advanceTutorial(tutorial, "level-complete", { levelCompleted: true }).phase,
      "first-word-detail"
    );
  });

  test("unlocks spelling only after the green solved word detail was opened", () => {
    let tutorial = createFreshTutorialProgress();
    tutorial = advanceTutorial(tutorial, "home");
    tutorial = advanceTutorial(tutorial, "course-map");
    tutorial = advanceTutorial(tutorial, "game-ui");
    tutorial = advanceTutorial(tutorial, "first-word-detail");
    assert.equal(mustInspectTutorialWord(tutorial, tutorial.tutorialLevelId), true);
    tutorial = advanceTutorial(tutorial, "first-word-detail", {
      firstWordDetailSeen: true
    });
    assert.equal(mustInspectTutorialWord(tutorial, tutorial.tutorialLevelId), false);
  });

  test("moves forward monotonically and completion requires a completed level", () => {
    let tutorial = createFreshTutorialProgress();
    tutorial = advanceTutorial(tutorial, "home");
    tutorial = advanceTutorial(tutorial, "course-map");
    tutorial = advanceTutorial(tutorial, "game-ui");
    tutorial = advanceTutorial(tutorial, "first-word-detail", {
      firstWordDetailSeen: true
    });
    tutorial = advanceTutorial(tutorial, "level-complete", {
      levelCompleted: true
    });
    tutorial = advanceTutorial(tutorial, "completed", {
      levelCompleted: true
    });
    assert.deepEqual(tutorial, createCompletedTutorialProgress());
    assert.equal(advanceTutorial(tutorial, "home"), tutorial);
  });

  test("normalizes missing legacy progress as completed without forcing existing users", () => {
    assert.deepEqual(normalizeTutorialProgress(undefined, "legacy"), createCompletedTutorialProgress());
    assert.deepEqual(normalizeTutorialProgress(undefined, "fresh"), createFreshTutorialProgress());
  });

  test("repairs an impossible completed-level phase that never opened word detail", () => {
    const repaired = normalizeTutorialProgress({
      version: 1,
      status: "in-progress",
      phase: "level-complete",
      tutorialLevelId: "nce-1997-b1-level-001",
      firstWordDetailSeen: false,
      collapsed: false
    });
    assert.equal(repaired.phase, "first-word-detail");
    assert.equal(repaired.firstWordDetailSeen, false);
    assert.equal(
      advanceTutorial(repaired, "completed", { levelCompleted: true }).phase,
      "first-word-detail"
    );
  });

  test("repairs impossible flags, future versions and arbitrary tutorial levels", () => {
    const early = normalizeTutorialProgress({
      version: 1,
      status: "in-progress",
      phase: "home",
      tutorialLevelId: "ielts-nawl-v1-level-200",
      firstWordDetailSeen: true,
      collapsed: false
    }, "fresh");
    assert.equal(early.phase, "home");
    assert.equal(early.firstWordDetailSeen, false);
    assert.equal(early.tutorialLevelId, "nce-1997-b1-level-001");

    assert.deepEqual(
      normalizeTutorialProgress({ version: 99, phase: "completed" }, "fresh"),
      createFreshTutorialProgress()
    );
    assert.deepEqual(
      normalizeTutorialProgress({ version: 99, phase: "intro" }, "legacy"),
      createCompletedTutorialProgress()
    );
  });

  test("persists a resumable collapsed state and clears it when the phase advances", () => {
    let tutorial = advanceTutorial(createFreshTutorialProgress(), "home");
    tutorial = setTutorialCollapsed(tutorial, true);
    assert.equal(tutorial.collapsed, true);
    assert.equal(normalizeTutorialProgress(tutorial, "fresh").collapsed, true);
    tutorial = setTutorialCollapsed(tutorial, false);
    tutorial = advanceTutorial(tutorial, "course-map");
    assert.equal(tutorial.collapsed, false);
  });
});
