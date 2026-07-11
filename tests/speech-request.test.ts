import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isSpeechRequestCurrent } from "../lib/speech-request";
import {
  applyConfirmedPronunciationHint,
  applyWordSubmission,
  createInitialGameProgress
} from "../lib/progress";
import { getLevelById } from "../lib/levelLoader";

describe("speech request concurrency", () => {
  test("rejects stale, unmounted, and wrong-level callbacks", () => {
    const request = { token: 3, scopeId: "level-a", itemId: "cat" };

    assert.equal(isSpeechRequestCurrent(request, 3, "level-a", "cat", true), true);
    assert.equal(isSpeechRequestCurrent(request, 4, "level-a", "cat", true), false);
    assert.equal(isSpeechRequestCurrent(request, 3, "level-b", "cat", true), false);
    assert.equal(isSpeechRequestCurrent(request, 3, "level-a", "car", true), false);
    assert.equal(isSpeechRequestCurrent(request, 3, "level-a", "cat", false), false);
  });

  test("applies delayed pronunciation to the latest store attempt", () => {
    const level = getLevelById("nce-1-u1-level-1");
    assert.ok(level);
    const firstWord = level.targetWords[0];
    const secondWord = level.targetWords[1];
    assert.ok(firstWord);
    assert.ok(secondWord);
    const solved = applyWordSubmission(
      createInitialGameProgress(),
      level,
      firstWord.word
    );
    const confirmed = applyConfirmedPronunciationHint(
      solved.nextProgress,
      level.id,
      secondWord.id
    );

    assert.equal(confirmed.status, "applied");
    assert.deepEqual(confirmed.attemptProgress.foundWords, [firstWord.id]);
    assert.equal(confirmed.attemptProgress.hintsUsed, 1);
  });

  test("ignores a delayed pronunciation after its target was solved", () => {
    const level = getLevelById("nce-1-u1-level-1");
    assert.ok(level);
    const firstWord = level.targetWords[0];
    assert.ok(firstWord);
    const solved = applyWordSubmission(
      createInitialGameProgress(),
      level,
      firstWord.word
    );
    const confirmed = applyConfirmedPronunciationHint(
      solved.nextProgress,
      level.id,
      firstWord.id
    );

    assert.equal(confirmed.status, "stale");
    assert.deepEqual(confirmed.nextProgress, solved.nextProgress);
  });
});
