import { expect, test } from "vitest";
import { memberAchievements } from "./achievements";
import { defaultPreferences, type Checklist } from "./types";

const list: Checklist = {
  id: "prepararsi",
  title: "Prepararsi insieme",
  description: "Lista pratica",
  stage: "all",
  status: "published",
  approved: true,
  isDemo: false,
  items: [
    { id: "one", label: "Prima attività" },
    { id: "two", label: "Seconda attività" },
  ],
};
const initial = {
  authenticated: false,
  preferences: defaultPreferences,
  favorites: [],
  checklists: [list],
  progress: {},
};

test("a guest never receives signup or profile badges from local progress", () => {
  const badges = memberAchievements({
    ...initial,
    preferences: {
      ...defaultPreferences,
      profileType: "parent",
      onboarded: true,
    },
    progress: { one: true, two: true },
  });
  expect(badges.find((b) => b.id === "welcome")?.earned).toBe(false);
  expect(badges.find((b) => b.id === "profile-ready")?.earned).toBe(false);
  expect(badges.find((b) => b.id === "checklist:prepararsi")?.earned).toBe(
    true,
  );
});

test("signup is independent of clinical details and legacy onboarding never invents an explicit profile type", () => {
  const badges = memberAchievements({
    ...initial,
    authenticated: true,
    preferences: { ...defaultPreferences, onboarded: true },
  });
  expect(badges.find((b) => b.id === "welcome")?.earned).toBe(true);
  expect(badges.find((b) => b.id === "profile-ready")?.earned).toBe(false);
  const selected = memberAchievements({
    ...initial,
    authenticated: true,
    preferences: {
      ...defaultPreferences,
      profileType: "friend",
      onboarded: true,
    },
  });
  expect(selected.find((b) => b.id === "profile-ready")?.earned).toBe(true);
});

test("a checklist earns a badge only with every item checked and loses completion when reopened", () => {
  expect(
    memberAchievements({
      ...initial,
      progress: { one: true, two: false, unrelated: true },
    }).at(-1)?.earned,
  ).toBe(false);
  expect(
    memberAchievements({ ...initial, progress: { one: true, two: true } }).at(
      -1,
    )?.earned,
  ).toBe(true);
  expect(
    memberAchievements({ ...initial, progress: { one: false, two: true } }).at(
      -1,
    )?.earned,
  ).toBe(false);
  expect(
    memberAchievements({ ...initial, checklists: [{ ...list, items: [] }] }).at(
      -1,
    )?.earned,
  ).toBe(false);
});

test("saved-reading badges reflect saved state and never imply an Amazon purchase", () => {
  const saved = memberAchievements({ ...initial, favorites: ["article-id"] });
  expect(saved.find((b) => b.kind === "saved")?.earned).toBe(true);
  expect(
    memberAchievements(initial).find((b) => b.kind === "saved")?.earned,
  ).toBe(false);
  expect(
    saved.some((b) => /purchase|order|acquisto|checkout/i.test(b.id)),
  ).toBe(false);
});

test("Prima selezione requires a recorded own-account selection, never a guest click or completed purchase", () => {
  expect(
    memberAchievements({
      ...initial,
      authenticated: true,
      firstRecommendationSelected: true,
    }).find((b) => b.id === "first-selection")?.earned,
  ).toBe(true);
  expect(
    memberAchievements({ ...initial, authenticated: true }).find(
      (b) => b.id === "first-selection",
    )?.earned,
  ).toBe(false);
  expect(
    memberAchievements({ ...initial, firstRecommendationSelected: true }).find(
      (b) => b.id === "first-selection",
    )?.earned,
  ).toBe(false);
});
