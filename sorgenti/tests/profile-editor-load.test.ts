import { beforeEach, expect, test, vi } from "vitest";

const source = vi.hoisted(() => ({
  data: null as unknown,
  error: null as unknown,
  reject: false,
}));
vi.mock("../apps/mobile/src/state", () => ({
  client: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (source.reject) throw new Error("Network unavailable");
            return { data: source.data, error: source.error };
          },
        }),
      }),
    }),
  },
}));
import { defaultProfile, loadProfile } from "../apps/mobile/src/professional";

beforeEach(() => {
  source.data = {
    ...defaultProfile,
    bio: "Presentazione già salvata",
    services: [{ title: "Servizio", description: "Descrizione", details: "" }],
    contact_email: "gaia-test@example.invalid",
  };
  source.error = null;
  source.reject = false;
});

test("the administrative editor receives the stored profile rather than replacement defaults", async () => {
  const profile = await loadProfile({ strict: true });
  expect(profile.bio).toBe("Presentazione già salvata");
  expect(profile.services).toHaveLength(1);
  expect(profile.contact_email).toBe("gaia-test@example.invalid");
});
test("a failed administrative read cannot silently become a writable default profile", async () => {
  source.error = { message: "Server error", code: "500" };
  source.data = null;
  await expect(loadProfile({ strict: true })).rejects.toThrow(
    /Riprova prima di modificarle/,
  );
  expect(await loadProfile()).toEqual(defaultProfile);
});
test("network exceptions and missing records block the administrative editor", async () => {
  source.reject = true;
  await expect(loadProfile({ strict: true })).rejects.toThrow();
  source.reject = false;
  source.data = null;
  await expect(loadProfile({ strict: true })).rejects.toThrow();
});
test("malformed persisted service or profile fields are never merged into an editor-ready record", async () => {
  source.data = { ...defaultProfile, services: [{ title: "Incomplete" }] };
  await expect(loadProfile({ strict: true })).rejects.toThrow();
  source.data = { ...defaultProfile, contact_email: null };
  await expect(loadProfile({ strict: true })).rejects.toThrow();
  source.data = { ...defaultProfile, privacy_reviewed: undefined };
  await expect(loadProfile({ strict: true })).rejects.toThrow();
});
