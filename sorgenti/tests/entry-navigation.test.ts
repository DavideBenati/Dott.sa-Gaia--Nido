import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultPreferences } from "@nido/core";

const memory = new Map<string, string>();
const sessionStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
};

beforeEach(() => {
  memory.clear();
  vi.resetModules();
  vi.stubGlobal("window", { sessionStorage });
});
afterEach(() => vi.unstubAllGlobals());

describe("account entry resumes navigation without importing personal preferences", () => {
  it("survives a browser refresh with only an email and public return target", async () => {
    const first = await import("../apps/mobile/src/entry-navigation");
    first.prepareAccountEntry("  MEMBER@example.invalid  ");
    expect([...memory.values()].map((value) => JSON.parse(value))).toEqual([
      { email: "member@example.invalid", returnTo: "project" },
    ]);
    vi.resetModules();
    const refreshed = await import("../apps/mobile/src/entry-navigation");
    expect(refreshed.consumeAccountEntry("MEMBER@example.invalid")).toEqual({
      email: "member@example.invalid",
      returnTo: "project",
    });
    expect(refreshed.consumeAccountEntry("member@example.invalid")).toBeNull();
    expect(memory.size).toBe(0);
  });

  it("discards an entry after cancellation or an account switch", async () => {
    const entry = await import("../apps/mobile/src/entry-navigation");
    entry.prepareAccountEntry("first@example.invalid");
    expect(entry.consumeAccountEntry("second@example.invalid")).toBeNull();
    expect(entry.consumeAccountEntry("first@example.invalid")).toBeNull();
    entry.prepareAccountEntry("first@example.invalid");
    entry.cancelAccountEntry();
    expect(entry.consumeAccountEntry("first@example.invalid")).toBeNull();
    expect(memory.size).toBe(0);
  });

  it("works with unavailable browser storage", async () => {
    vi.stubGlobal("window", {
      get sessionStorage() {
        throw new Error("Unavailable");
      },
    });
    const entry = await import("../apps/mobile/src/entry-navigation");
    entry.prepareAccountEntry("member@example.invalid");
    expect(entry.consumeAccountEntry("member@example.invalid")?.returnTo).toBe(
      "project",
    );
  });

  it("asks new or legacy accounts for an explicit role after authentication", async () => {
    const { accountEntryDestination } =
      await import("../apps/mobile/src/entry-navigation");
    for (const pathname of ["/account", "/"])
      expect(
        accountEntryDestination({
          preferences: { ...defaultPreferences, onboarded: true },
          pathname,
          hasEntry: false,
          passwordRecovery: false,
        }),
      ).toBe("/welcome?onboarding=1&returnTo=project");
    expect(
      accountEntryDestination({
        preferences: { ...defaultPreferences, profileType: "parent" },
        pathname: "/gaia",
        hasEntry: true,
        passwordRecovery: false,
      }),
    ).toBe("/welcome?onboarding=1&returnTo=project");
  });

  it("preserves complete account data and leaves recovery and reading routes alone", async () => {
    const { accountEntryDestination } =
      await import("../apps/mobile/src/entry-navigation");
    const preferences = Object.freeze({
      ...defaultPreferences,
      profileType: "parent" as const,
      onboarded: true,
      journey: "postpartum" as const,
      date: "2026-08-20",
      personalized: true,
      sensitiveConsent: true,
    });
    const request = {
      preferences,
      pathname: "/account",
      hasEntry: true,
      passwordRecovery: false,
    };
    expect(accountEntryDestination(request)).toBe("/gaia?start=1");
    expect(preferences.date).toBe("2026-08-20");
    expect(
      accountEntryDestination({ ...request, passwordRecovery: true }),
    ).toBeNull();
    expect(
      accountEntryDestination({
        ...request,
        pathname: "/article/a",
        hasEntry: false,
      }),
    ).toBeNull();
  });
});
