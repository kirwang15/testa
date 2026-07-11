import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { resolve } from "node:path";

describe("phase one support routes", () => {
  test("provides dedicated review and settings routes", () => {
    assert.equal(existsSync(resolve("app/review/page.tsx")), true);
    assert.equal(existsSync(resolve("app/settings/page.tsx")), true);
  });

  test("routes completion review to review and keeps reset off the home page", () => {
    const completionActions = readFileSync("components/CompletionActions.tsx", "utf8");
    const homePage = readFileSync("app/page.tsx", "utf8");

    assert.match(completionActions, /href="\/review"/);
    assert.match(homePage, /href="\/settings"/);
    assert.doesNotMatch(homePage, /ResetProgressControl|resetProgress/);
  });

  test("sanitizes generated word-toggle labels and hides unsafe home word chips", () => {
    const homePage = readFileSync("app/page.tsx", "utf8");
    const wordSlots = readFileSync("components/WordSlots.tsx", "utf8");
    const meaningToggle = readFileSync("components/WordMeaningToggle.tsx", "utf8");

    assert.match(homePage, /isVocabularyAnswerSafeToDisplay/);
    assert.match(wordSlots, /sanitizeText=\{safeText\}/);
    assert.match(meaningToggle, /sanitizeText/);
  });

  test("labels settings as a parent control and shows review progress", () => {
    const settingsPage = readFileSync("app/settings/page.tsx", "utf8");
    const resetControl = readFileSync("components/ResetProgressControl.tsx", "utf8");
    const reviewPage = readFileSync("app/review/page.tsx", "utf8");

    assert.match(settingsPage, /Parent controls/);
    assert.match(resetControl, /Parent data controls/);
    assert.match(resetControl, /Yes, erase progress/);
    assert.match(resetControl, /Keep my progress/);
    assert.match(reviewPage, /待完成/);
    assert.match(reviewPage, /拼写练习/);
  });

  test("review is an answer-safe input session instead of an answer card list", () => {
    const reviewPage = readFileSync("app/review/page.tsx", "utf8");

    assert.match(reviewPage, /type="text"/);
    assert.match(reviewPage, /submitReviewWord/);
    assert.match(reviewPage, /answeredWord/);
    assert.doesNotMatch(reviewPage, /<h2[^>]*>\{word\.displayText\}<\/h2>/);
  });

  test("keys level games by route and protects reset confirmation focus", () => {
    const levelPage = readFileSync("app/levels/[levelId]/page.tsx", "utf8");
    const resetControl = readFileSync("components/ResetProgressControl.tsx", "utf8");

    assert.match(levelPage, /<LevelGame key=\{level\.id\}/);
    assert.match(resetControl, /aria-live/);
    assert.match(resetControl, /\.focus\(\)/);
  });

  test("keeps unit vocabulary previews behind the shared spelling gate", () => {
    const unitPage = readFileSync("components/UnitLevelsPage.tsx", "utf8");

    assert.match(unitPage, /buildSafeVocabularyPreviews/);
    assert.doesNotMatch(unitPage, />\{word\.displayText\}<\/p>/);
    assert.doesNotMatch(unitPage, /wordLabel=\{word\.displayText\}/);
  });

  test("settles level and review speech only through guarded callbacks", () => {
    const levelGame = readFileSync("components/LevelGame.tsx", "utf8");
    const reviewPage = readFileSync("app/review/page.tsx", "utf8");

    assert.match(levelGame, /confirmPronunciationHint/);
    assert.match(levelGame, /isSpeechRequestCurrent/);
    assert.match(reviewPage, /onStarted/);
    assert.match(reviewPage, /onFailed/);
    assert.match(reviewPage, /isSpeechRequestCurrent/);
    assert.doesNotMatch(reviewPage, /speakEnglishWord\([^)]*\)\) \{/);
  });
});
