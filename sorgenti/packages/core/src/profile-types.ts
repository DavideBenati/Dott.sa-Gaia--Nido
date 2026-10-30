import type { Preferences, ProfileType } from "./types";

export const PROFILE_TYPE_CHOICES: readonly {
  id: ProfileType;
  title: string;
  subtitle: string;
}[] = [
  {
    id: "parent",
    title: "Genitore",
    subtitle: "Il mio percorso, durante l’attesa o dopo la nascita.",
  },
  {
    id: "partner",
    title: "Partner",
    subtitle: "Per vivere insieme l’attesa e i primi mesi.",
  },
  {
    id: "relative",
    title: "Parente",
    subtitle: "Per essere vicino alla famiglia e offrire supporto.",
  },
  {
    id: "friend",
    title: "Amico/a",
    subtitle: "Per accompagnare le persone a cui voglio bene.",
  },
  {
    id: "exploring",
    title: "Mi informo",
    subtitle: "Per leggere e conoscere, senza indicare una fase personale.",
  },
];

export function isProfileType(value: unknown): value is ProfileType {
  return PROFILE_TYPE_CHOICES.some((choice) => choice.id === value);
}

export function profileTypeLabel(value: ProfileType): string {
  return PROFILE_TYPE_CHOICES.find((choice) => choice.id === value)!.title;
}

/** A display fallback for old preferences, never proof of an explicit choice. */
export function profileTypeForPreferences(
  preferences: Preferences,
): ProfileType {
  if (isProfileType(preferences.profileType)) return preferences.profileType;
  if (preferences.exploreOnly) return "exploring";
  return preferences.journey === "partner" ? "relative" : "parent";
}

export function hasCompletedProfileType(preferences: Preferences): boolean {
  return (
    isProfileType(preferences.profileType) && preferences.onboarded === true
  );
}

/** Keep the old journey fields usable without treating every supporter as a partner. */
export function preferencesForProfileType(
  preferences: Preferences,
  profileType: ProfileType,
): Preferences {
  if (profileType === "parent") {
    return {
      ...preferences,
      profileType,
      journey:
        preferences.journey === "partner"
          ? preferences.partnerStage === "postpartum"
            ? "postpartum"
            : "pregnancy"
          : preferences.journey,
      exploreOnly: false,
    };
  }
  return {
    ...preferences,
    profileType,
    journey: profileType === "exploring" ? "pregnancy" : "partner",
    partnerStage:
      preferences.journey === "postpartum"
        ? "postpartum"
        : (preferences.partnerStage ?? "pregnancy"),
    exploreOnly: profileType !== "partner",
    personalized: false,
    sensitiveConsent: false,
    date: null,
  };
}
