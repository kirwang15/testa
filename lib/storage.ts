import { normalizeGameProgress } from "./progress";
import {
  CURRENT_CONTENT_VERSION,
  migratePersistedGameState,
  normalizeProfiledGameProgress,
  PROFILED_PROGRESS_STORAGE_VERSION,
  UnsupportedStorageVersionError
} from "./profile-state";
import type { StateStorage } from "zustand/middleware";
import type {
  GameProgress,
  HydrationStatus,
  ProfiledGameProgress
} from "../types/game";

export const GAME_STORAGE_KEY = "word-trail-mvp-progress";
export const GAME_STORAGE_VERSION = PROFILED_PROGRESS_STORAGE_VERSION;
export const GAME_CONTENT_VERSION = CURRENT_CONTENT_VERSION;

type PersistedEnvelope = {
  state: unknown;
  version: number;
};

type StorageEnvelopeInspection =
  | { status: "empty"; raw: null }
  | { status: "ready"; raw: string }
  | { status: "recovered"; raw: string | null }
  | { status: "unsupported-version"; raw: null; version: number };

type SafeStorageOptions = {
  onStatus?: (status: Exclude<HydrationStatus, "loading">) => void;
  shouldSkipWrite?: () => boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function inspectStoredEnvelope(
  raw: string | null,
  currentVersion = GAME_STORAGE_VERSION
): StorageEnvelopeInspection {
  if (!raw) {
    return { status: "empty", raw: null };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return { status: "recovered", raw: JSON.stringify({ state: {}, version: 1 }) };
    }

    const envelopeVersion =
      typeof parsed.version === "number" && Number.isFinite(parsed.version)
        ? parsed.version
        : undefined;
    const flatStateVersion =
      !("state" in parsed) &&
      typeof parsed.storageVersion === "number" &&
      Number.isFinite(parsed.storageVersion)
        ? parsed.storageVersion
        : undefined;
    const innerVersion =
      isRecord(parsed.state) &&
      typeof parsed.state.storageVersion === "number" &&
      Number.isFinite(parsed.state.storageVersion)
        ? parsed.state.storageVersion
        : undefined;
    const unsupportedVersion = [
      envelopeVersion,
      innerVersion,
      flatStateVersion
    ].find(
      (version): version is number =>
        typeof version === "number" && version > currentVersion
    );
    const incompatibleVersionPair =
      typeof envelopeVersion === "number" &&
      typeof innerVersion === "number" &&
      envelopeVersion !== innerVersion;

    if (unsupportedVersion !== undefined || incompatibleVersionPair) {
      return {
        status: "unsupported-version",
        raw: null,
        version: unsupportedVersion ?? Math.max(envelopeVersion!, innerVersion!)
      };
    }

    if ("state" in parsed) {
      if (!isRecord(parsed.state)) {
        return { status: "recovered", raw: JSON.stringify({ state: {}, version: 1 }) };
      }

      return {
        status: typeof parsed.version === "number" ? "ready" : "recovered",
        raw: JSON.stringify({
          state: parsed.state,
          version: envelopeVersion ?? innerVersion ?? 1
        })
      };
    }

    // Very early builds stored the flat progress object without Zustand's
    // envelope. Wrap it as v1 so the existing lossless migration can run.
    return {
      status: "recovered",
      raw: JSON.stringify({ state: parsed, version: flatStateVersion ?? 1 })
    };
  } catch {
    return { status: "recovered", raw: null };
  }
}

export function createSafeStateStorage(
  storage: StateStorage,
  options: SafeStorageOptions = {}
): StateStorage {
  let writesBlockedByFutureVersion = false;

  const inspect = (raw: string | null) => {
    const result = inspectStoredEnvelope(raw);
    if (result.status === "unsupported-version") {
      writesBlockedByFutureVersion = true;
      options.onStatus?.("unsupported-version");
      return null;
    }

    options.onStatus?.(
      result.status === "recovered" ? "recovered" : "ready"
    );
    return result.raw;
  };

  return {
    getItem: (name) => {
      try {
        const stored = storage.getItem(name);
        if (stored instanceof Promise) {
          return stored.then(inspect).catch(() => {
            options.onStatus?.("recovered");
            return null;
          });
        }
        return inspect(stored);
      } catch {
        options.onStatus?.("recovered");
        return null;
      }
    },
    setItem: (name, value) => {
      if (writesBlockedByFutureVersion || options.shouldSkipWrite?.()) {
        return undefined;
      }

      try {
        const result = storage.setItem(name, value);
        if (result instanceof Promise) {
          return result.catch(() => {
            options.onStatus?.("write-failed");
          });
        }
        return result;
      } catch {
        options.onStatus?.("write-failed");
        return undefined;
      }
    },
    removeItem: (name) => {
      if (writesBlockedByFutureVersion || options.shouldSkipWrite?.()) {
        return undefined;
      }

      try {
        const result = storage.removeItem(name);
        if (result instanceof Promise) {
          return result.catch(() => {
            options.onStatus?.("write-failed");
          });
        }
        return result;
      } catch {
        options.onStatus?.("write-failed");
        return undefined;
      }
    }
  };
}

export function getPersistedGameProgress(progress: GameProgress): GameProgress {
  return {
    coins: progress.coins,
    unlockedLevelIds: progress.unlockedLevelIds,
    currentBookId: progress.currentBookId,
    currentUnitId: progress.currentUnitId,
    currentLevelId: progress.currentLevelId,
    levels: progress.levels,
    words: progress.words,
    studyStats: progress.studyStats
  };
}

export function serializePersistedGameProgress(
  progress: GameProgress,
  version = 1
) {
  return JSON.stringify({
    state: getPersistedGameProgress(progress),
    version
  });
}

export function deserializePersistedGameProgress(raw: string | null) {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedEnvelope> | GameProgress;
    const state =
      parsed && typeof parsed === "object" && "state" in parsed
        ? parsed.state
        : parsed;

    if (!state || typeof state !== "object") {
      return undefined;
    }

    const progress = state as Partial<GameProgress>;

    return normalizeGameProgress({
      coins: typeof progress.coins === "number" ? progress.coins : 0,
      unlockedLevelIds: Array.isArray(progress.unlockedLevelIds)
        ? progress.unlockedLevelIds
        : [],
      currentBookId:
        typeof progress.currentBookId === "string" ? progress.currentBookId : undefined,
      currentUnitId:
        typeof progress.currentUnitId === "string" ? progress.currentUnitId : undefined,
      currentLevelId:
        typeof progress.currentLevelId === "string" ? progress.currentLevelId : undefined,
      levels:
        progress.levels && typeof progress.levels === "object"
          ? progress.levels
          : {},
      words:
        progress.words && typeof progress.words === "object" ? progress.words : {},
      studyStats:
        progress.studyStats && typeof progress.studyStats === "object"
          ? progress.studyStats
          : {}
    } as GameProgress);
  } catch {
    return undefined;
  }
}

export function getPersistedProfiledGameProgress(
  state: ProfiledGameProgress
): ProfiledGameProgress {
  return normalizeProfiledGameProgress({
    storageVersion: GAME_STORAGE_VERSION,
    contentVersion: GAME_CONTENT_VERSION,
    profiles: state.profiles,
    activeProfileId: state.activeProfileId,
    progressByProfileId: state.progressByProfileId
  });
}

export function serializePersistedProfiledGameProgress(
  state: ProfiledGameProgress
) {
  return JSON.stringify({
    state: getPersistedProfiledGameProgress(state),
    version: GAME_STORAGE_VERSION
  });
}

export function deserializePersistedProfiledGameProgress(raw: string | null) {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedEnvelope>;
    if (typeof parsed.version === "number" && parsed.version > GAME_STORAGE_VERSION) {
      throw new UnsupportedStorageVersionError(parsed.version);
    }
    return migratePersistedGameState(parsed, parsed.version);
  } catch {
    return undefined;
  }
}
