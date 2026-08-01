import {
  createInitialGameProgress,
  mergePersistedGameProgress,
  normalizeGameProgress
} from "./progress";
import type {
  AgeBand,
  ContentAccessLevel,
  GameProgress,
  InterfaceMode,
  LearningPreferences,
  PlayerProfile,
  ProfileActionContext,
  ProfiledGameProgress,
  UiLanguage
} from "../types/game";
import { getDefaultContentAccessLevel } from "./content-access";
import generatedContentManifest from "../src/content/vocabulary/generated/content-manifest.json";

export const DEFAULT_PROFILE_ID = "local-player";
export const DEFAULT_PROFILE_CREATED_AT = "1970-01-01T00:00:00.000Z";
export const PROFILED_PROGRESS_STORAGE_VERSION = 3 as const;
export const CURRENT_CONTENT_VERSION = generatedContentManifest.contentVersion;

export class UnsupportedStorageVersionError extends Error {
  readonly version: number;

  constructor(version: number) {
    super(`Unsupported Word Trail storage version: ${version}`);
    this.name = "UnsupportedStorageVersionError";
    this.version = version;
  }
}

const AGE_BANDS = new Set<AgeBand>(["7-9", "10-12", "13-15"]);
const UI_LANGUAGES = new Set<UiLanguage>(["en", "zh-CN"]);
const INTERFACE_MODES = new Set<InterfaceMode>(["guided", "immersion"]);
const CONTENT_ACCESS_LEVELS = new Set<ContentAccessLevel>([
  "all-ages",
  "13-plus",
  "parent-review"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function getDefaultLearningPreferences(
  interfaceMode: InterfaceMode = "guided"
): LearningPreferences {
  return {
    interfaceMode,
    uiLanguage: interfaceMode === "immersion" ? "en" : "zh-CN",
    clueLanguage: "en"
  };
}

export function normalizeLearningPreferences(
  value: unknown,
  fallback = getDefaultLearningPreferences()
): LearningPreferences {
  if (!isRecord(value)) {
    return { ...fallback };
  }

  const interfaceMode = INTERFACE_MODES.has(value.interfaceMode as InterfaceMode)
    ? (value.interfaceMode as InterfaceMode)
    : fallback.interfaceMode;

  return {
    interfaceMode,
    uiLanguage: UI_LANGUAGES.has(value.uiLanguage as UiLanguage)
      ? (value.uiLanguage as UiLanguage)
      : fallback.uiLanguage,
    clueLanguage: UI_LANGUAGES.has(value.clueLanguage as UiLanguage)
      ? (value.clueLanguage as UiLanguage)
      : fallback.clueLanguage
  };
}

export function createDefaultPlayerProfile(
  overrides: Partial<PlayerProfile> = {}
): PlayerProfile {
  const interfaceMode = INTERFACE_MODES.has(
    overrides.preferences?.interfaceMode as InterfaceMode
  )
    ? overrides.preferences?.interfaceMode
    : "guided";
  const fallbackPreferences = getDefaultLearningPreferences(interfaceMode);
  const ageBand = AGE_BANDS.has(overrides.ageBand as AgeBand)
    ? (overrides.ageBand as AgeBand)
    : "10-12";
  const contentAccessOverride = overrides.contentAccessOverride === true;
  const contentAccessLevel =
    contentAccessOverride &&
    CONTENT_ACCESS_LEVELS.has(overrides.contentAccessLevel as ContentAccessLevel)
      ? (overrides.contentAccessLevel as ContentAccessLevel)
      : getDefaultContentAccessLevel(ageBand);

  return {
    id: nonEmptyString(overrides.id, DEFAULT_PROFILE_ID),
    nickname: nonEmptyString(overrides.nickname, "Explorer"),
    ageBand,
    preferences: normalizeLearningPreferences(
      overrides.preferences,
      fallbackPreferences
    ),
    accent: overrides.accent === "en-GB" ? "en-GB" : "en-US",
    createdAt: nonEmptyString(overrides.createdAt, DEFAULT_PROFILE_CREATED_AT),
    onboardingCompleted: overrides.onboardingCompleted === true,
    contentAccessLevel,
    contentAccessOverride
  };
}

export function normalizePlayerProfile(
  value: unknown,
  fallbackId = DEFAULT_PROFILE_ID
): PlayerProfile {
  if (!isRecord(value)) {
    return createDefaultPlayerProfile({ id: fallbackId });
  }

  return createDefaultPlayerProfile({
    id: nonEmptyString(value.id, fallbackId),
    nickname: nonEmptyString(value.nickname, "Explorer"),
    ageBand: AGE_BANDS.has(value.ageBand as AgeBand)
      ? (value.ageBand as AgeBand)
      : "10-12",
    preferences: normalizeLearningPreferences(value.preferences),
    accent: value.accent === "en-GB" ? "en-GB" : "en-US",
    createdAt: nonEmptyString(value.createdAt, DEFAULT_PROFILE_CREATED_AT),
    onboardingCompleted: value.onboardingCompleted === true,
    contentAccessLevel: CONTENT_ACCESS_LEVELS.has(
      value.contentAccessLevel as ContentAccessLevel
    )
      ? (value.contentAccessLevel as ContentAccessLevel)
      : undefined,
    contentAccessOverride: value.contentAccessOverride === true
  });
}

export function createInitialProfiledGameProgress(): ProfiledGameProgress {
  const profile = createDefaultPlayerProfile();

  return {
    storageVersion: PROFILED_PROGRESS_STORAGE_VERSION,
    contentVersion: CURRENT_CONTENT_VERSION,
    profiles: { [profile.id]: profile },
    activeProfileId: profile.id,
    progressByProfileId: { [profile.id]: createInitialGameProgress() }
  };
}

function looksLikeLegacyProgress(value: Record<string, unknown>) {
  return (
    "coins" in value ||
    "levels" in value ||
    "words" in value ||
    "studyStats" in value ||
    "unlockedLevelIds" in value
  );
}

function migrateLegacyProgress(value: Record<string, unknown>): ProfiledGameProgress {
  const profile = createDefaultPlayerProfile({
    id: DEFAULT_PROFILE_ID,
    nickname: "Explorer",
    ageBand: "10-12",
    preferences: getDefaultLearningPreferences("guided"),
    onboardingCompleted: true
  });

  return {
    storageVersion: PROFILED_PROGRESS_STORAGE_VERSION,
    contentVersion: CURRENT_CONTENT_VERSION,
    profiles: { [profile.id]: profile },
    activeProfileId: profile.id,
    progressByProfileId: {
      [profile.id]: mergePersistedGameProgress(value, createInitialGameProgress())
    }
  };
}

export function normalizeProfiledGameProgress(
  value: unknown,
  fallback = createInitialProfiledGameProgress()
): ProfiledGameProgress {
  if (!isRecord(value)) {
    return fallback;
  }

  if (looksLikeLegacyProgress(value) && !("profiles" in value)) {
    return migrateLegacyProgress(value);
  }

  const rawProfiles = isRecord(value.profiles) ? value.profiles : {};
  const profiles: Record<string, PlayerProfile> = {};
  for (const [profileId, rawProfile] of Object.entries(rawProfiles)) {
    if (!profileId.trim() || ["__proto__", "prototype", "constructor"].includes(profileId)) {
      continue;
    }

    // The profile map key owns identity. Persisted embedded ids are untrusted
    // display data and must never redirect one profile into another profile's
    // progress bucket.
    const profile = normalizePlayerProfile(rawProfile, profileId);
    profiles[profileId] = { ...profile, id: profileId };
  }

  if (Object.keys(profiles).length === 0) {
    return fallback;
  }

  const rawProgress = isRecord(value.progressByProfileId)
    ? value.progressByProfileId
    : {};
  const progressByProfileId: Record<string, GameProgress> = {};
  for (const profileId of Object.keys(profiles)) {
    progressByProfileId[profileId] = mergePersistedGameProgress(
      rawProgress[profileId],
      createInitialGameProgress()
    );
  }

  const requestedActiveId =
    typeof value.activeProfileId === "string" ? value.activeProfileId : "";
  const activeProfileId = profiles[requestedActiveId]
    ? requestedActiveId
    : Object.keys(profiles)[0] ?? DEFAULT_PROFILE_ID;

  return {
    storageVersion: PROFILED_PROGRESS_STORAGE_VERSION,
    contentVersion: CURRENT_CONTENT_VERSION,
    profiles,
    activeProfileId,
    progressByProfileId
  };
}

export function migratePersistedGameState(
  persistedState: unknown,
  persistedVersion?: number
): ProfiledGameProgress {
  let state = persistedState;
  let version = persistedVersion;
  let envelopeVersion: number | undefined;

  if (isRecord(persistedState) && "state" in persistedState) {
    state = persistedState.state;
    if (typeof persistedState.version === "number") {
      version = persistedState.version;
      envelopeVersion = persistedState.version;
    }
  }

  if (envelopeVersion === undefined && typeof persistedVersion === "number") {
    envelopeVersion = persistedVersion;
  }

  const innerVersion =
    isRecord(state) && typeof state.storageVersion === "number"
      ? state.storageVersion
      : undefined;

  for (const candidate of [envelopeVersion, innerVersion]) {
    if (
      typeof candidate === "number" &&
      Number.isFinite(candidate) &&
      candidate > PROFILED_PROGRESS_STORAGE_VERSION
    ) {
      throw new UnsupportedStorageVersionError(candidate);
    }
  }

  if (
    typeof envelopeVersion === "number" &&
    typeof innerVersion === "number" &&
    envelopeVersion !== innerVersion
  ) {
    throw new UnsupportedStorageVersionError(
      Math.max(envelopeVersion, innerVersion)
    );
  }

  if (
    typeof version === "number" &&
    Number.isFinite(version) &&
    version > PROFILED_PROGRESS_STORAGE_VERSION
  ) {
    throw new UnsupportedStorageVersionError(version);
  }

  const stateVersion =
    typeof version === "number"
      ? version
      : isRecord(state) && typeof state.storageVersion === "number"
        ? state.storageVersion
        : undefined;

  // Version 2 predates onboarding. Existing learners must not be sent through
  // first-run setup after upgrading, while an explicit value remains trusted.
  if (stateVersion === 2 && isRecord(state) && isRecord(state.profiles)) {
    state = {
      ...state,
      profiles: Object.fromEntries(
        Object.entries(state.profiles).map(([profileId, rawProfile]) => [
          profileId,
          isRecord(rawProfile) && !("onboardingCompleted" in rawProfile)
            ? { ...rawProfile, onboardingCompleted: true }
            : rawProfile
        ])
      )
    };
  }

  return normalizeProfiledGameProgress(state);
}

export function isProfileActionContextCurrent(
  expected: ProfileActionContext,
  activeProfileId: string,
  activeSession: ProfileActionContext | null,
  currentLevelId?: string
) {
  if (
    !activeSession ||
    expected.profileId !== activeProfileId ||
    expected.profileId !== activeSession.profileId ||
    expected.sessionId !== activeSession.sessionId ||
    expected.levelId !== activeSession.levelId
  ) {
    return false;
  }

  return expected.levelId === undefined || expected.levelId === currentLevelId;
}

export function getActiveProfile(state: ProfiledGameProgress): PlayerProfile {
  return (
    state.profiles[state.activeProfileId] ??
    state.profiles[Object.keys(state.profiles)[0] ?? ""] ??
    createDefaultPlayerProfile()
  );
}

export function getActiveGameProgress(state: ProfiledGameProgress): GameProgress {
  const profile = getActiveProfile(state);
  return state.progressByProfileId[profile.id] ?? createInitialGameProgress();
}

export function getDocumentLanguage(uiLanguage: UiLanguage) {
  return uiLanguage;
}

export function addPlayerProfile(
  state: ProfiledGameProgress,
  profile: PlayerProfile
): ProfiledGameProgress {
  const normalizedProfile = normalizePlayerProfile(profile, profile.id);
  if (state.profiles[normalizedProfile.id]) {
    return state;
  }

  return {
    storageVersion: state.storageVersion,
    contentVersion: state.contentVersion,
    profiles: {
      ...state.profiles,
      [normalizedProfile.id]: normalizedProfile
    },
    activeProfileId: normalizedProfile.id,
    progressByProfileId: {
      ...state.progressByProfileId,
      [normalizedProfile.id]: createInitialGameProgress()
    }
  };
}

export function removePlayerProfile(
  state: ProfiledGameProgress,
  profileId: string
): ProfiledGameProgress {
  if (!state.profiles[profileId] || Object.keys(state.profiles).length <= 1) {
    return state;
  }

  const profiles = { ...state.profiles };
  const progressByProfileId = { ...state.progressByProfileId };
  delete profiles[profileId];
  delete progressByProfileId[profileId];
  const activeProfileId =
    state.activeProfileId === profileId
      ? Object.keys(profiles)[0] ?? state.activeProfileId
      : state.activeProfileId;

  return {
    storageVersion: state.storageVersion,
    contentVersion: state.contentVersion,
    profiles,
    activeProfileId,
    progressByProfileId
  };
}

export function switchActiveProfile(
  state: ProfiledGameProgress,
  profileId: string
): ProfiledGameProgress {
  if (!state.profiles[profileId] || state.activeProfileId === profileId) {
    return state;
  }

  return { ...state, activeProfileId: profileId };
}

export function updatePlayerProfile(
  state: ProfiledGameProgress,
  profileId: string,
  patch: Partial<Omit<PlayerProfile, "id" | "createdAt">>
): ProfiledGameProgress {
  const current = state.profiles[profileId];
  if (!current) {
    return state;
  }

  const next = normalizePlayerProfile(
    {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
      preferences: patch.preferences
        ? { ...current.preferences, ...patch.preferences }
        : current.preferences
    },
    current.id
  );

  return {
    ...state,
    profiles: { ...state.profiles, [profileId]: next }
  };
}

export function updateActiveLearningPreferences(
  state: ProfiledGameProgress,
  patch: Partial<LearningPreferences>
): ProfiledGameProgress {
  const activeProfile = getActiveProfile(state);
  return updatePlayerProfile(state, activeProfile.id, {
    preferences: { ...activeProfile.preferences, ...patch }
  });
}

export function setActiveGameProgress(
  state: ProfiledGameProgress,
  progress: GameProgress
): ProfiledGameProgress {
  const activeProfile = getActiveProfile(state);
  return {
    ...state,
    progressByProfileId: {
      ...state.progressByProfileId,
      [activeProfile.id]: normalizeGameProgress(progress)
    }
  };
}
