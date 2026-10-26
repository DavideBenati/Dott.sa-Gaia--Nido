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
import {
  defaultProfile,
  loadProfile,
  publicProfile,
} from "../apps/mobile/src/professional";
import { withGaiaPresentation } from "../apps/mobile/src/gaia-presentation";

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

test("the former complete starter gets the supplied public presentation without changing the stored editor record", async () => {
  source.data = structuredClone(defaultProfile);
  const stored = await loadProfile({ strict: true });
  const presented = publicProfile(stored);
  expect(presented.bio).toContain(
    "MetiMaia è uno spazio dedicato alle famiglie",
  );
  expect(presented.services).toHaveLength(4);
  expect(stored).toEqual(defaultProfile);
  expect(source.data).toEqual(defaultProfile);
});

test("intentional edited or removed presentation fields are not filled back from the supplied document", () => {
  const edited = {
    ...defaultProfile,
    bio: "Una presentazione aggiornata",
    services: [],
  };
  expect(publicProfile(edited)).toEqual(edited);
  const cleared = {
    ...defaultProfile,
    bio: "",
    qualifications: "",
    services: [],
  };
  expect(publicProfile(cleared)).toEqual(cleared);
  const changedContact = {
    ...defaultProfile,
    contact_email: "changed@example.invalid",
  };
  expect(publicProfile(changedContact).contact_email).toBe(
    "changed@example.invalid",
  );
});

test("explicit document import preserves photo and privacy fields and cannot mutate either the original profile or later imports", () => {
  const original = {
    ...defaultProfile,
    bio: "Testo salvato",
    portrait_url: "https://example.invalid/ritratto.jpg",
    privacy_providers: "Fornitori già definiti",
    privacy_retention: "Criteri già definiti",
    privacy_transfers: "Garanzie già definite",
    privacy_reviewed: true,
  };
  const imported = withGaiaPresentation(original);
  for (const key of [
    "id",
    "portrait_url",
    "privacy_providers",
    "privacy_retention",
    "privacy_transfers",
    "privacy_reviewed",
  ] as const)
    expect(imported[key]).toEqual(original[key]);
  expect(imported.services).toHaveLength(4);
  imported.services[0].title = "Modifica della bozza";
  expect(withGaiaPresentation(original).services[0].title).not.toBe(
    "Modifica della bozza",
  );
  expect(original.bio).toBe("Testo salvato");
  expect(original.services).toEqual([]);
});

test("the earlier supplied personal presentation becomes the project philosophy even when persisted", () => {
  const legacy = {
    ...defaultProfile,
    bio: "Ciao, sono Gaia. Benvenuta in questo spazio dedicato a te, alla nuova vita che cresce e alla tua famiglia.",
    qualifications:
      "La mia formazione sul campo è iniziata con oltre 2.300 ore di tirocinio clinico nelle sale parto.",
    services: [
      { title: "Servizio precedente", description: "Descrizione", details: "" },
    ],
    portrait_url: "https://example.invalid/photo.jpg",
    contact_email: "contact@example.invalid",
  };
  const shown = publicProfile(legacy);
  expect(shown.bio).toContain("MetiMaia è uno spazio dedicato alle famiglie");
  expect(shown.qualifications).toContain("Il fiore di loto");
  expect(shown.qualifications).not.toContain("tirocinio");
  expect(shown.services).toHaveLength(4);
  expect(shown.contact_email).toBe(legacy.contact_email);
  expect(shown.portrait_url).toBe(legacy.portrait_url);
  expect(legacy.bio).toContain("Ciao, sono Gaia");
});

test("public presentation normalization never rewrites the original legal privacy disclosures", () => {
  const stored = {
    ...defaultProfile,
    bio: "Contatta Gaia Brunetti",
    privacy_providers: "Titolare: Gaia Brunetti; fornitori del servizio.",
    privacy_retention: "Informazioni comunicate da Gaia Brunetti.",
    privacy_transfers: "Recapito legale di Gaia Brunetti.",
  };
  const presented = publicProfile(stored);
  expect(presented.bio).toBe("Contatta Dott.ssa Gaia");
  for (const key of [
    "privacy_providers",
    "privacy_retention",
    "privacy_transfers",
  ] as const)
    expect(presented[key]).toBe(stored[key]);
  expect(stored.bio).toBe("Contatta Gaia Brunetti");
});
