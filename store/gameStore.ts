"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import { createEmptyLevelProgress } from "@/lib/game";
import {
  applyHintUsage,
  applyPronunciationHintUsage,
  applyConfirmedPronunciationHint,
  applyReviewSubmission,
  applyWordSubmission,
  createInitialGameProgress,
  getSavedWordProgress,
  mergePersistedGameProgress,
  normalizeGameProgress,
  restartLevelAttempt
} from "@/lib/progress";
import { GAME_STORAGE_KEY, getPersistedGameProgress } from "@/lib/storage";
import { toggleFavoriteWord } from "@/src/lib/learning-engine";
import type {
  GameProgress,
  HintResult,
  Level,
  LevelProgress,
  SubmitWordResult,
  WordLearningProgress
} from "@/types/game";

type GameStore = GameProgress & {
  hasHydrated: boolean;
  getLevelProgress: (levelId: string) => LevelProgress;
  getWordProgress: (wordId: string) => WordLearningProgress;
  normalizeProgress: () => void;
  resetProgress: () => void;
  restartLevelAttempt: (levelId: string) => void;
  setCurrentLevel: (levelId: string) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  submitWord: (
    level: Level,
    attempt: string,
    attemptProgress?: LevelProgress
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
    wordId: string,
    attempt: string
  ) => "correct" | "wrong" | "unknown-word";
  confirmPronunciationHint: (
    levelId: string,
    targetWordId: string
  ) => ReturnType<typeof applyConfirmedPronunciationHint>;
  toggleFavorite: (wordId: string) => void;
};

const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined
};

function getClientStorage() {
  return typeof window === "undefined" ? memoryStorage : window.localStorage;
}

const initialProgress = createInitialGameProgress();

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...initialProgress,
      hasHydrated: false,
      getLevelProgress: (levelId) => {
        return get().levels[levelId] ?? createEmptyLevelProgress();
      },
      getWordProgress: (wordId) => {
        return getSavedWordProgress(get(), wordId);
      },
      normalizeProgress: () => {
        set((state) => normalizeGameProgress(state));
      },
      resetProgress: () => {
        set(createInitialGameProgress());
      },
      restartLevelAttempt: (levelId) => {
        set((state) => restartLevelAttempt(state, levelId));
      },
      setCurrentLevel: (levelId) => {
        set((state) => {
          const normalized = normalizeGameProgress({
            ...state,
            currentLevelId: levelId
          });

          return normalized;
        });
      },
      setHasHydrated: (hasHydrated) => {
        set({ hasHydrated });
      },
      submitWord: (level, attempt, attemptProgress) => {
        const { nextProgress, result, attemptProgress: nextAttemptProgress } =
          applyWordSubmission(get(), level, attempt, attemptProgress);
        set(nextProgress);
        return { result, attemptProgress: nextAttemptProgress };
      },
      useHint: (level, attemptProgress, targetWordId) => {
        const { nextProgress, result, attemptProgress: nextAttemptProgress } =
          applyHintUsage(get(), level, attemptProgress, targetWordId);
        set(nextProgress);
        return { result, attemptProgress: nextAttemptProgress };
      },
      usePronunciationHint: (level, attemptProgress, targetWordId) => {
        const { nextProgress, attemptProgress: nextAttemptProgress } =
          applyPronunciationHintUsage(get(), level, attemptProgress, targetWordId);
        set(nextProgress);
        return { attemptProgress: nextAttemptProgress };
      },
      submitReviewWord: (wordId, attempt) => {
        const result = applyReviewSubmission(
          get(),
          wordId,
          attempt
        );
        set(result.nextProgress);
        return result.status;
      },
      confirmPronunciationHint: (levelId, targetWordId) => {
        const result = applyConfirmedPronunciationHint(
          get(),
          levelId,
          targetWordId
        );
        if (result.status === "applied") {
          set(result.nextProgress);
        }
        return result;
      },
      toggleFavorite: (wordId) => {
        set((state) => {
          const currentProgress = getSavedWordProgress(state, wordId);

          return normalizeGameProgress({
            ...state,
            words: {
              ...state.words,
              [wordId]: toggleFavoriteWord(currentProgress)
            }
          });
        });
      }
    }),
    {
      name: GAME_STORAGE_KEY,
      storage: createJSONStorage(getClientStorage),
      partialize: (state) => getPersistedGameProgress(state),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...mergePersistedGameProgress(persistedState, currentState)
      }),
      onRehydrateStorage: () => (state) => {
        state?.normalizeProgress();
        state?.setHasHydrated(true);
      }
    }
  )
);
