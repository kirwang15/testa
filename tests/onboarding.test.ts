import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  getOnboardingProfilePatch,
  getRecommendedInterfaceModeForAge,
  getRequiredOnboardingRoute
} from "../lib/onboarding";

describe("hydration-safe learner onboarding", () => {
  test("persists guided and immersion choices with English clues", () => {
    const guided = getOnboardingProfilePatch({
      nickname: "  Mia  ",
      ageBand: "7-9",
      interfaceMode: "guided"
    });
    const immersion = getOnboardingProfilePatch({
      nickname: "Leo",
      ageBand: "13-15",
      interfaceMode: "immersion"
    });

    assert.deepEqual(guided, {
      nickname: "Mia",
      ageBand: "7-9",
      preferences: {
        interfaceMode: "guided",
        uiLanguage: "zh-CN",
        clueLanguage: "en"
      },
      onboardingCompleted: true
    });
    assert.equal(immersion.preferences?.uiLanguage, "en");
    assert.equal(immersion.preferences?.clueLanguage, "en");
    assert.equal(immersion.onboardingCompleted, true);
  });

  test("recommends low-pressure guided UI for younger learners and immersion for teens", () => {
    assert.equal(getRecommendedInterfaceModeForAge("7-9"), "guided");
    assert.equal(getRecommendedInterfaceModeForAge("10-12"), "guided");
    assert.equal(getRecommendedInterfaceModeForAge("13-15"), "immersion");
  });

  test("redirects only hydrated incomplete profiles and never traps migrations", () => {
    assert.equal(getRequiredOnboardingRoute(false, "/", false), undefined);
    assert.equal(getRequiredOnboardingRoute(true, "/", false), "/onboarding");
    assert.equal(
      getRequiredOnboardingRoute(true, "/levels/example", false),
      "/onboarding"
    );
    assert.equal(
      getRequiredOnboardingRoute(true, "/onboarding", false),
      undefined
    );
    assert.equal(getRequiredOnboardingRoute(true, "/", true), undefined);
    assert.equal(
      getRequiredOnboardingRoute(true, "/onboarding", true),
      undefined
    );
  });
});
