import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  addPlayerProfile,
  createDefaultPlayerProfile,
  createInitialProfiledGameProgress,
  switchActiveProfile
} from "../lib/profile-state";
import { getLevelById } from "../lib/levelLoader";
import { useGameStore } from "../store/gameStore";
import type { ProfileActionContext, ProfiledGameProgress } from "../types/game";

function restoreStore(state: ProfiledGameProgress) {
  useGameStore.setState({
    ...state,
    hasHydrated: true,
    hydrationStatus: "ready",
    activeActionSession: null
  });
}

describe("profile action store boundary", () => {
  test("unsupported future saves make every persisted store mutation a no-op", () => {
    const initial = createInitialProfiledGameProgress();
    const withSecond = addPlayerProfile(
      initial,
      createDefaultPlayerProfile({ id: "teen", nickname: "Teen" })
    );
    withSecond.progressByProfileId[withSecond.activeProfileId]!.coins = 31;
    restoreStore(withSecond);
    useGameStore.setState({ hydrationStatus: "unsupported-version" });

    const level = getLevelById("nce-1-u1-level-1");
    assert.ok(level);
    const target = level.targetWords[0];
    assert.ok(target);
    const wordId = target.vocabularyWordId;
    assert.ok(wordId);
    const before = structuredClone({
      profiles: useGameStore.getState().profiles,
      activeProfileId: useGameStore.getState().activeProfileId,
      progressByProfileId: useGameStore.getState().progressByProfileId
    });
    const context: ProfileActionContext = {
      profileId: before.activeProfileId,
      sessionId: "readonly:1",
      levelId: level.id
    };

    assert.equal(
      useGameStore.getState().addProfile({ nickname: "Blocked", ageBand: "7-9" }),
      undefined
    );
    assert.equal(useGameStore.getState().deleteProfile("teen"), false);
    assert.equal(useGameStore.getState().switchProfile("teen"), false);
    useGameStore.getState().updateProfile(before.activeProfileId, { nickname: "Changed" });
    useGameStore.getState().updatePreferences({ uiLanguage: "en" });
    useGameStore.getState().normalizeProgress();
    useGameStore.getState().resetProgress();
    useGameStore.getState().restartLevelAttempt(level.id);
    useGameStore.getState().setCurrentLevel(level.id);
    assert.equal(
      useGameStore.getState().submitWord(level, target.word, undefined, target.id).result.status,
      "read-only"
    );
    assert.equal(useGameStore.getState().useHint(level, undefined, target.id).result.status, "read-only");
    useGameStore.getState().usePronunciationHint(level, undefined, target.id);
    assert.equal(useGameStore.getState().beginActionSession(context), false);
    assert.equal(
      useGameStore.getState().submitReviewWord(context, wordId, target.word),
      "stale"
    );
    assert.equal(
      useGameStore.getState().confirmPronunciationHint(context, target.id).status,
      "stale"
    );
    useGameStore.getState().toggleFavorite(wordId);

    assert.deepEqual(
      {
        profiles: useGameStore.getState().profiles,
        activeProfileId: useGameStore.getState().activeProfileId,
        progressByProfileId: useGameStore.getState().progressByProfileId
      },
      before
    );
    assert.equal(
      useGameStore.getState().progressByProfileId[before.activeProfileId]?.coins,
      before.progressByProfileId[before.activeProfileId]?.coins
    );
  });

  test("a delayed pronunciation callback cannot mutate a newly active profile", () => {
    const initial = createInitialProfiledGameProgress();
    const withSecond = addPlayerProfile(
      initial,
      createDefaultPlayerProfile({ id: "teen", nickname: "Teen" })
    );
    restoreStore(switchActiveProfile(withSecond, "local-player"));

    const level = getLevelById("nce-1-u1-level-1");
    assert.ok(level);
    const target = level.targetWords[0];
    assert.ok(target);
    useGameStore.getState().setCurrentLevel(level.id);
    const context: ProfileActionContext = {
      profileId: "local-player",
      sessionId: "level:local-player:1",
      levelId: level.id
    };
    assert.equal(useGameStore.getState().beginActionSession(context), true);
    assert.equal(useGameStore.getState().switchProfile("teen"), true);
    const before = structuredClone(useGameStore.getState().progressByProfileId);

    const result = useGameStore
      .getState()
      .confirmPronunciationHint(context, target.id);

    assert.equal(result.status, "stale");
    assert.deepEqual(useGameStore.getState().progressByProfileId, before);
  });

  test("a delayed pronunciation callback cannot cross a level boundary", () => {
    restoreStore(createInitialProfiledGameProgress());
    const level = getLevelById("nce-1-u1-level-1");
    const nextLevel = getLevelById("nce-1-u1-level-2");
    assert.ok(level);
    assert.ok(nextLevel);
    const target = level.targetWords[0];
    assert.ok(target);
    useGameStore.getState().setCurrentLevel(level.id);
    const context: ProfileActionContext = {
      profileId: "local-player",
      sessionId: "level:local-player:2",
      levelId: level.id
    };
    useGameStore.getState().beginActionSession(context);
    useGameStore.getState().setCurrentLevel(nextLevel.id);
    const before = structuredClone(useGameStore.getState().progressByProfileId);

    const result = useGameStore
      .getState()
      .confirmPronunciationHint(context, target.id);

    assert.equal(result.status, "stale");
    assert.deepEqual(useGameStore.getState().progressByProfileId, before);
  });

  test("a delayed review submission cannot cross a session boundary", () => {
    restoreStore(createInitialProfiledGameProgress());
    const level = getLevelById("nce-1-u1-level-1");
    assert.ok(level);
    const wordId = level.targetWords[0]?.vocabularyWordId;
    assert.ok(wordId);
    const firstContext: ProfileActionContext = {
      profileId: "local-player",
      sessionId: "review:local-player:1"
    };
    const secondContext: ProfileActionContext = {
      profileId: "local-player",
      sessionId: "review:local-player:2"
    };
    useGameStore.getState().beginActionSession(firstContext);
    useGameStore.getState().beginActionSession(secondContext);
    const before = structuredClone(useGameStore.getState().progressByProfileId);

    const status = useGameStore
      .getState()
      .submitReviewWord(firstContext, wordId, "definitely-wrong");

    assert.equal(status, "stale");
    assert.deepEqual(useGameStore.getState().progressByProfileId, before);
  });
});
