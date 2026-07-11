import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  advanceHintStage,
  getHintAction,
  type HintStage
} from "../lib/hint-stage";
import { speakEnglishWord } from "../lib/speech";

describe("staged hints", () => {
  test("progresses from pronunciation to first letter to later positions per clue", () => {
    let stage: HintStage = { wordId: "cat", interactions: 0 };

    assert.equal(getHintAction(stage, "cat"), "pronunciation");
    stage = advanceHintStage(stage, "cat");
    assert.equal(getHintAction(stage, "cat"), "first-letter");
    stage = advanceHintStage(stage, "cat");
    assert.equal(getHintAction(stage, "cat"), "position");
    assert.equal(getHintAction(stage, "car"), "pronunciation");
  });

  test("uses the injected speech runtime and degrades safely when unavailable", () => {
    const spoken: Array<{ text: string; lang: string }> = [];
    const available = speakEnglishWord("cat", {
      createUtterance: (text) => ({ text, lang: "" }),
      cancel: () => undefined,
      speak: (utterance) => spoken.push(utterance)
    });

    assert.equal(available, true);
    assert.deepEqual(spoken, [{ text: "cat", lang: "en-US" }]);
    assert.equal(speakEnglishWord("cat", {}), false);
  });

  test("reports speech rejection instead of charging a clue", () => {
    const accepted = speakEnglishWord("cat", {
      createUtterance: (text) => ({ text, lang: "" }),
      cancel: () => undefined,
      speak: () => {
        throw new Error("speech blocked");
      }
    });

    assert.equal(accepted, false);
  });

  test("describes the next position when a crossing already shows the first cell", () => {
    const stage: HintStage = { wordId: "cat", interactions: 1 };

    assert.equal(getHintAction(stage, "cat", true), "position");
  });

  test("waits for speech start and reports an asynchronous rejection", () => {
    let started = 0;
    let failed = 0;
    const accepted = speakEnglishWord(
      "cat",
      {
        createUtterance: (text) => ({ text, lang: "" }),
        cancel: () => undefined,
        speak: (_utterance, callbacks) => {
          callbacks?.onFailed?.();
        }
      },
      {
        onStarted: () => {
          started += 1;
        },
        onFailed: () => {
          failed += 1;
        }
      }
    );

    assert.equal(accepted, true);
    assert.equal(started, 0);
    assert.equal(failed, 1);
  });

  test("reports only one failure when a speech runtime rejects and throws", () => {
    let failed = 0;
    const accepted = speakEnglishWord(
      "cat",
      {
        createUtterance: (text) => ({ text, lang: "" }),
        cancel: () => undefined,
        speak: (_utterance, callbacks) => {
          callbacks?.onFailed?.();
          throw new Error("late browser failure");
        }
      },
      {
        onFailed: () => {
          failed += 1;
        }
      }
    );

    assert.equal(accepted, false);
    assert.equal(failed, 1);
  });
});
