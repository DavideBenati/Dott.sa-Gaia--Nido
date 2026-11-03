import { expect, test } from "vitest";
import {
  cloudflareHeaders,
  mergeHeaderBlocks,
} from "../scripts/cloudflare-headers.mjs";
import { metadata } from "../scripts/web-seo.mjs";
import { pwaHeaders } from "../scripts/web-pwa.mjs";

// Model Workers' exact-path metadata, verified against Wrangler 4.157.0:
// constructing metadata replaces earlier entries for the same path.
function workerMetadata(text: string) {
  const rules: Record<string, Record<string, string>> = {};
  for (const block of text.trim().split(/\n(?=\S)/)) {
    const [path, ...lines] = block.split("\n");
    rules[path] = Object.fromEntries(
      lines.map((line) => {
        const separator = line.indexOf(":");
        return [
          line.slice(0, separator).trim().toLowerCase(),
          line.slice(separator + 1).trim(),
        ];
      }),
    );
  }
  return rules;
}

test("private no-store survives downstream Workers metadata construction", () => {
  const original =
    "/account*\n  Cache-Control: no-store\n/account*\n  X-Robots-Tag: noindex, nofollow\n";
  expect(
    workerMetadata(original)["/account*"]["cache-control"],
  ).toBeUndefined();
  expect(workerMetadata(mergeHeaderBlocks(original))["/account*"]).toEqual({
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
  });
});

test("all actual packaged routes retain cache and indexing rules together", () => {
  const output = cloudflareHeaders(metadata, pwaHeaders);
  const paths = output
    .split("\n")
    .filter((line: string) => line.startsWith("/"));
  expect(paths.length).toBe(new Set(paths).size);
  const compiled = workerMetadata(output);
  for (const [path, page] of Object.entries(metadata) as [
    string,
    { index: boolean },
  ][]) {
    const rule = compiled[path === "/" ? "/" : `${path}*`];
    expect(rule["cache-control"], path).toBe("no-store");
    if (!page.index)
      expect(rule["x-robots-tag"], path).toBe("noindex, nofollow");
  }
  expect(compiled["/newsletter*"]).toMatchObject({
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex, nofollow",
  });
  expect(compiled["/documenti*"]).toMatchObject({
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
  });
  expect(compiled["/*"]["permissions-policy"]).toBe(
    "camera=(), microphone=(), geolocation=()",
  );
  expect(compiled["/*.html"]["cache-control"]).toBe("no-store");
});

test("the service worker and manifest retain their separate MIME and cache policies", () => {
  const compiled = workerMetadata(cloudflareHeaders(metadata, pwaHeaders));
  expect(compiled["/service-worker.js"]).toEqual({
    "cache-control": "no-cache, no-store, must-revalidate",
    "content-type": "application/javascript; charset=utf-8",
    "service-worker-allowed": "/",
  });
  expect(compiled["/manifest.webmanifest"]).toEqual({
    "cache-control": "no-cache",
    "content-type": "application/manifest+json; charset=utf-8",
  });
  expect(compiled["/offline.html"]).toEqual({
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow",
  });
});

test("identical header names merge case-insensitively without duplicated values", () => {
  const result = mergeHeaderBlocks(
    "/a*\n  Cache-Control: no-store\n/b*\n  X-Test: keep\n/a*\n  cache-control: no-store\n  X-Test: merged\n",
  );
  expect(result).toBe(
    "/a*\n  Cache-Control: no-store\n  X-Test: merged\n/b*\n  X-Test: keep\n",
  );
});

test("conflicting values fail packaging instead of silently weakening a rule", () => {
  expect(() =>
    mergeHeaderBlocks(
      "/account*\n  Cache-Control: no-store\n/account*\n  cache-control: public, max-age=3600\n",
    ),
  ).toThrow(/Conflicting values/);
});

test("invalid or empty generated blocks cannot be published silently", () => {
  for (const input of [
    "/account*\n",
    "  Cache-Control: no-store\n",
    "/a\n  Broken header\n",
    "relative\n  X-Test: x\n",
  ])
    expect(() => mergeHeaderBlocks(input)).toThrow();
});
