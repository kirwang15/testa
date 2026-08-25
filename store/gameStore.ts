"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import { createEmptyLevelProgress } from "../lib/game";
import {
  applyHintUsage,
  applyConfirmedPronunciationHint,
  applyPronunciationHintUsage,
  applyReviewSubmission,
  applyWordSubmission,
  createInitialGameProgress,
  getSavedWordProgress,
  normalizeGameProgress,
  restartLevelAttempt
} from "../lib/progress";
import {
  addPlayerProfile,
  createDefaultPlayerProfile,
  createInitialProfiledGameProgress,
  getActiveGameProgress,
  getActiveProfile,
  isProfileActionContextCurrent,
  migratePersistedGameState,
  normalizeProfiledGameProgress,
  removePlayerProfile,
  switchActiveProfile,
  updateActiveLearningPreferences,
  updatePlayerProfile
} from "../lib/profile-state";
import {
  GAME_STORAGE_KEY,
  GAME_STORAGE_VERSION,
  createSafeStateStorage,
  getPersistedProfiledGameProgress
} from "../lib/storage";
import {
  getLocalCalendarDateKey,
  toggleFavoriteWord
} from "../src/lib/learning-engine";
import type {
  AgeBand,
  GameProgress,
  HintResult,
  HydrationStatus,
  InterfaceMode,
  LearningPreferences,
  Level,
  LevelProgress,
  PlayerProfile,
  ProfileActionContext,
  ProfiledGameProgress,
  SubmitWordResult,
  WordLearningProgress
} from "../types/game";
import type { TutorialPhase } from "../types/game";
import {
  advanceTutorial,
  createFreshTutorialProgress,
  setTutorialCollapsed
} from "../lib/tutorial-progress";

export type CreateProfileInput = {
  nickname: string;
  ageBand: AgeBand;
  interfaceMode?: InterfaceMode;
  accent?: PlayerProfile["accent"];
  onboardingCompleted?: boolean;
};

export type GameStore = ProfiledGameProgress & {
  hasHydrated: boolean;
  hydrationStatus: HydrationStatus;
  activeActionSession: ProfileActionContext | null;
  addProfile: (input: CreateProfileInput) => string | undefined;
  deleteProfile: (profileId: string) => boolean;
  switchProfile: (profileId: string) => boolean;
  updateProfile: (
    profileId: string,
    patch: Partial<Omit<PlayerProfile, "id" | "createdAt">>
  ) => void;
  updatePreferences: (patch: Partial<LearningPreferences>) => void;
  advanceTutorial: (
    phase: TutorialPhase,
    options?: { firstWordDetailSeen?: boolean; levelCompleted?: boolean }
  ) => void;
  setTutorialCollapsed: (collapsed: boolean) => void;
  restartTutorial: () => void;
  getLevelProgress: (levelId: string) => LevelProgress;
  getWordProgress: (wordId: string) => WordLearningProgress;
  normalizeProgress: () => void;
  resetProgress: () => void;
  restartLevelAttempt: (levelId: string) => void;
  setCurrentLevel: (levelId: string) => void;
  beginActionSession: (context: ProfileActionContext) => boolean;
  endActionSession: (context: ProfileActionContext) => void;
  submitWord: (
    level: Level,
    attempt: string,
    attemptProgress?: LevelProgress,
    targetWordId?: string
  ) => { result: SubmitWordResult; attemptProgress: LevelProgress };
  useHint: (
    level: Level,
    attemptProgress?: LevelProgress,
    targetWordId?: string
  ) => { result: HintResult; attemptProgress: LevelProgress };
  usePronunciationHint: (
    level: Level,
    attemptProgress?: LevelProgress,
    targetWordId?: string
  ) => { attemptProgress: LevelProgress };
  submitReviewWord: (
    context: ProfileActionContext,
    wordId: string,
    attempt: string
  ) => "correct" | "wrong" | "unknown-word" | "stale";
  confirmPronunciationHint: (
    context: ProfileActionContext,
    targetWordId: string
  ) => ReturnType<typeof applyConfirmedPronunciationHint>;
  toggleFavorite: (wordId: string) => void;
};

const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined
};

let runtimeStorageStatus: HydrationStatus = "loading";
let applyingStorageStatus = false;
let storageStatusUpdateQueued = false;
let applyStorageStatusToStore: (() => void) | undefined;

function reportStorageStatus(status: Exclude<HydrationStatus, "loading">) {
  if (runtimeStorageStatus === "unsupported-version") {
    return;
  }
  if (status === "ready" && runtimeStorageStatus !== "loading") {
    return;
  }

  runtimeStorageStatus = status;
  if (!applyStorageStatusToStore || storageStatusUpdateQueued) {
    return;
  }

  storageStatusUpdateQueued = true;
  queueMicrotask(() => {
    storageStatusUpdateQueued = false;
    applyStorageStatusToStore?.();
  });
}

function getClientStorage() {
  let storage: StateStorage = memoryStorage;
  if (typeof window !== "undefined") {
    try {
      storage = window.localStorage;
    } catch {
      reportStorageStatus("recovered");
    }
  }
  return createSafeStateStorage(storage, {
    onStatus: reportStorageStatus,
    shouldSkipWrite: () => applyingStorageStatus
  });
}

function profiledState(state: GameStore): ProfiledGameProgress {
  return {
    storageVersion: state.storageVersion,
    contentVersion: state.contentVersion,
    profiles: state.profiles,
    activeProfileId: state.activeProfileId,
    progressByProfileId: state.progressByProfileId
  };
}

function replaceActiveProgress(
  state: GameStore,
  progress: GameProgress
): Partial<GameStore> {
  return {
    progressByProfileId: {
      ...state.progressByProfileId,
      [state.activeProfileId]: normalizeGameProgress(progress)
    }
  };
}

function createProfileId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `player-${crypto.randomUUID()}`;
  }

  return `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const initialState = createInitialProfiledGameProgress();

function mutationsAreBlocked(state: Pick<GameStore, "hydrationStatus">) {
  return state.hydrationStatus === "unsupported-version";
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      hasHydrated: false,
      hydrationStatus: "loading",
      activeActionSession: null,
      addProfile: (input) => {
        if (mutationsAreBlocked(get())) return undefined;
        const profileId = createProfileId();
        const profile = createDefaultPlayerProfile({
          id: profileId,
          nickname: input.nickname,
          ageBand: input.ageBand,
          preferences: {
            interfaceMode: input.interfaceMode ?? "guided",
            uiLanguage: input.interfaceMode === "immersion" ? "en" : "zh-CN",
            clueLanguage: "en"
          },
          accent: input.accent ?? "en-US",
          createdAt: new Date().toISOString(),
          onboardingCompleted: input.onboardingCompleted === true,
          tutorialProgress:
            input.onboardingCompleted === true
              ? advanceTutorial(createFreshTutorialProgress(), "home")
              : createFreshTutorialProgress()
        });
        set((state) => addPlayerProfile(profiledState(state), profile));
        return profileId;
      },
      deleteProfile: (profileId) => {
        if (mutationsAreBlocked(get())) return false;
        const current = profiledState(get());
        const next = removePlayerProfile(current, profileId);
        if (next === current) {
          return false;
        }
        set((state) => ({
          ...next,
          activeActionSession:
            state.activeActionSession?.profileId === profileId
              ? null
              : state.activeActionSession
        }));
        return true;
      },
      switchProfile: (profileId) => {
        if (mutationsAreBlocked(get())) return false;
        const current = profiledState(get());
        const next = switchActiveProfile(current, profileId);
        if (next === current) {
          return current.activeProfileId === profileId;
        }
        set({ ...next, activeActionSession: null });
        return true;
      },
      updateProfile: (profileId, patch) => {
        if (mutationsAreBlocked(get())) return;
        set((state) => updatePlayerProfile(profiledState(state), profileId, patch));
      },
      updatePreferences: (patch) => {
        if (mutationsAreBlocked(get())) return;
        set((state) =>
          updateActiveLearningPreferences(profiledState(state), patch)
        );
      },
      advanceTutorial: (phase, options) => {
        if (mutationsAreBlocked(get())) return;
        set((state) => {
          const profile = getActiveProfile(profiledState(state));
          return updatePlayerProfile(profiledState(state), profile.id, {
            tutorialProgress: advanceTutorial(
              profile.tutorialProgress,
              phase,
              options
            )
          });
        });
      },
      setTutorialCollapsed: (collapsed) => {
        if (mutationsAreBlocked(get())) return;
        set((state) => {
          const profile = getActiveProfile(profiledState(state));
          return updatePlayerProfile(profiledState(state), profile.id, {
            tutorialProgress: setTutorialCollapsed(
              profile.tutorialProgress,
              collapsed
            )
          });
        });
      },
      restartTutorial: () => {
        if (mutationsAreBlocked(get())) return;
        set((state) => {
          const profile = getActiveProfile(profiledState(state));
          return updatePlayerProfile(profiledState(state), profile.id, {
            tutorialProgress: createFreshTutorialProgress()
          });
        });
      },
      getLevelProgress: (levelId) => {
        const progress = getActiveGameProgress(profiledState(get()));
        return progress.levels[levelId] ?? createEmptyLevelProgress();
      },
      getWordProgress: (wordId) => {
        return getSavedWordProgress(
          getActiveGameProgress(profiledState(get())),
          wordId
        );
      },
      normalizeProgress: () => {
        if (mutationsAreBlocked(get())) return;
        set((state) => normalizeProfiledGameProgress(profiledState(state)));
      },
      resetProgress: () => {
        if (mutationsAreBlocked(get())) return;
        set((state) => replaceActiveProgress(state, createInitialGameProgress()));
      },
      restartLevelAttempt: (levelId) => {
        if (mutationsAreBlocked(get())) return;
        set((state) => {
          const progress = getActiveGameProgress(profiledState(state));
          return replaceActiveProgress(state, restartLevelAttempt(progress, levelId));
        });
      },
      setCurrentLevel: (levelId) => {
        if (mutationsAreBlocked(get())) return;
        set((state) => {
          const progress = getActiveGameProgress(profiledState(state));
          return replaceActiveProgress(
            state,
            normalizeGameProgress({ ...progress, currentLevelId: levelId })
          );
        });
      },
      beginActionSession: (context) => {
        const state = get();
        if (mutationsAreBlocked(state)) return false;
        if (context.profileId !== state.activeProfileId || !context.sessionId) {
          return false;
        }
        set({ activeActionSession: { ...context } });
        return true;
      },
      endActionSession: (context) => {
        set((state) =>
          isProfileActionContextCurrent(
            context,
            state.activeProfileId,
            state.activeActionSession,
            context.levelId
          )
            ? { activeActionSession: null }
            : {}
        );
      },
      submitWord: (level, attempt, attemptProgress, targetWordId) => {
        const state = get();
        const progress = getActiveGameProgress(profiledState(state));
        if (mutationsAreBlocked(state)) {
          return {
            result: { status: "read-only" as const, attempt },
            attemptProgress:
              attemptProgress ??
              progress.levels[level.id] ??
              createEmptyLevelProgress(level.layoutRevision)
          };
        }
        const result = applyWordSubmission(
          progress,
          level,
          attempt,
          attemptProgress,
          targetWordId,
          getLocalCalendarDateKey()
        );
        set(replaceActiveProgress(state, result.nextProgress));
        return {
          result: result.result,
          attemptProgress: result.attemptProgress
        };
      },
      useHint: (level, attemptProgress, targetWordId) => {
        const state = get();
        const progress = getActiveGameProgress(profiledState(state));
        if (mutationsAreBlocked(state)) {
          return {
            result: { status: "read-only" as const },
            attemptProgress:
              attemptProgress ??
              progress.levels[level.id] ??
              createEmptyLevelProgress(level.layoutRevision)
          };
        }
        const result = applyHintUsage(
          progress,
          level,
          attemptProgress,
          targetWordId,
          getLocalCalendarDateKey()
        );
        set(replaceActiveProgress(state, result.nextProgress));
        return {
          result: result.result,
          attemptProgress: result.attemptProgress
        };
      },
      usePronunciationHint: (level, attemptProgress, targetWordId) => {
        const state = get();
        const progress = getActiveGameProgress(profiledState(state));
        if (mutationsAreBlocked(state)) {
          return {
            attemptProgress:
              attemptProgress ??
              progress.levels[level.id] ??
              createEmptyLevelProgress(level.layoutRevision)
          };
        }
        const result = applyPronunciationHintUsage(
          progress,
          level,
          attemptProgress,
          targetWordId,
          getLocalCalendarDateKey()
        );
        set(replaceActiveProgress(state, result.nextProgress));
        return { attemptProgress: result.attemptProgress };
      },
      submitReviewWord: (context, wordId, attempt) => {
        const state = get();
        const progress = getActiveGameProgress(profiledState(state));
        if (mutationsAreBlocked(state)) return "stale";
        if (
          !isProfileActionContextCurrent(
            context,
            state.activeProfileId,
            state.activeActionSession,
            progress.currentLevelId
          )
        ) {
          return "stale";
        }
        const result = applyReviewSubmission(
          progress,
          wordId,
          attempt,
          getLocalCalendarDateKey()
        );
        set(replaceActiveProgress(state, result.nextProgress));
        return result.status;
      },
      confirmPronunciationHint: (context, targetWordId) => {
        const state = get();
        const progress = getActiveGameProgress(profiledState(state));
        const levelId = context.levelId ?? "";
        if (
          mutationsAreBlocked(state) ||
          !isProfileActionContextCurrent(
            context,
            state.activeProfileId,
            state.activeActionSession,
            progress.currentLevelId
          )
        ) {
          return {
            status: "stale" as const,
            nextProgress: progress,
            attemptProgress:
              progress.levels[levelId] ?? createEmptyLevelProgress()
          };
        }
        const result = applyConfirmedPronunciationHint(
          progress,
          levelId,
          targetWordId,
          getLocalCalendarDateKey()
        );
        if (result.status === "applied") {
          set(replaceActiveProgress(state, result.nextProgress));
        }
        return result;
      },
      toggleFavorite: (wordId) => {
        if (mutationsAreBlocked(get())) return;
        set((state) => {
          const progress = getActiveGameProgress(profiledState(state));
          const currentProgress = getSavedWordProgress(progress, wordId);
          return replaceActiveProgress(state, {
            ...progress,
            words: {
              ...progress.words,
              [wordId]: toggleFavoriteWord(currentProgress)
            }
          });
        });
      }
    }),
    {
      name: GAME_STORAGE_KEY,
      version: GAME_STORAGE_VERSION,
      storage: createJSONStorage(getClientStorage),
      partialize: (state) => getPersistedProfiledGameProgress(profiledState(state)),
      migrate: (persistedState, version) =>
        migratePersistedGameState(persistedState, version),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizeProfiledGameProgress(persistedState, profiledState(currentState)),
        hasHydrated: true,
        hydrationStatus:
          runtimeStorageStatus === "loading" ? "ready" : runtimeStorageStatus,
        activeActionSession: null
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          reportStorageStatus("recovered");
        }
      }
    }
  )
);

applyStorageStatusToStore = () => {
  const state = useGameStore.getState();
  const nextStatus =
    runtimeStorageStatus === "loading" ? "ready" : runtimeStorageStatus;
  if (state.hasHydrated && state.hydrationStatus === nextStatus) {
    return;
  }

  applyingStorageStatus = true;
  try {
    useGameStore.setState({
      hasHydrated: true,
      hydrationStatus: nextStatus
    });
  } finally {
    applyingStorageStatus = false;
  }
};
applyStorageStatusToStore();

export function selectActiveProfile(state: GameStore) {
  return getActiveProfile(profiledState(state));
}

export function selectActiveGameProgress(state: GameStore) {
  return getActiveGameProgress(profiledState(state));
}

export function selectHydrationStatus(state: GameStore) {
  return state.hydrationStatus;
}

export function selectIsReadOnly(state: GameStore) {
  return mutationsAreBlocked(state);
}
