import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  buildLevelHref,
  getDirectLevelFallback,
  sanitizeLevelReturnTo
} from "../lib/level-navigation";

describe("controlled level return navigation", () => {
  test("accepts only known internal entry surfaces", () => {
    assert.equal(sanitizeLevelReturnTo("/"), "/");
    assert.equal(sanitizeLevelReturnTo("/review"), "/review");
    assert.equal(
      sanitizeLevelReturnTo("/courses/ielts-nawl-v1"),
      "/courses/ielts-nawl-v1"
    );
    assert.equal(
      sanitizeLevelReturnTo("/map?book=nce-1997-b2"),
      "/map?book=nce-1997-b2"
    );
    assert.equal(
      sanitizeLevelReturnTo("/books/nce-1997-b1/units/nce-1997-b1-u1"),
      "/books/nce-1997-b1/units/nce-1997-b1-u1"
    );
    assert.equal(sanitizeLevelReturnTo("https://evil.example"), undefined);
    assert.equal(sanitizeLevelReturnTo("//evil.example/path"), undefined);
    assert.equal(sanitizeLevelReturnTo("/settings"), undefined);
    assert.equal(sanitizeLevelReturnTo("/map?book=x&next=https://evil.example"), undefined);
  });

  test("inherits a safe return target across replacement navigation", () => {
    assert.equal(
      buildLevelHref("ielts-nawl-v1-level-002", "/courses/ielts-nawl-v1"),
      "/levels/ielts-nawl-v1-level-002?returnTo=%2Fcourses%2Fielts-nawl-v1"
    );
    assert.equal(
      buildLevelHref("nce-1997-b1-level-002", "//evil.example"),
      "/levels/nce-1997-b1-level-002"
    );
  });

  test("deep links fall back to the owning course surface", () => {
    assert.equal(getDirectLevelFallback("nce-1997", "nce-1997-b3"), "/books/nce-1997-b3");
    assert.equal(getDirectLevelFallback("ielts-nawl-v1", "ielts"), "/courses/ielts-nawl-v1");
  });
});
