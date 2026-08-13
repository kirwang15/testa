import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  nextAssessmentQuestion,
  startAssessment,
  submitAssessmentAnswer,
  type AssessmentBank,
  type AssessmentSession
} from "../lib/web-assessment";

const bank = JSON.parse(
  readFileSync("public/content/assessment/bank-v1.json", "utf8")
) as AssessmentBank;

function finish(
  initial: AssessmentSession,
  answer: "correct" | "wrong" | "false-positive-pseudo"
) {
  let session = initial;
  let safety = 0;
  while (session.phase !== "complete") {
    const question = nextAssessmentQuestion(bank, session);
    const isCorrect = answer === "correct";
    const recognized = question.item.itemType === "pseudoword"
      ? answer === "false-positive-pseudo"
      : isCorrect;
    session = submitAssessmentAnswer(bank, session, question, {
      recognized,
      selectedOptionIndex: isCorrect
        ? question.item.correctOptionIndex
        : (question.item.correctOptionIndex + 1) % question.item.options.length,
      responseTimeMs: 1200
    }).session;
    safety += 1;
    assert.ok(safety <= 40, "assessment must finish within 40 screens");
  }
  return session;
}

describe("offline Web vocabulary assessment", () => {
  test("publishes the complete proxy-v1 bank", () => {
    assert.equal(bank.items.length, 1440);
    assert.equal(bank.items.filter((item) => item.itemType === "realWord").length, 1200);
    assert.equal(bank.items.filter((item) => item.itemType === "pseudoword").length, 240);
    for (let band = 1; band <= 20; band += 1) {
      assert.equal(
        bank.items.filter((item) => item.itemType === "realWord" && item.frequencyBand === band).length,
        60
      );
      assert.equal(
        bank.items.filter((item) => item.itemType === "pseudoword" && item.frequencyBand === band).length,
        12
      );
    }
  });

  test("uses 8 real and 2 pseudowords in broad phase, then finishes with two unscored items", () => {
    const result = finish(startAssessment(bank, "unrestricted"), "correct");
    const broad = result.responses.filter((response) => response.phase === "broad");
    const wrapUp = result.responses.filter((response) => response.phase === "wrapUp");
    assert.equal(broad.length, 10);
    assert.equal(broad.filter((response) => response.itemType === "realWord").length, 8);
    assert.equal(broad.filter((response) => response.itemType === "pseudoword").length, 2);
    assert.equal(wrapUp.length, 2);
    assert.equal(wrapUp.every((response) => !response.scored), true);
    assert.ok(result.responses.length <= 40);
    assert.ok(
      result.responses.filter(
        (response) => response.scored && response.questionType === "multipleChoice"
      ).length >= 6
    );
  });

  test("moves the estimate monotonically and fails closed on both pseudoword false positives", () => {
    const low = finish(startAssessment(bank, "unrestricted"), "wrong");
    const high = finish(startAssessment(bank, "unrestricted"), "correct");
    const unreliable = finish(
      startAssessment(bank, "unrestricted"),
      "false-positive-pseudo"
    );
    assert.ok(high.estimate > low.estimate);
    assert.equal(unreliable.reliability, "invalid");
  });
});
