import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  claimAutoSubmission,
  resetAutoSubmission
} from "../lib/auto-word-validation";

describe("automatic word validation guard", () => {
  test("submits one full spelling once until the learner edits it", () => {
    const signature = "profile:level:word:WRONG";
    const first = claimAutoSubmission(undefined, signature);
    assert.equal(first.accepted, true);
    assert.equal(claimAutoSubmission(first.lastSignature, signature).accepted, false);
  });

  test("wrong → backspace → same last letter submits exactly one more time", () => {
    const signature = "profile:level:word:WRONG";
    const first = claimAutoSubmission(undefined, signature);
    const edited = resetAutoSubmission();
    const repaired = claimAutoSubmission(edited, signature);
    assert.equal(repaired.accepted, true);
    assert.equal(claimAutoSubmission(repaired.lastSignature, signature).accepted, false);
  });
});
