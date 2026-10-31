import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { expect, test, vi } from "vitest";
// @ts-expect-error Shared Node build module has no TypeScript declaration.
import {
  pwaAssets,
  pwaHTML,
  pwaManifest,
  pwaVersion,
  offlineHTML,
  serviceWorker,
} from "../scripts/web-pwa.mjs";
// @ts-expect-error Shared Node build module has no TypeScript declaration.
import { pageHTML } from "../scripts/web-seo.mjs";

const origin = "https://metimaia.example";
type NetworkRequest = { url: string; method: string; mode: string };
type WorkerEvent = {
  request?: NetworkRequest;
  data?: unknown;
  waitUntil: (value: Promise<unknown>) => void;
  respondWith: (value: Promise<Response>) => void;
};

function worker() {
  const listeners: Record<string, (event: WorkerEvent) => void> = {};
  const stored = new Map<string, Map<string, Response>>();
  const writes: string[] = [];
  const fetchMock = vi.fn(
    async (_input: Request | NetworkRequest, _options?: RequestInit) =>
      new Response(offlineHTML, { headers: { "Content-Type": "text/html" } }),
  );
  const skipWaiting = vi.fn(async () => {});
  const claim = vi.fn(async () => {});
  const deleteCache = vi.fn(async (name: string) => stored.delete(name));
  const caches = {
    keys: async () => [...stored.keys()],
    delete: deleteCache,
    open: async (name: string) => {
      if (!stored.has(name)) stored.set(name, new Map());
      const entries = stored.get(name)!;
      return {
        put: async (key: string, response: Response) => {
          writes.push(key);
          entries.set(key, response.clone());
        },
        match: async (key: string) => entries.get(key)?.clone(),
      };
    },
  };
  runInNewContext(serviceWorker(pwaVersion("build-a")), {
    self: {
      location: { origin },
      addEventListener: (
        name: string,
        listener: (event: WorkerEvent) => void,
      ) => {
        listeners[name] = listener;
      },
      skipWaiting,
      clients: { claim },
    },
    caches,
    fetch: fetchMock,
    URL,
    Request,
    Response,
  });
  async function dispatch(name: string, fields: Partial<WorkerEvent> = {}) {
    let pending: Promise<unknown> = Promise.resolve();
    let response: Promise<Response> | undefined;
    listeners[name]({
      waitUntil: (value) => {
        pending = value;
      },
      respondWith: (value) => {
        response = value;
      },
      ...fields,
    });
    await pending;
    return response;
  }
  return {
    stored,
    writes,
    fetchMock,
    skipWaiting,
    claim,
    deleteCache,
    dispatch,
  };
}

test("manifest identifies one standalone root app and supplies real 192/512/Apple brand icons", async () => {
  expect(pwaManifest).toMatchObject({
    id: "/",
    scope: "/",
    start_url: "/?app=1",
    display: "standalone",
    name: "metiMaia",
    short_name: "MAIA",
    lang: "it-IT",
  });
  for (const [file, size] of [
    ["maia-192.png", 192],
    ["maia-512.png", 512],
    ["apple-touch-icon.png", 180],
  ] as const) {
    const png = await readFile(
      new URL(`../assets/pwa/${file}`, import.meta.url),
    );
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  }
  expect(JSON.parse(pwaAssets("build")["manifest.webmanifest"])).toEqual(
    pwaManifest,
  );
});

test("PWA head injection is idempotent and preserves page SEO and verification-file bytes", async () => {
  const source =
    '<!doctype html><html><head><title>Old</title><meta name="theme-color" content="old"><link rel="manifest" href="old.json"></head><body><div id="root"></div></body></html>';
  const html = pwaHTML(pageHTML(source, "/account"));
  expect(pwaHTML(html)).toBe(html);
  expect(html.match(/rel="manifest"/g)).toHaveLength(1);
  expect(html.match(/name="theme-color"/g)).toHaveLength(1);
  expect(html).toContain('href="/icons/apple-touch-icon.png"');
  expect(html).toContain('content="noindex,nofollow"');
  expect(html).toContain('id="metimaia-page-schema"');
  expect(html).not.toContain('name="google-site-verification"');
  const google = await readFile(
    new URL(
      "../apps/mobile/public/googlee8a922f3d8a9d320.html",
      import.meta.url,
    ),
    "utf8",
  );
  expect(google).toBe("google-site-verification: googlee8a922f3d8a9d320.html");
  expect(Buffer.byteLength(google)).toBe(53);
});

test("new application builds change the worker version and reject injected version code", () => {
  expect(pwaVersion("build-a")).not.toBe(pwaVersion("build-b"));
  expect(pwaVersion("build-a")).toMatch(/^[a-f0-9]{20}$/);
  expect(() => serviceWorker('"; fetch("https://other.example")')).toThrow();
});

test("installation stores only the fixed generic offline page and never activates over an editing page", async () => {
  const w = worker();
  await w.dispatch("install");
  expect(w.writes).toEqual([origin + "/offline.html"]);
  const request = w.fetchMock.mock.calls[0][0] as Request;
  expect(request.url).toBe(origin + "/offline.html");
  expect(request.credentials).toBe("omit");
  expect(request.cache).toBe("no-store");
  expect(request.redirect).toBe("error");
  expect(w.skipWaiting).not.toHaveBeenCalled();
  expect(w.claim).not.toHaveBeenCalled();
});

test("an auth page or SPA fallback returned for offline.html is rejected instead of cached", async () => {
  const w = worker();
  w.fetchMock.mockResolvedValue(
    new Response("<html><body>Signed in patient data</body></html>"),
  );
  await expect(w.dispatch("install")).rejects.toThrow(
    "Generic offline page unavailable",
  );
  expect(w.writes).toEqual([]);
});

test("navigation keeps the original auth URL and request, bypasses HTTP cache and never saves the response", async () => {
  const w = worker();
  const request = {
    url: origin + "/account?code=private-confirmation&returnTo=documents",
    method: "GET",
    mode: "navigate",
  };
  const response = new Response("live page");
  w.fetchMock.mockResolvedValue(response);
  expect(await w.dispatch("fetch", { request })).toBe(response);
  expect(w.fetchMock).toHaveBeenCalledWith(request, { cache: "no-store" });
  expect(w.fetchMock.mock.calls[0][0]).toBe(request);
  expect(w.writes).toEqual([]);
  expect(w.stored.size).toBe(0);
});

test("Supabase APIs, document POSTs, assets and same-origin API fetches are not intercepted", async () => {
  const w = worker();
  for (const request of [
    {
      url: "https://project.supabase.co/rest/v1/session_documents",
      method: "GET",
      mode: "cors",
    },
    {
      url: "https://project.supabase.co/functions/v1/document-file",
      method: "POST",
      mode: "cors",
    },
    { url: origin + "/api/private?token=secret", method: "GET", mode: "cors" },
    {
      url: origin + "/_expo/static/js/web/main.js",
      method: "GET",
      mode: "no-cors",
    },
    { url: "https://other.example/", method: "GET", mode: "navigate" },
  ])
    expect(await w.dispatch("fetch", { request })).toBeUndefined();
  expect(w.fetchMock).not.toHaveBeenCalled();
  expect(w.writes).toEqual([]);
});

test("HTTP authentication, not-found and server errors pass through without an offline substitute", async () => {
  const w = worker();
  for (const status of [401, 403, 404, 500]) {
    const response = new Response("server response", { status });
    w.fetchMock.mockResolvedValueOnce(response);
    expect(
      await w.dispatch("fetch", {
        request: {
          url: origin + "/miei-documenti",
          method: "GET",
          mode: "navigate",
        },
      }),
    ).toBe(response);
  }
  expect(w.stored.size).toBe(0);
});

test("network failure returns only generic no-store/noindex offline HTML, never a previous private page", async () => {
  const w = worker();
  await w.dispatch("install");
  w.fetchMock.mockRejectedValue(new TypeError("Network unavailable"));
  const response = await w.dispatch("fetch", {
    request: {
      url: origin + "/miei-documenti?document_id=private-id",
      method: "GET",
      mode: "navigate",
    },
  });
  expect(response?.status).toBe(503);
  expect(response?.headers.get("Cache-Control")).toBe("no-store");
  expect(response?.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  expect(await response?.text()).toBe(offlineHTML);
  expect(w.writes).toEqual([origin + "/offline.html"]);
  expect(offlineHTML).not.toContain("private-id");
  expect(offlineHTML).toContain("window.location.reload()");
  expect(offlineHTML).not.toContain("localStorage");
});

test("activation removes only owned older caches and updates wait for the explicit message", async () => {
  const w = worker();
  await w.dispatch("install");
  const currentName = [...w.stored.keys()][0];
  w.stored.set("metimaia-pwa-old", new Map());
  w.stored.set("another-app-cache", new Map());
  await w.dispatch("activate");
  expect(w.deleteCache.mock.calls).toEqual([["metimaia-pwa-old"]]);
  expect([...w.stored.keys()].sort()).toEqual(
    [currentName, "another-app-cache"].sort(),
  );
  expect(w.skipWaiting).not.toHaveBeenCalled();
  expect(w.claim).not.toHaveBeenCalled();
  await w.dispatch("message", { data: { type: "UNKNOWN" } });
  expect(w.skipWaiting).not.toHaveBeenCalled();
  await w.dispatch("message", { data: { type: "SKIP_WAITING" } });
  expect(w.skipWaiting).toHaveBeenCalledOnce();
});
