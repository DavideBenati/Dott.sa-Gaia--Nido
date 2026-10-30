import { describe, expect, it } from "vitest";
import { defaultPreferences, type Preferences } from "./types";
import {
  PROFILE_TYPE_CHOICES,
  hasCompletedProfileType,
  isProfileType,
  preferencesForProfileType,
  profileTypeForPreferences,
  profileTypeLabel,
} from "./profile-types";

describe("explicit profile types with legacy journey compatibility", () => {
  it("offers five distinct roles and rejects unrecognized persisted values", () => {
    expect(PROFILE_TYPE_CHOICES.map(({ id }) => profileTypeLabel(id))).toEqual([
      "Genitore",
      "Partner",
      "Parente",
      "Amico/a",
      "Mi informo",
    ]);
    for (const value of [undefined, null, "pregnancy", "amico", {}, true])
      expect(isProfileType(value)).toBe(false);
  });

  it("does not infer completion from a legacy onboarded account", () => {
    const legacy = {
      ...defaultPreferences,
      onboarded: true,
      journey: "partner" as const,
    };
    expect(profileTypeForPreferences(legacy)).toBe("relative");
    expect(hasCompletedProfileType(legacy)).toBe(false);
    expect(legacy).not.toHaveProperty("profileType");
    expect(hasCompletedProfileType({ ...legacy, profileType: "partner" })).toBe(
      true,
    );
    expect(
      hasCompletedProfileType({
        ...legacy,
        profileType: "partner",
        onboarded: false,
      }),
    ).toBe(false);
  });

  it.each(["pregnancy", "postpartum"] as const)(
    "retains the existing %s journey and optional personal data when a parent confirms the role",
    (journey) => {
      const legacy: Preferences = {
        ...defaultPreferences,
        journey,
        onboarded: true,
        date: "2026-08-20",
        personalized: true,
        sensitiveConsent: true,
        feedingTopics: ["Cura del neonato"],
        notifications: true,
      };
      const before = structuredClone(legacy);
      expect(preferencesForProfileType(legacy, "parent")).toEqual({
        ...before,
        profileType: "parent",
        exploreOnly: false,
      });
      expect(legacy).toEqual(before);
    },
  );

  it("keeps partner phases while general supporter roles require no personal phase or date", () => {
    const personal: Preferences = {
      ...defaultPreferences,
      journey: "postpartum",
      date: "2026-08-20",
      personalized: true,
      sensitiveConsent: true,
    };
    expect(preferencesForProfileType(personal, "partner")).toMatchObject({
      profileType: "partner",
      journey: "partner",
      partnerStage: "postpartum",
      exploreOnly: false,
      date: null,
      personalized: false,
      sensitiveConsent: false,
    });
    for (const profileType of ["relative", "friend", "exploring"] as const)
      expect(preferencesForProfileType(personal, profileType)).toMatchObject({
        profileType,
        exploreOnly: true,
        date: null,
        personalized: false,
        sensitiveConsent: false,
      });
    expect(
      preferencesForProfileType(
        {
          ...defaultPreferences,
          journey: "partner",
          partnerStage: "postpartum",
        },
        "parent",
      ).journey,
    ).toBe("postpartum");
  });
});
