import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { getLetterHintAction } from "../lib/hint-stage";
import { speakEnglishWord } from "../lib/speech";

describe("separate pronunciation and letter hints", () => {
  test("starts with a first-letter clue and advances only after that cell is visible", () => {
    assert.equal(getLetterHintAction(false), "first-letter");
    assert.equal(getLetterHintAction(true), "position");
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

  test("allows pronunciation to be played repeatedly without a staged transition", () => {
    const spoken: string[] = [];
    const runtime = {
      createUtterance: (text: string) => ({ text, lang: "" }),
      cancel: () => undefined,
      speak: (utterance: { text: string }) => spoken.push(utterance.text)
    };

    assert.equal(speakEnglishWord("cat", runtime), true);
    assert.equal(speakEnglishWord("cat", runtime), true);
    assert.deepEqual(spoken, ["cat", "cat"]);
    assert.equal(getLetterHintAction(false), "first-letter");
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
