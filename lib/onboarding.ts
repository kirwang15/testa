import type {
  AgeBand,
  InterfaceMode,
  LearningPreferences,
  PlayerProfile
} from "@/types/game";

export type OnboardingSelection = {
  nickname: string;
  ageBand: AgeBand;
  interfaceMode: InterfaceMode;
};

export function getRecommendedInterfaceModeForAge(ageBand: AgeBand): InterfaceMode {
  return ageBand === "13-15" ? "immersion" : "guided";
}

export function getOnboardingProfilePatch(
  selection: OnboardingSelection
): Partial<Omit<PlayerProfile, "id" | "createdAt">> {
  const interfaceMode = selection.interfaceMode;
  const preferences: LearningPreferences = {
    interfaceMode,
    uiLanguage: interfaceMode === "immersion" ? "en" : "zh-CN",
    clueLanguage: "en"
  };

  return {
    nickname: selection.nickname.trim(),
    ageBand: selection.ageBand,
    preferences,
    onboardingCompleted: true
  };
}

export function getRequiredOnboardingRoute(
  hasHydrated: boolean,
  pathname: string,
  onboardingCompleted: boolean
) {
  if (
    !hasHydrated ||
    onboardingCompleted ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/")
  ) {
    return undefined;
  }

  return "/onboarding" as const;
}
