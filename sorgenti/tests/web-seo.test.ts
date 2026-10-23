import { expect, test } from "vitest";
// @ts-expect-error The packager is a Node ESM script, shared with the build.
import { metadata, pageHTML, sitemap } from "../scripts/web-seo.mjs";
const html =
  '<!DOCTYPE html><html lang="en"><head><title>Old</title><meta name="description" content="old"></head><body><div id="root"></div></body></html>';
test("public entry points expose unique Italian metadata and real share image URLs before JavaScript runs", () => {
  const page = pageHTML(html, "/prenota");
  expect(page).toContain('<html lang="it">');
  expect(page).toContain("Richiedi un incontro con Gaia Brunetti");
  expect(page.match(/<title>/g)).toHaveLength(1);
  expect(page.match(/name="description"/g)).toHaveLength(1);
  expect(page).toContain('href="https://metimaia.com/prenota"');
  expect(page).toContain('content="https://metimaia.com/social-preview.png"');
  expect(page).toContain("application/ld+json");
  expect(page).not.toContain("ratingValue");
});
test("private routes are noindex and are never advertised in the sitemap", () => {
  for (const path of [
    "/account",
    "/chat",
    "/studio",
    "/profile",
    "/saved",
    "/newsletter",
  ]) {
    expect(metadata[path].index).toBe(false);
    expect(pageHTML(html, path)).toContain('content="noindex,nofollow"');
    expect(sitemap).not.toContain(`https://metimaia.com${path}<`);
  }
  expect(sitemap).toContain("https://metimaia.com/discover");
  expect(sitemap).toContain("https://metimaia.com/prenota");
});
