import { expect, test } from "vitest";
import { achievementShare } from "../apps/mobile/src/achievement-share";
import { memberAchievements } from "../packages/core/src/achievements";
import { defaultPreferences } from "../packages/core/src/types";

test("a shared signup badge contains only a public milestone and no profile or clinical data", () => {
  const badge = memberAchievements({
    authenticated: true,
    preferences: {
      ...defaultPreferences,
      profileType: "parent",
      date: "2027-01-02",
      personalized: true,
      sensitiveConsent: true,
    },
    favorites: [],
    progress: {},
    checklists: [],
  })[0];
  const shared = achievementShare(badge);
  expect(shared.url).toBe("https://metimaia.com/welcome");
  expect(shared.text).toContain("Benvenuto in MetiMaia");
  expect(JSON.stringify(shared)).not.toMatch(
    /2027|parent|date|email|nickname|consent|acquisto/i,
  );
  expect(() => achievementShare({ ...badge, earned: false })).toThrow();
});
