import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import {
  nextAssessmentQuestion,
  reconcileAssessmentState,
  startAssessment,
  submitAssessmentAnswer,
  type AssessmentBank,
  type AssessmentSession
} from "../lib/web-assessment";
import { normalizeAssessmentSession } from "../lib/web-assessment-storage";

const bank = JSON.parse(
  readFileSync("public/content/assessment/bank-v1.json", "utf8")
) as AssessmentBank;
const parityFixtures = JSON.parse(
  readFileSync(
    "word_trail_flutter/assets/content/assessment/policy-v2-parity-fixtures.json",
    "utf8"
  )
) as {
  bankVersion: string;
  startedAt: string;
  cases: Array<{
    id: string;
    anchor: Parameters<typeof startAssessment>[1];
    seed: number;
    strategy: "allCorrect" | "allWrong" | "alternating";
    expected: {
      questionSequenceSha256: string;
      totalScreens: number;
      broadScreens: number;
      adaptiveScreens: number;
      wrapUpScreens: number;
      multipleChoiceScored: number;
      theta: number;
      standardError: number;
      estimate: number;
      estimateLower: number;
      estimateUpper: number;
      reliability: AssessmentSession["reliability"];
      coverage: AssessmentSession["coverage"];
    };
  }>;
};

function thetaForEstimate(estimate: number) {
  const probability = Math.min(0.999, Math.max(0.001, estimate / 20_000));
  return Math.log(probability / (1 - probability));
}

function deterministicUnit(seed: number, value: string) {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (const character of value) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 0x01000193) >>> 0;
  }
  return hash / 0x1_0000_0000;
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function simulate(trueEstimate: number, seed: number) {
  const theta = thetaForEstimate(trueEstimate);
  let session = startAssessment(bank, "unrestricted", {
    seed,
    startedAt: new Date("2026-08-13T00:00:00.000Z")
  });
  while (session.phase !== "complete") {
    const question = nextAssessmentQuestion(bank, session);
    const guessing = question.type === "multipleChoice" ? question.item.guessing : 0;
    const logistic =
      1 /
      (1 +
        Math.exp(
          -question.item.discrimination * (theta - question.item.difficulty)
        ));
    const probability =
      question.item.itemType === "pseudoword"
        ? 1
        : guessing + (1 - guessing) * logistic;
    const correct =
      deterministicUnit(seed, `${question.questionId}:${session.responses.length}`) <
      probability;
    session = submitAssessmentAnswer(bank, session, question, {
      recognized:
        question.type === "yesNo"
          ? question.item.itemType === "pseudoword"
            ? false
            : correct
          : undefined,
      selectedOptionIndex:
        question.type === "multipleChoice"
          ? correct
            ? question.item.correctOptionIndex
            : (question.item.correctOptionIndex + 1) % question.item.options.length
          : undefined,
      responseTimeMs: 1200
    }).session;
    assert.ok(session.responses.length <= 80, "simulated session exceeded 80 screens");
  }
  return session;
}

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
    assert.ok(safety <= 80, "assessment must finish within 80 screens");
  }
  return session;
}

describe("offline Web vocabulary assessment", () => {
  test("publishes the complete versioned policy-v2 proxy bank", () => {
    assert.equal(bank.schemaVersion, 2);
    assert.equal(bank.policyVersion, 2);
    assert.match(bank.bankVersion, /^assessment-proxy-v2-/);
    assert.deepEqual(bank.broadPhaseRules, {
      totalItems: 20,
      realItems: 16,
      pseudowordItems: 4,
      realBands: [1, 2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16, 17, 18, 20],
      pseudowordSlots: [3, 8, 13, 18],
      pseudowordBands: [4, 9, 14, 19]
    });
    assert.deepEqual(bank.stoppingRules, {
      minimumScoringItems: 48,
      maximumScoringItems: 76,
      wrapUpItems: 4,
      minimumMultipleChoiceItems: 12,
      minimumBasicItems: 4,
      minimumAdvancedItems: 4,
      minimumTargetItems: 4,
      standardErrorThreshold: 0.32,
      relativeEstimateChangeThreshold: 0.03,
      stableEstimateChanges: 6,
      informationThreshold: 0.08
    });
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

  test("drops only an incompatible active session and preserves history", () => {
    const history = [
      finish(startAssessment(bank, "ielts", { seed: 7 }), "correct")
    ];
    const stale = {
      ...startAssessment(bank, "ielts", { seed: 8 }),
      bankVersion: "assessment-proxy-v1-stale"
    };
    assert.deepEqual(
      reconcileAssessmentState({ active: stale, history }, bank.bankVersion),
      { history }
    );
    const active = startAssessment(bank, "ielts", { seed: 9 });
    assert.deepEqual(
      reconcileAssessmentState({ active, history }, bank.bankVersion),
      { active, history }
    );
  });

  test("drops a malformed active session without sacrificing valid history", () => {
    const history = [
      finish(startAssessment(bank, "ielts", { seed: 17 }), "correct")
    ];
    const malformed = {
      ...startAssessment(bank, "ielts", { seed: 18 }),
      responses: "corrupted"
    } as unknown as AssessmentSession;
    assert.equal(normalizeAssessmentSession(malformed, "active"), undefined);
    assert.deepEqual(
      reconcileAssessmentState({ active: malformed, history }, bank.bankVersion),
      { history }
    );
  });

  test("rejects impossible active phase combinations while preserving history", () => {
    const complete = finish(startAssessment(bank, "ielts", { seed: 70 }), "correct");
    const active = startAssessment(bank, "ielts", { seed: 71 });
    const impossible = {
      ...active,
      phase: "adaptive" as const,
      responses: []
    };

    assert.equal(normalizeAssessmentSession(impossible, "active"), undefined);
    assert.deepEqual(
      reconcileAssessmentState(
        { active: impossible, history: [complete] },
        bank.bankVersion
      ),
      { history: [complete] }
    );
  });

  test("keeps a completed proxy-v1 result readable after the bank changes", () => {
    const old = {
      ...finish(startAssessment(bank, "ielts", { seed: 72 }), "correct"),
      bankVersion: "assessment-proxy-v1-frozen",
      responses: finish(
        startAssessment(bank, "ielts", { seed: 73 }),
        "correct"
      ).responses.slice(0, 26)
    };
    // A historical v1 payload only needs a monotonic, completed response
    // sequence; it must not be erased merely because policy v2 is active.
    old.responses = old.responses.map((response, index) =>
      index < 10
        ? { ...response, phase: "broad" as const, questionType: "yesNo" as const }
        : index < 24
          ? { ...response, phase: "adaptive" as const }
          : {
              ...response,
              phase: "wrapUp" as const,
              questionType: "yesNo" as const,
              scored: false
            }
    );
    assert.ok(normalizeAssessmentSession(old, "history"));
    assert.deepEqual(
      reconcileAssessmentState({ active: undefined, history: [old] }, bank.bankVersion),
      { history: [old] }
    );
  });

  test("uses 16 real and 4 pseudowords in broad phase, then finishes with four unscored items", () => {
    const result = finish(startAssessment(bank, "unrestricted"), "correct");
    const broad = result.responses.filter((response) => response.phase === "broad");
    const wrapUp = result.responses.filter((response) => response.phase === "wrapUp");
    assert.equal(broad.length, 20);
    assert.equal(broad.filter((response) => response.itemType === "realWord").length, 16);
    assert.equal(broad.filter((response) => response.itemType === "pseudoword").length, 4);
    assert.equal(wrapUp.length, 4);
    assert.equal(wrapUp.every((response) => !response.scored), true);
    assert.ok(result.responses.length >= 52);
    assert.ok(result.responses.length <= 80);
    assert.ok(
      result.responses.filter(
        (response) => response.scored && response.questionType === "multipleChoice"
      ).length >= 12
    );
    const realScored = result.responses.filter(
      (response) => response.scored && response.itemType === "realWord"
    );
    assert.ok(realScored.filter((response) => response.frequencyBand <= 7).length >= 4);
    assert.ok(
      realScored.filter(
        (response) => response.frequencyBand >= 8 && response.frequencyBand <= 14
      ).length >= 4
    );
    assert.ok(realScored.filter((response) => response.frequencyBand >= 15).length >= 4);
  });

  test("is deterministic for an explicit seed and records estimate history for stability", () => {
    const options = { seed: 314159, startedAt: new Date("2026-08-13T00:00:00.000Z") };
    const first = finish(startAssessment(bank, "ielts", options), "correct");
    const second = finish(startAssessment(bank, "ielts", options), "correct");
    assert.deepEqual(
      first.responses.map((response) => [response.itemId, response.questionType, response.phase]),
      second.responses.map((response) => [response.itemId, response.questionType, response.phase])
    );
    assert.deepEqual(first.estimateHistory, second.estimateHistory);
    assert.ok(first.estimateHistory.length >= 48);
  });

  test("matches the shared policy-v2 Web/Flutter conformance fixtures", () => {
    assert.equal(parityFixtures.bankVersion, bank.bankVersion);
    for (const fixture of parityFixtures.cases) {
      let session = startAssessment(bank, fixture.anchor, {
        seed: fixture.seed,
        startedAt: new Date(parityFixtures.startedAt)
      });
      const questionIds: string[] = [];
      while (session.phase !== "complete") {
        const question = nextAssessmentQuestion(bank, session);
        questionIds.push(question.questionId);
        const ordinal = session.responses.length;
        const baseCorrect =
          fixture.strategy === "allCorrect"
            ? true
            : fixture.strategy === "allWrong"
              ? false
              : ordinal % 2 === 0;
        const correct =
          question.item.itemType === "pseudoword"
            ? fixture.strategy !== "allWrong"
            : baseCorrect;
        session = submitAssessmentAnswer(bank, session, question, {
          recognized:
            question.type === "yesNo"
              ? question.item.itemType === "pseudoword"
                ? !correct
                : correct
              : undefined,
          selectedOptionIndex:
            question.type === "multipleChoice"
              ? correct
                ? question.item.correctOptionIndex
                : (question.item.correctOptionIndex + 1) % question.item.options.length
              : undefined,
          responseTimeMs: 1200
        }).session;
      }
      const actual = {
        questionSequenceSha256: createHash("sha256")
          .update(questionIds.join("\n"))
          .digest("hex"),
        totalScreens: session.responses.length,
        broadScreens: session.responses.filter((response) => response.phase === "broad").length,
        adaptiveScreens: session.responses.filter((response) => response.phase === "adaptive").length,
        wrapUpScreens: session.responses.filter((response) => response.phase === "wrapUp").length,
        multipleChoiceScored: session.responses.filter(
          (response) => response.scored && response.questionType === "multipleChoice"
        ).length,
        theta: Number(session.theta.toFixed(12)),
        standardError: Number(session.standardError.toFixed(12)),
        estimate: session.estimate,
        estimateLower: session.estimateLower,
        estimateUpper: session.estimateUpper,
        reliability: session.reliability,
        coverage: session.coverage
      };
      assert.deepEqual(actual, fixture.expected, fixture.id);
    }
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

  test("passes the 11-ability by 100-seed coverage, monotonicity and absolute-SE gate", () => {
    const abilities = Array.from({ length: 11 }, (_, index) => 1000 + index * 1800);
    const medians: number[] = [];
    const finalErrors: number[] = [];
    let covered = 0;
    let total = 0;
    for (const ability of abilities) {
      const estimates: number[] = [];
      for (let seed = 0; seed < 100; seed += 1) {
        const result = simulate(ability, seed + ability * 1000);
        estimates.push(result.estimate);
        finalErrors.push(result.standardError);
        if (
          result.estimateLower <= ability &&
          ability <= result.estimateUpper
        ) {
          covered += 1;
        }
        total += 1;
      }
      medians.push(median(estimates));
    }
    for (let index = 1; index < medians.length; index += 1) {
      assert.ok(
        medians[index] > medians[index - 1],
        `median estimate must rise: ${medians.join(", ")}`
      );
    }
    assert.ok(covered / total >= 0.9, `95% interval coverage was ${covered}/${total}`);
    assert.ok(
      median(finalErrors) <= bank.stoppingRules.standardErrorThreshold,
      `median terminal standard error was ${median(finalErrors).toFixed(4)}`
    );
  });
});
