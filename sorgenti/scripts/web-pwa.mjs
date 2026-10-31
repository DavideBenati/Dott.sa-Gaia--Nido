import { createHash } from "node:crypto";

export const pwaManifest = {
  id: "/",
  name: "metiMaia",
  short_name: "MAIA",
  description:
    "Letture, checklist e i materiali condivisi da Gaia, con il tuo account metiMaia.",
  lang: "it-IT",
  dir: "ltr",
  start_url: "/?app=1",
  scope: "/",
  display: "standalone",
  background_color: "#FAF7F2",
  theme_color: "#FAF7F2",
  icons: [
    {
      src: "/icons/maia-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "/icons/maia-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
  ],
};

const pwaHead = [
  '<link rel="manifest" href="/manifest.webmanifest">',
  '<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png">',
  '<meta name="theme-color" content="#FAF7F2">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-title" content="MAIA">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
].join("");

/** Apply to application entry points only, never the original Google file. */
export function pwaHTML(html) {
  if (!/<\/head\s*>/i.test(html))
    throw new Error("PWA entry point needs an HTML head");
  return html
    .replace(
      /<link\b[^>]*rel=["'](?:manifest|apple-touch-icon)["'][^>]*>/gi,
      "",
    )
    .replace(
      /<meta\b[^>]*name=["'](?:theme-color|mobile-web-app-capable|apple-mobile-web-app-capable|apple-mobile-web-app-title|apple-mobile-web-app-status-bar-style)["'][^>]*>/gi,
      "",
    )
    .replace(/<\/head\s*>/i, pwaHead + "</head>");
}

const retryScript =
  'document.getElementById("retry").addEventListener("click",function(){window.location.reload();});';
const retryHash = createHash("sha256").update(retryScript).digest("base64");

// This is the only response saved by the service worker. It contains no app
// shell, scripts from the app, account identity or previously fetched data.
export const offlineHTML = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="metimaia-offline" content="v1"><meta name="theme-color" content="#FAF7F2"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${retryHash}'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Connessione assente | metiMaia</title><style>*{box-sizing:border-box}body{margin:0;background:#FAF7F2;color:#34443b;font:18px/1.6 system-ui,sans-serif}main{max-width:620px;margin:10vh auto;padding:30px 24px}h1{font:36px/1.2 Georgia,serif;font-weight:400}p{margin:18px 0}button{border:0;border-radius:12px;background:#42624b;color:white;font:600 18px system-ui,sans-serif;min-height:48px;padding:14px 24px;cursor:pointer}button:focus-visible{outline:3px solid #b57474;outline-offset:4px}.brand{font-size:14px;letter-spacing:.15em;font-weight:700;color:#42624b}.note{padding:18px 20px;background:#e9efe6;border-radius:12px;font-size:16px}</style></head><body><main><p class="brand">METIMAIA</p><h1>Ci ritroviamo appena torna la connessione.</h1><p>Controlla la rete e riprova ad aprire la pagina.</p><button id="retry" type="button">Riprova</button><p class="note">Per leggere i contenuti, usare le checklist e aprire i tuoi documenti serve una connessione. Da questa schermata non vengono salvate attività.</p></main><script>${retryScript}</script></body></html>`;

/** Changes whenever either the application build or the offline page changes. */
export function pwaVersion(html) {
  return createHash("sha256")
    .update(html)
    .update(offlineHTML)
    .update(JSON.stringify(pwaManifest))
    .digest("hex")
    .slice(0, 20);
}

export function serviceWorker(version) {
  if (!/^[a-f0-9]{20}$/.test(version))
    throw new Error("Invalid PWA build version");
  return `"use strict";
const CACHE_PREFIX = "metimaia-pwa-";
const CACHE_NAME = CACHE_PREFIX + ${JSON.stringify(version)};
const OFFLINE_URL = new URL("/offline.html", self.location.origin).href;
const OFFLINE_MARKER = '<meta name="metimaia-offline" content="v1">';

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    // Fetch one fixed, generic public document. No navigation or auth request
    // is ever put into CacheStorage, including its URL/query parameters.
    const response = await fetch(new Request(OFFLINE_URL, {
      cache: "no-store", credentials: "omit", redirect: "error"
    }));
    if (!response.ok || !(await response.clone().text()).includes(OFFLINE_MARKER)) {
      throw new Error("Generic offline page unavailable");
    }
    const cache = await caches.open(CACHE_NAME);
    await cache.put(OFFLINE_URL, response);
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
  })());
  // Existing pages are not claimed or reloaded while someone is editing.
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    // The app sends this only after an explicit, guarded update action.
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Supabase APIs/storage, document POSTs and every non-navigation request use
  // their original network path. They are neither read from nor saved to cache.
  if (request.method !== "GET" || request.mode !== "navigate" ||
      new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      // Keep the original Request intact: confirmation/reset query parameters
      // and credentials must reach the server unchanged. HTTP errors pass through.
      return await fetch(request, { cache: "no-store" });
    } catch {
      const cache = await caches.open(CACHE_NAME);
      const offline = await cache.match(OFFLINE_URL);
      if (!offline) throw new Error("Offline page unavailable");
      return new Response(offline.body, {
        status: 503,
        statusText: "Offline",
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow"
        }
      });
    }
  })());
});
`;
}

export function pwaAssets(html) {
  return {
    "manifest.webmanifest": JSON.stringify(pwaManifest, null, 2) + "\n",
    "offline.html": offlineHTML,
    "service-worker.js": serviceWorker(pwaVersion(html)),
  };
}

export const pwaHeaders =
  "/service-worker.js\n  Cache-Control: no-cache, no-store, must-revalidate\n  Content-Type: application/javascript; charset=utf-8\n  Service-Worker-Allowed: /\n" +
  "/manifest.webmanifest\n  Cache-Control: no-cache\n  Content-Type: application/manifest+json; charset=utf-8\n" +
  "/offline.html\n  Cache-Control: no-store\n  X-Robots-Tag: noindex, nofollow\n";
