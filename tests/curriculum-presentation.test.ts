import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  getBookNumber,
  getDifficultyTranslationKey,
  getLessonRangeLabelValue,
  getLevelNumber,
  getUnitNumber
} from "../lib/curriculum-presentation";
import {
  getAllBooks,
  getLevelsByBookId,
  getUnitsByBookId
} from "../lib/curriculum-index";

describe("localized curriculum presentation", () => {
  test("derives stable human ordinals without exposing internal ids", () => {
    const fourthBook = getAllBooks()[3];
    assert.ok(fourthBook);
    assert.equal(getBookNumber(fourthBook.id), 4);

    const thirdUnit = getUnitsByBookId(fourthBook.id)[2];
    const lastLevel = getLevelsByBookId(fourthBook.id)[49];
    assert.ok(thirdUnit);
    assert.ok(lastLevel);
    assert.equal(getUnitNumber(thirdUnit), 3);
    assert.equal(getLevelNumber(lastLevel), 50);
  });

  test("normalizes lesson ranges and level difficulty into typed labels", () => {
    assert.equal(getLessonRangeLabelValue("Lessons 3-33"), "3–33");
    assert.equal(getLessonRangeLabelValue(undefined), undefined);
    assert.equal(getDifficultyTranslationKey("easy"), "level.starter");
    assert.equal(getDifficultyTranslationKey("medium"), "level.challenge");
  });
});
