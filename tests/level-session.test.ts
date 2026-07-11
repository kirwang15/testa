import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getLevelScopedAttemptProgress } from "../lib/level-session";
import { createEmptyLevelProgress } from "../src/lib/game-engine";

describe("level session boundary", () => {
  test("never exposes a previous level attempt during a prop change", () => {
    const previousAttempt = {
      ...createEmptyLevelProgress(),
      foundWords: ["previous-answer"],
      completed: true
    };

    assert.equal(
      getLevelScopedAttemptProgress(
        "previous-level",
        "next-level",
        previousAttempt
      ),
      undefined
    );
    assert.deepEqual(
      getLevelScopedAttemptProgress(
        "previous-level",
        "previous-level",
        previousAttempt
      ),
      previousAttempt
    );
  });
});
