"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import { createEmptyLevelProgress } from "@/lib/game";
import {
  applyHintUsage,
  applyWordSubmission,
  createInitialGameProgress,
  getSavedWordProgress,
  mergePersistedGameProgress,
  normalizeGameProgress
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
  setCurrentLevel: (levelId: string) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  submitWord: (level: Level, attempt: string) => SubmitWordResult;
  useHint: (level: Level) => HintResult;
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
      submitWord: (level, attempt) => {
        const { nextProgress, result } = applyWordSubmission(get(), level, attempt);
        set(nextProgress);
        return result;
      },
      useHint: (level) => {
        const { nextProgress, result } = applyHintUsage(get(), level);
        set(nextProgress);
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
