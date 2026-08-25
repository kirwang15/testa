import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  addPlayerProfile,
  createDefaultPlayerProfile,
  createInitialProfiledGameProgress,
  getActiveGameProgress,
  getActiveProfile,
  getDefaultLearningPreferences,
  getDocumentLanguage,
  isProfileActionContextCurrent,
  migratePersistedGameState,
  normalizeProfiledGameProgress,
  removePlayerProfile,
  setActiveGameProgress,
  switchActiveProfile,
  updateActiveLearningPreferences
} from "../lib/profile-state";
import {
  createSafeStateStorage,
  deserializePersistedProfiledGameProgress,
  GAME_CONTENT_VERSION,
  GAME_STORAGE_VERSION,
  inspectStoredEnvelope,
  serializePersistedProfiledGameProgress
} from "../lib/storage";
import { createInitialGameProgress } from "../lib/progress";
import type { PlayerProfile } from "../types/game";

describe("profiled progress v4", () => {
  test("creates a guided local profile with English clues for a fresh install", () => {
    const state = createInitialProfiledGameProgress();
    const profile = getActiveProfile(state);

    assert.equal(profile.ageBand, "10-12");
    assert.equal(profile.onboardingCompleted, false);
    assert.equal(state.storageVersion, 4);
    assert.equal(profile.tutorialProgress.phase, "intro");
    assert.equal(profile.tutorialProgress.status, "in-progress");
    assert.equal(state.contentVersion, GAME_CONTENT_VERSION);
    assert.deepEqual(profile.preferences, {
      interfaceMode: "guided",
      uiLanguage: "zh-CN",
      clueLanguage: "en"
    });
    assert.equal(getActiveGameProgress(state).coins, 100);
  });

  test("starts an explicitly onboarded new profile at the contextual home tutorial", () => {
    const profile = createDefaultPlayerProfile({
      id: "settings-profile",
      onboardingCompleted: true
    });

    assert.equal(profile.tutorialProgress.status, "in-progress");
    assert.equal(profile.tutorialProgress.phase, "home");
  });

  test("repairs an onboarded profile that was persisted at the pre-home intro phase", () => {
    const restored = normalizeProfiledGameProgress({
      profiles: {
        learner: {
          id: "learner",
          nickname: "Learner",
          onboardingCompleted: true,
          tutorialProgress: {
            version: 1,
            status: "in-progress",
            phase: "intro",
            tutorialLevelId: "nce-1997-b1-level-001",
            firstWordDetailSeen: false,
            collapsed: false
          }
        }
      },
      activeProfileId: "learner",
      progressByProfileId: { learner: createInitialGameProgress() }
    });

    assert.equal(restored.profiles.learner?.tutorialProgress.phase, "home");
  });

  test("migrates a v1 flat save once and preserves progress as Legacy-compatible ids", () => {
    const legacy = {
      coins: 147,
      currentLevelId: "nce-1-u1-level-1",
      levels: {
        "nce-1-u1-level-1": {
          completed: true,
          foundWords: ["nce-1-u1-level-1-word-1"],
          bestStars: 2
        }
      },
      words: {
        "nce-1-u1-cat": {
          wordId: "nce-1-u1-cat",
          correctCount: 2,
          masteryLevel: 2,
          favorite: true
        }
      },
      studyStats: {}
    };
    const migrated = migratePersistedGameState(legacy);
    const migratedAgain = migratePersistedGameState(migrated);
    const profile = getActiveProfile(migrated);

    assert.equal(profile.ageBand, "10-12");
    assert.equal(profile.onboardingCompleted, true);
    assert.equal(profile.preferences.interfaceMode, "guided");
    assert.equal(getActiveGameProgress(migrated).coins, 147);
    assert.equal(
      getActiveGameProgress(migrated).words["legacy:nce-1-u1-cat"]?.favorite,
      true
    );
    assert.deepEqual(migratedAgain, migrated);
  });

  test("safely normalizes corrupted v2 records without losing the only profile", () => {
    const restored = normalizeProfiledGameProgress({
      profiles: {
        child: {
          id: "child",
          nickname: "",
          ageBand: "adult",
          preferences: {
            interfaceMode: "broken",
            uiLanguage: "fr",
            clueLanguage: "both"
          },
          accent: "broken",
          createdAt: 12,
          onboardingCompleted: "yes",
          contentAccessLevel: "parent-review",
          contentAccessOverride: false
        }
      },
      activeProfileId: "missing",
      progressByProfileId: { child: { coins: -20, levels: "bad" } }
    });
    const profile = getActiveProfile(restored);

    assert.equal(restored.activeProfileId, "child");
    assert.equal(profile.nickname, "Explorer");
    assert.equal(profile.ageBand, "10-12");
    assert.deepEqual(profile.preferences, getDefaultLearningPreferences());
    assert.equal(profile.onboardingCompleted, false);
    assert.equal(profile.contentAccessLevel, "all-ages");
    assert.equal(profile.contentAccessOverride, false);
    assert.equal(getActiveGameProgress(restored).coins, 100);
  });

  test("treats profile map keys as authoritative when embedded ids collide", () => {
    const restored = normalizeProfiledGameProgress({
      profiles: {
        childA: { id: "childB", nickname: "A" },
        childB: { id: "childB", nickname: "B" }
      },
      activeProfileId: "childA",
      progressByProfileId: {
        childA: { coins: 111 },
        childB: { coins: 222 }
      }
    });

    assert.deepEqual(Object.keys(restored.profiles).sort(), ["childA", "childB"]);
    assert.equal(restored.profiles.childA?.id, "childA");
    assert.equal(restored.profiles.childA?.nickname, "A");
    assert.equal(restored.profiles.childB?.id, "childB");
    assert.equal(restored.progressByProfileId.childA?.coins, 111);
    assert.equal(restored.progressByProfileId.childB?.coins, 222);
  });

  test("isolates progress and language preferences between profiles", () => {
    const first = createInitialProfiledGameProgress();
    const secondProfile = createDefaultPlayerProfile({
      id: "teen",
      nickname: "Teen",
      ageBand: "13-15",
      preferences: getDefaultLearningPreferences("immersion")
    });
    const withSecond = addPlayerProfile(first, secondProfile);
    const teenProgress = {
      ...getActiveGameProgress(withSecond),
      coins: 222
    };
    const teenUpdated = updateActiveLearningPreferences(
      setActiveGameProgress(withSecond, teenProgress),
      { clueLanguage: "zh-CN" }
    );
    const backToFirst = switchActiveProfile(teenUpdated, "local-player");

    assert.equal(getActiveGameProgress(teenUpdated).coins, 222);
    assert.equal(getActiveProfile(teenUpdated).preferences.uiLanguage, "en");
    assert.equal(getActiveProfile(teenUpdated).preferences.clueLanguage, "zh-CN");
    assert.equal(getActiveGameProgress(backToFirst).coins, 100);
    assert.equal(getActiveProfile(backToFirst).preferences.uiLanguage, "zh-CN");
    assert.equal(getActiveProfile(backToFirst).preferences.clueLanguage, "en");
  });

  test("switching UI language never changes clue language", () => {
    const state = createInitialProfiledGameProgress();
    const updated = updateActiveLearningPreferences(state, { uiLanguage: "en" });

    assert.equal(getActiveProfile(updated).preferences.uiLanguage, "en");
    assert.equal(getActiveProfile(updated).preferences.clueLanguage, "en");
    assert.equal(getDocumentLanguage("zh-CN"), "zh-CN");
    assert.equal(getDocumentLanguage("en"), "en");
  });

  test("protects the final profile and removes an inactive profile with its progress", () => {
    const initial = createInitialProfiledGameProgress();
    assert.equal(removePlayerProfile(initial, "local-player"), initial);

    const withSecond = addPlayerProfile(
      initial,
      createDefaultPlayerProfile({ id: "second", nickname: "Second" })
    );
    const unknownSwitch = switchActiveProfile(withSecond, "missing");
    const removed = removePlayerProfile(unknownSwitch, "second");

    assert.equal(unknownSwitch, withSecond);
    assert.equal(removed.activeProfileId, "local-player");
    assert.equal(removed.profiles.second, undefined);
    assert.equal(removed.progressByProfileId.second, undefined);
  });

  test("serializes a version 4 profile container with its content version", () => {
    const state = createInitialProfiledGameProgress();
    const raw = serializePersistedProfiledGameProgress(state);
    const envelope = JSON.parse(raw) as {
      version: number;
      state: Record<string, unknown>;
    };
    const restored = deserializePersistedProfiledGameProgress(raw);

    assert.equal(envelope.version, GAME_STORAGE_VERSION);
    assert.deepEqual(Object.keys(envelope.state).sort(), [
      "activeProfileId",
      "contentVersion",
      "profiles",
      "progressByProfileId",
      "storageVersion"
    ]);
    assert.equal("hasHydrated" in envelope.state, false);
    assert.deepEqual(restored, migratePersistedGameState(state));
    assert.equal(deserializePersistedProfiledGameProgress("{broken"), undefined);
  });

  test("accepts a version 1 envelope and migrates it idempotently", () => {
    const legacyEnvelope = {
      version: 1,
      state: {
        coins: 188,
        levels: {},
        words: {},
        studyStats: {}
      }
    };
    const migrated = migratePersistedGameState(legacyEnvelope);

    assert.equal(getActiveGameProgress(migrated).coins, 188);
    assert.deepEqual(migratePersistedGameState(migrated), migrated);
  });

  test("migrates a version 2 profile envelope idempotently", () => {
    const v2State = createInitialProfiledGameProgress();
    const envelope = {
      version: 2,
      state: {
        profiles: v2State.profiles,
        activeProfileId: v2State.activeProfileId,
        progressByProfileId: v2State.progressByProfileId
      }
    };
    const migrated = migratePersistedGameState(envelope);

    assert.equal(migrated.storageVersion, 4);
    assert.ok(migrated.contentVersion);
    assert.deepEqual(migratePersistedGameState(migrated), migrated);
  });

  test("migrates v3 to v4 without forcing an existing learner through the tutorial", () => {
    const existing = createDefaultPlayerProfile({
      id: "existing",
      nickname: "Existing",
      onboardingCompleted: true
    });
    const { tutorialProgress: _removed, ...v3Profile } = existing;
    const migrated = migratePersistedGameState({
      version: 3,
      state: {
        storageVersion: 3,
        contentVersion: "older-content",
        profiles: { existing: v3Profile },
        activeProfileId: "existing",
        progressByProfileId: {
          existing: { ...createInitialGameProgress(), coins: 321 }
        }
      }
    });

    assert.equal(migrated.storageVersion, 4);
    assert.equal(migrated.profiles.existing?.tutorialProgress.status, "completed");
    assert.equal(getActiveGameProgress(migrated).coins, 321);
    assert.deepEqual(migratePersistedGameState(migrated), migrated);
  });

  test("treats truly old version 2 profiles without onboarding state as onboarded", () => {
    const initial = createInitialProfiledGameProgress();
    const oldProfile = { ...initial.profiles[initial.activeProfileId] } as Partial<
      PlayerProfile
    >;
    delete oldProfile.onboardingCompleted;
    const migrated = migratePersistedGameState({
      version: 2,
      state: {
        profiles: { old_child: { ...oldProfile, id: "old_child" } },
        activeProfileId: "old_child",
        progressByProfileId: { old_child: createInitialGameProgress() }
      }
    });

    assert.equal(migrated.profiles.old_child?.onboardingCompleted, true);
    assert.equal(createInitialProfiledGameProgress().profiles["local-player"]?.onboardingCompleted, false);
  });

  test("fails closed on a future storage version and leaves it read-only", () => {
    const raw = JSON.stringify({ version: 999, state: { coins: 999 } });
    const inspection = inspectStoredEnvelope(raw);
    const writes: string[] = [];
    const statuses: string[] = [];
    const safeStorage = createSafeStateStorage(
      {
        getItem: () => raw,
        setItem: (_name, value) => {
          writes.push(value);
        },
        removeItem: () => {
          writes.push("removed");
        }
      },
      { onStatus: (status) => statuses.push(status) }
    );

    assert.deepEqual(inspection, {
      status: "unsupported-version",
      raw: null,
      version: 999
    });
    assert.equal(safeStorage.getItem("word-trail-mvp-progress"), null);
    safeStorage.setItem("word-trail-mvp-progress", "replacement");
    safeStorage.removeItem("word-trail-mvp-progress");
    assert.deepEqual(writes, []);
    assert.deepEqual(statuses, ["unsupported-version"]);
    assert.equal(deserializePersistedProfiledGameProgress(raw), undefined);
  });

  test("fails closed for future inner versions and incompatible envelope pairs", () => {
    const futureInner = JSON.stringify({
      version: GAME_STORAGE_VERSION,
      state: {
        ...createInitialProfiledGameProgress(),
        storageVersion: 999
      }
    });
    const mismatched = JSON.stringify({
      version: 2,
      state: createInitialProfiledGameProgress()
    });

    assert.deepEqual(inspectStoredEnvelope(futureInner), {
      status: "unsupported-version",
      raw: null,
      version: 999
    });
    assert.deepEqual(inspectStoredEnvelope(mismatched), {
      status: "unsupported-version",
      raw: null,
      version: 4
    });
    assert.throws(
      () => migratePersistedGameState(JSON.parse(futureInner)),
      /Unsupported Word Trail storage version: 999/
    );
    assert.throws(
      () => migratePersistedGameState(JSON.parse(mismatched)),
      /Unsupported Word Trail storage version: 4/
    );
    assert.equal(deserializePersistedProfiledGameProgress(futureInner), undefined);
    assert.equal(deserializePersistedProfiledGameProgress(mismatched), undefined);
  });

  test("preserves an unsupported raw save and blocks replacement writes", () => {
    const raw = JSON.stringify({
      version: GAME_STORAGE_VERSION,
      state: {
        ...createInitialProfiledGameProgress(),
        storageVersion: 99
      }
    });
    let stored = raw;
    const statuses: string[] = [];
    const storage = createSafeStateStorage(
      {
        getItem: () => stored,
        setItem: (_name, value) => {
          stored = value;
        },
        removeItem: () => {
          stored = "";
        }
      },
      { onStatus: (status) => statuses.push(status) }
    );

    assert.equal(storage.getItem("save"), null);
    storage.setItem("save", "replacement");
    storage.removeItem("save");
    assert.equal(stored, raw);
    assert.deepEqual(statuses, ["unsupported-version"]);
  });

  test("fails closed before wrapping a flat future-version save", () => {
    for (const version of [5, 999]) {
      const raw = JSON.stringify({
        storageVersion: version,
        profiles: {},
        progressByProfileId: {}
      });
      let stored = raw;
      const statuses: string[] = [];
      const storage = createSafeStateStorage(
        {
          getItem: () => stored,
          setItem: (_name, value) => {
            stored = value;
          },
          removeItem: () => {
            stored = "";
          }
        },
        { onStatus: (status) => statuses.push(status) }
      );

      assert.deepEqual(inspectStoredEnvelope(raw), {
        status: "unsupported-version",
        raw: null,
        version
      });
      assert.equal(storage.getItem("save"), null);
      storage.setItem("save", "replacement");
      storage.removeItem("save");
      assert.equal(stored, raw);
      assert.deepEqual(statuses, ["unsupported-version"]);
      assert.throws(
        () => migratePersistedGameState(JSON.parse(raw)),
        new RegExp(`Unsupported Word Trail storage version: ${version}`)
      );
      assert.equal(deserializePersistedProfiledGameProgress(raw), undefined);
    }
  });

  test("recovers a malformed flat legacy object without trusting its version", () => {
    const raw = JSON.stringify({
      storageVersion: "999",
      profiles: "broken",
      progressByProfileId: null
    });
    const inspection = inspectStoredEnvelope(raw);
    assert.equal(inspection.status, "recovered");
    assert.equal(
      JSON.parse(inspection.raw ?? "null").version,
      1
    );
    assert.doesNotThrow(() => migratePersistedGameState(JSON.parse(raw)));
  });

  test("recovers from malformed reads and swallows quota write failures", () => {
    const statuses: string[] = [];
    const malformedStorage = createSafeStateStorage(
      {
        getItem: () => "{broken",
        setItem: () => {
          throw new DOMException("full", "QuotaExceededError");
        },
        removeItem: () => {
          throw new Error("blocked");
        }
      },
      { onStatus: (status) => statuses.push(status) }
    );

    assert.equal(malformedStorage.getItem("word-trail-mvp-progress"), null);
    assert.doesNotThrow(() =>
      malformedStorage.setItem("word-trail-mvp-progress", "valid")
    );
    assert.doesNotThrow(() =>
      malformedStorage.removeItem("word-trail-mvp-progress")
    );
    assert.deepEqual(statuses, ["recovered", "write-failed", "write-failed"]);

    const getStatuses: string[] = [];
    const blockedReadStorage = createSafeStateStorage(
      {
        getItem: () => {
          throw new DOMException("blocked", "SecurityError");
        },
        setItem: () => undefined,
        removeItem: () => undefined
      },
      { onStatus: (status) => getStatuses.push(status) }
    );
    assert.doesNotThrow(() =>
      blockedReadStorage.getItem("word-trail-mvp-progress")
    );
    assert.equal(blockedReadStorage.getItem("word-trail-mvp-progress"), null);
    assert.deepEqual(getStatuses, ["recovered", "recovered"]);
  });

  test("rejects delayed actions after a profile, level, or session change", () => {
    const expected = {
      profileId: "childA",
      sessionId: "level:childA:1",
      levelId: "level-1"
    };

    assert.equal(
      isProfileActionContextCurrent(expected, "childA", expected, "level-1"),
      true
    );
    assert.equal(
      isProfileActionContextCurrent(expected, "childB", expected, "level-1"),
      false
    );
    assert.equal(
      isProfileActionContextCurrent(
        expected,
        "childA",
        { ...expected, sessionId: "level:childA:2" },
        "level-1"
      ),
      false
    );
    assert.equal(
      isProfileActionContextCurrent(expected, "childA", expected, "level-2"),
      false
    );
  });
});
