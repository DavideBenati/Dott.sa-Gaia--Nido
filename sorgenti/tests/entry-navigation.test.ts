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

  it("preserves only the document-area token through refresh and for the same account", async () => {
    const entry = await import("../apps/mobile/src/entry-navigation");
    entry.prepareAccountEntry("PATIENT@example.invalid", "documents");
    expect(JSON.parse([...memory.values()][0])).toEqual({
      email: "patient@example.invalid",
      returnTo: "documents",
    });
    vi.resetModules();
    const refreshed = await import("../apps/mobile/src/entry-navigation");
    expect(refreshed.consumeAccountEntry("patient@example.invalid")).toEqual({
      email: "patient@example.invalid",
      returnTo: "documents",
    });
    refreshed.prepareAccountEntry("patient@example.invalid", "documents");
    expect(refreshed.consumeAccountEntry("other@example.invalid")).toBeNull();
    expect(refreshed.consumeAccountEntry("patient@example.invalid")).toBeNull();
  });

  it("rejects arbitrary return URLs and malformed persisted destinations", async () => {
    const entry = await import("../apps/mobile/src/entry-navigation");
    for (const target of [
      "https://example.invalid",
      "//example.invalid",
      "/miei-documenti?document_id=private-id",
      "/videochiamate?invito=33333333-3333-4333-8333-333333333333",
      ["documents"],
      ["video_calls"],
      { returnTo: "documents" },
      "video_calls:",
      "video_calls:not-an-invitation",
      "video_calls:https://example.invalid",
      "video_calls:33333333-3333-4333-8333-333333333333&next=https://example.invalid",
      "video_calls:33333333-3333-4333-8333-333333333333/extra",
    ]) {
      entry.prepareAccountEntry("patient@example.invalid", target);
      expect(
        entry.consumeAccountEntry("patient@example.invalid")?.returnTo,
      ).toBe("project");
    }
    memory.set(
      "maia:account-entry:v2",
      JSON.stringify({
        email: "patient@example.invalid",
        returnTo: "https://example.invalid",
      }),
    );
    vi.resetModules();
    const refreshed = await import("../apps/mobile/src/entry-navigation");
    expect(refreshed.consumeAccountEntry("patient@example.invalid")).toBeNull();
  });

  it("resumes the video-call area for the same account without persisting an invitation identifier", async () => {
    const entry = await import("../apps/mobile/src/entry-navigation");
    entry.prepareAccountEntry("PATIENT@example.invalid", "video_calls");
    expect(JSON.parse([...memory.values()][0])).toEqual({
      email: "patient@example.invalid",
      returnTo: "video_calls",
    });
    vi.resetModules();
    const refreshed = await import("../apps/mobile/src/entry-navigation");
    expect(refreshed.consumeAccountEntry("patient@example.invalid")).toEqual({
      email: "patient@example.invalid",
      returnTo: "video_calls",
    });
    refreshed.prepareAccountEntry("patient@example.invalid", "video_calls");
    expect(refreshed.consumeAccountEntry("other@example.invalid")).toBeNull();
    expect(refreshed.consumeAccountEntry("patient@example.invalid")).toBeNull();
  });

  it("returns to video calls after login and preserves the target through the profile step", async () => {
    const { accountEntryDestination } =
      await import("../apps/mobile/src/entry-navigation");
    const request = {
      preferences: {
        ...defaultPreferences,
        profileType: "parent" as const,
        onboarded: true,
      },
      pathname: "/account",
      hasEntry: true,
      passwordRecovery: false,
      returnTo: "video_calls",
    };
    expect(accountEntryDestination(request)).toBe("/videochiamate");
    expect(
      accountEntryDestination({ ...request, preferences: defaultPreferences }),
    ).toBe("/welcome?onboarding=1&returnTo=video_calls");
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

  it("preserves the exact validated invitation through refresh, login and profile completion", async () => {
    const id = "aabbccdd-3333-4333-8333-333333333333";
    const target = `video_calls:${id}`;
    const first = await import("../apps/mobile/src/entry-navigation");
    first.prepareAccountEntry(
      "PATIENT@example.invalid",
      `video_calls:${id.toUpperCase()}`,
    );
    expect(JSON.parse([...memory.values()][0])).toEqual({
      email: "patient@example.invalid",
      returnTo: target,
    });
    vi.resetModules();
    const refreshed = await import("../apps/mobile/src/entry-navigation");
    const entry = refreshed.consumeAccountEntry("patient@example.invalid");
    expect(entry).toEqual({
      email: "patient@example.invalid",
      returnTo: target,
    });
    const request = {
      preferences: {
        ...defaultPreferences,
        profileType: "parent" as const,
        onboarded: true,
      },
      pathname: "/account",
      hasEntry: true,
      passwordRecovery: false,
      returnTo: entry?.returnTo,
    };
    expect(refreshed.accountEntryDestination(request)).toBe(
      `/videochiamate?invito=${id}`,
    );
    const onboarding = refreshed.accountEntryDestination({
      ...request,
      preferences: defaultPreferences,
    });
    expect(onboarding).toBe(`/welcome?onboarding=1&returnTo=${target}`);
    expect(
      refreshed.videoCallReturnPath(
        new URL(onboarding!, "https://metimaia.com").searchParams.get(
          "returnTo",
        ),
      ),
    ).toBe(`/videochiamate?invito=${id}`);
    expect(
      refreshed.accountEntryDestination({ ...request, passwordRecovery: true }),
    ).toBeNull();
    refreshed.prepareAccountEntry("patient@example.invalid", target);
    expect(refreshed.consumeAccountEntry("other@example.invalid")).toBeNull();
  });

  it("never turns malformed invitation targets into navigation URLs", async () => {
    const entry = await import("../apps/mobile/src/entry-navigation");
    for (const target of [
      "video_calls:https://example.invalid",
      "video_calls:33333333-3333-4333-8333-333333333333#token=secret",
      "video_calls:33333333-3333-4333-8333-333333333333?next=/account",
    ]) {
      expect(entry.videoCallReturnPath(target)).toBeNull();
      memory.set(
        "maia:account-entry:v2",
        JSON.stringify({ email: "patient@example.invalid", returnTo: target }),
      );
      vi.resetModules();
      const refreshed = await import("../apps/mobile/src/entry-navigation");
      expect(
        refreshed.consumeAccountEntry("patient@example.invalid"),
      ).toBeNull();
    }
  });

  it("returns completed profiles to documents and preserves the role step for incomplete profiles", async () => {
    const { accountEntryDestination } =
      await import("../apps/mobile/src/entry-navigation");
    const request = {
      preferences: {
        ...defaultPreferences,
        profileType: "parent" as const,
        onboarded: true,
      },
      pathname: "/account",
      hasEntry: true,
      passwordRecovery: false,
      returnTo: "documents",
    };
    expect(accountEntryDestination(request)).toBe("/miei-documenti");
    expect(accountEntryDestination({ ...request, hasEntry: false })).toBe(
      "/miei-documenti",
    );
    expect(
      accountEntryDestination({ ...request, preferences: defaultPreferences }),
    ).toBe("/welcome?onboarding=1&returnTo=documents");
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
    expect(
      accountEntryDestination({
        ...request,
        returnTo: "https://example.invalid",
      }),
    ).toBe("/gaia?start=1");
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
