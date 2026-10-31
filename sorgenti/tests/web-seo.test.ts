import { expect, test } from "vitest";
// @ts-expect-error The packager is a Node ESM script, shared with the build.
import { metadata, pageHTML, sitemap } from "../scripts/web-seo.mjs";
const html =
  '<!DOCTYPE html><html lang="en"><head><title>Old</title><meta name="description" content="old"></head><body><div id="root"></div></body></html>';
test("public entry points expose unique Italian metadata and real share image URLs before JavaScript runs", () => {
  const page = pageHTML(html, "/prenota");
  expect(page).toContain('<html lang="it">');
  expect(page).toContain("Richiedi un incontro con la Dott.sa Gaia");
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

test("Google verification uses only the original uploaded HTML file and no meta tag", async () => {
  const { readFile } = await import("node:fs/promises");
  expect(
    await readFile(
      new URL(
        "../apps/mobile/public/googlee8a922f3d8a9d320.html",
        import.meta.url,
      ),
      "utf8",
    ),
  ).toBe("google-site-verification: googlee8a922f3d8a9d320.html");
  expect(pageHTML(html, "/")).not.toContain('name="google-site-verification"');
});

test("all indexable HTML pages preserve Gaia-only identities and expose coherent surname-free SEO", () => {
  for (const [path, entry] of Object.entries(metadata) as [
    string,
    { index: boolean; title: string; description: string },
  ][]) {
    if (!entry.index) continue;
    const rendered = pageHTML(html, path);
    expect(rendered).not.toMatch(/Brunetti/i);
    expect(rendered.match(/<title>/g)).toHaveLength(1);
    expect(rendered.match(/name="description"/g)).toHaveLength(1);
    const graph = JSON.parse(
      rendered.match(
        /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/,
      )[1],
    );
    expect(
      graph["@graph"].find(
        (node: { "@type": string }) => node["@type"] === "Person",
      ).name,
    ).toBe("Dott.sa Gaia");
    for (const key of [
      "og:title",
      "og:description",
      "twitter:title",
      "twitter:description",
    ])
      expect(rendered).toContain(key);
  }
  for (const path of ["/", "/gaia", "/help"])
    expect(pageHTML(html, path)).toContain(metadata[path].title);
});

test("a legacy surname in SEO input cannot return through public title, description or social metadata", () => {
  const original = metadata["/gaia"];
  try {
    metadata["/gaia"] = {
      ...original,
      title: "Gaia Brunetti | metiMaia",
      description: "Ostetrica Gaia Brunetti: Contatta Gaia.",
    };
    const rendered = pageHTML(html, "/gaia");
    expect(rendered).not.toMatch(/Brunetti/i);
    expect(rendered).toContain("Dott.ssa Gaia | metiMaia");
    expect(rendered).toContain("Ostetrica Gaia: Contatta Gaia.");
    expect(rendered).toContain('"name":"Dott.sa Gaia"');
  } finally {
    metadata["/gaia"] = original;
  }
});
