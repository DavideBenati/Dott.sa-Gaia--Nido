import { afterEach, expect, test, vi } from "vitest";
import {
  publicProfessionalText,
  professionalPublicName,
} from "../packages/core/src/public-name";

afterEach(() => {
  vi.unstubAllEnvs();
});

test("public copy replaces only professional surnames with the contextual first-name identity", () => {
  expect(publicProfessionalText("Un incontro con Gaia Brunetti.")).toBe(
    "Un incontro con Dott.ssa Gaia.",
  );
  expect(
    publicProfessionalText("Dott.sa Gaia Brunetti e Dott.ssa Gaia Brunetti"),
  ).toBe("Dott.ssa Gaia e Dott.ssa Gaia");
  expect(publicProfessionalText("Ostetrica Gaia Brunetti")).toBe(
    "Ostetrica Gaia",
  );
});

test("existing Gaia-only references and structured-data identity stay exactly unchanged", () => {
  for (const text of [
    "Gaia",
    "Contatta Gaia",
    "Dott.ssa Gaia",
    "Dott.sa Gaia",
    "Ostetrica Gaia",
  ])
    expect(publicProfessionalText(text)).toBe(text);
  expect(professionalPublicName).toBe("Dott.sa Gaia");
});

test("the configured legal controller is preserved rather than treated as SEO copy", async () => {
  vi.stubEnv("EXPO_PUBLIC_PRIVACY_CONTROLLER", "Gaia Brunetti");
  vi.resetModules();
  const { privacyDetails } = await import("../apps/mobile/src/privacy");
  expect(privacyDetails.controller).toBe("Gaia Brunetti");
});
