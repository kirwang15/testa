import assert from "node:assert/strict";
import { resolve } from "node:path";
import { describe, test } from "node:test";

type LeakWord = {
  id: string;
  word: string;
  englishMeaning: string;
  chineseMeaning: string;
};

const { scanTextForLeaks } = require(resolve(
  process.cwd(),
  "scripts/bundle-boundary-helpers.cjs"
)) as {
  scanTextForLeaks: (
    text: string,
    words: readonly LeakWord[]
  ) => { token: string; label: string } | undefined;
};

const target: LeakWord = {
  id: "nce-1997-b1-what",
  word: "WHAT",
  englishMeaning: "Question word asking for a thing",
  chineseMeaning: "给"
};

describe("build answer-boundary leak matcher", () => {
  test("detects route-specific ids, structured answers, and exact clues", () => {
    assert.match(
      scanTextForLeaks("payload nce-1997-b1-what", [target])?.label ?? "",
      /word id/
    );
    assert.match(
      scanTextForLeaks('{"word":"WHAT"}', [target])?.label ?? "",
      /word/
    );
    assert.match(
      scanTextForLeaks("Question word asking for a thing", [target])?.label ?? "",
      /English clue/
    );
    assert.match(
      scanTextForLeaks("<p>给</p>", [target])?.label ?? "",
      /Chinese clue/
    );
  });

  test("does not flag common short UI text or another route's answer", () => {
    assert.equal(scanTextForLeaks("把提示给孩子看", [target]), undefined);
    assert.equal(
      scanTextForLeaks('{"word":"HERE","id":"nce-1997-b1-here"}', [target]),
      undefined
    );
  });
});
