// Production-package PWA checks. The service worker is real; every backend
// request is a disposable fixture. No live account, document or email is used.
/* global EventTarget, navigator, Event, caches, innerWidth */
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { PNG } from "pngjs";
import jsQR from "jsqr";

const root = resolve(
  process.argv[2] ?? "/workspace/shared/downloads/maia-v13-candidate-r1",
);
const artifacts = resolve(
  process.env.MAIA_V13_ARTIFACTS ??
    "/workspace/shared/downloads/maia-v13-pwa-checks",
);
await mkdir(artifacts, { recursive: true });
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};
let workerRevision = 0;
const server = createServer(async (request, response) => {
  try {
    let file = resolve(
      root,
      "." + decodeURIComponent(new URL(request.url, "http://local").pathname),
    );
    if (file !== root && !file.startsWith(root + "/"))
      return response.writeHead(403).end();
    if (file === root) file += "/index.html";
    try {
      if (!(await stat(file)).isFile()) throw new Error();
    } catch {
      file += ".html";
    }
    response.setHeader("Cache-Control", "no-store");
    response.setHeader(
      "Content-Type",
      mime[extname(file)] ?? "application/octet-stream",
    );
    let contents = await readFile(file);
    if (file.endsWith("/service-worker.js"))
      contents = Buffer.concat([
        contents,
        Buffer.from(`\n// Browser QA worker revision ${workerRevision}\n`),
      ]);
    response.end(contents);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-external-intent-requests"],
});
const contexts = [];
const checks = [];
const errors = [];
const unexpected = [];
const stamp = "2026-10-31T10:00:00.000Z";
const patient = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "pwa-patient@example.invalid",
};
const outsider = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "pwa-other@example.invalid",
};
const itemId = "88888888-8888-4888-8888-888888888888";
const checklist = {
  id: "44444444-4444-4444-8444-444444444444",
  title: "Preparativi da ritrovare",
  description: "Una lista di prova per verificare i progressi tra dispositivi.",
  stage: "pregnancy",
  status: "published",
  approved: true,
  isDemo: false,
  items: [
    { id: itemId, label: "Prepara il necessario di prova", note: "" },
    {
      id: "99999999-9999-4999-8999-999999999999",
      label: "Verifica il secondo preparativo",
      note: "",
    },
  ],
};
const document = {
  id: "55555555-5555-4555-8555-555555555555",
  owner_id: "11111111-1111-4111-8111-111111111111",
  title: "Materiale privato PWA di prova",
  description: "Questa descrizione non deve finire nella cache del worker.",
  file_name: "materiale-privato-pwa.pdf",
  mime_type: "application/pdf",
  size_bytes: 100,
  storage_path:
    "55555555-5555-4555-8555-555555555555/66666666-6666-4666-8666-666666666666.pdf",
  state: "ready",
  active: true,
  created_at: stamp,
  updated_at: stamp,
  ready_at: stamp,
};
const pdfCanary = "PRIVATE-PWA-DOCUMENT-DO-NOT-CACHE";
const pdf = Buffer.from(
  `%PDF-1.4\n1 0 obj<</Type /Catalog>>endobj\n% ${pdfCanary}\ntrailer<</Root 1 0 R>>\n%%EOF\n`,
);
const copy = (value) => JSON.parse(JSON.stringify(value));
const button = (page, name) => page.getByRole("button", { name, exact: true });
const heading = (page, name) =>
  page.getByRole("heading", { name, exact: true });
function passed(label) {
  checks.push(label);
  console.log("PASS " + label);
}
function token(viewer) {
  const now = Math.floor(Date.now() / 1000);
  return [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: viewer.id,
        aud: "authenticated",
        role: "authenticated",
        aal: "aal1",
        exp: now + 3600,
        iat: now,
      }),
    ).toString("base64url"),
    "test-only-not-a-valid-signature",
  ].join(".");
}
function authUser(viewer) {
  return {
    id: viewer.id,
    email: viewer.email,
    aud: "authenticated",
    role: "authenticated",
    email_confirmed_at: stamp,
    created_at: stamp,
    app_metadata: {},
    user_metadata: {},
    identities: [],
    factors: [],
  };
}
async function fixture({
  width = 390,
  height = 900,
  viewer = null,
  standalone = false,
  ios = false,
  iosVersion = 18,
  android = false,
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    serviceWorkers: "allow",
    acceptDownloads: true,
    ...(ios
      ? {
          userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS ${iosVersion}_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${iosVersion}.0 Mobile/15E148 Safari/604.1`,
          isMobile: true,
          hasTouch: true,
        }
      : android
        ? {
            userAgent:
              "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
            isMobile: true,
            hasTouch: true,
          }
        : {}),
  });
  contexts.push(context);
  await context.addInitScript(
    ({ standalone, ios }) => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query) => {
        const result = original(query);
        if (standalone && query === "(display-mode: standalone)")
          Object.defineProperty(result, "matches", { value: true });
        return result;
      };
      if (ios)
        Object.defineProperty(navigator, "standalone", {
          configurable: true,
          value: standalone,
        });
      window.__pwaPromptCalls = 0;
      window.__dispatchInstallPrompt = () => {
        const event = new Event("beforeinstallprompt", { cancelable: true });
        event.prompt = async () => {
          window.__pwaPromptCalls++;
        };
        event.userChoice = Promise.resolve({
          outcome: "accepted",
          platform: "web",
        });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      };
    },
    { standalone, ios },
  );
  const state = {
    calls: [],
    progress: {},
    favorites: [],
    offline: false,
    failProgress: false,
    failProgressRead: false,
    progressWriteGate: null,
    catalogGate: null,
    failCatalog: false,
    emptyCatalog: false,
    assigned: true,
  };
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!url.hostname.endsWith(".supabase.co")) {
      unexpected.push(request.method() + " " + url.origin + url.pathname);
      return route.abort("blockedbyclient");
    }
    if (state.offline) return route.abort("internetdisconnected");
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
      "Cache-Control": "no-store",
    };
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    const body = request.headers()["content-type"]?.includes("application/json")
      ? request.postDataJSON()
      : null;
    state.calls.push({
      method: request.method(),
      path: url.pathname,
      search: url.search,
      body,
    });
    const json = (value, status = 200) =>
      route.fulfill({
        status,
        headers,
        contentType: "application/json",
        body: JSON.stringify(value),
      });
    const rpc = url.pathname.split("/rpc/")[1];
    if (url.pathname.endsWith("/auth/v1/user"))
      return json(
        viewer ? authUser(viewer) : { message: "No session" },
        viewer ? 200 : 401,
      );
    if (
      [
        "is_editor",
        "can_manage_documents",
        "is_chat_staff",
        "care_chat_available",
      ].includes(rpc)
    )
      return json(false);
    if (rpc === "professional_access_status")
      return json({
        editor: false,
        chat: false,
        mfa_required: false,
        mfa_satisfied: false,
      });
    if (rpc === "document_access_status")
      return json({
        membership: false,
        documents_mfa_required: false,
        can_manage: false,
        mfa_satisfied: false,
      });
    if (rpc === "my_member_profile")
      return json({
        nickname: "Account PWA",
        journey_shared: false,
        shared_journey: null,
        shared_interests: [],
        journey_consent_at: null,
        journey_consent_version: null,
        sharing_updated_at: null,
      });
    if (rpc === "my_member_milestones")
      return json({ first_recommendation_selected: false });
    if (rpc === "my_pregnancy_profile") return json(null);
    if (url.pathname.endsWith("/user_preferences"))
      return json({
        payload: {
          profileType: "parent",
          journey: "pregnancy",
          exploreOnly: false,
          personalized: false,
          date: null,
          feedingTopics: [],
          sensitiveConsent: false,
          notifications: false,
          marketing: false,
          onboarded: true,
        },
      });
    if (url.pathname.endsWith("/notification_preferences"))
      return json({ enabled: false, marketing: false });
    if (url.pathname.endsWith("/articles")) return json([]);
    if (url.pathname.endsWith("/article_categories"))
      return json([{ id: "home", name: "Primi giorni a casa", icon: "home" }]);
    if (url.pathname.endsWith("/checklists")) {
      if (state.catalogGate) await state.catalogGate;
      if (state.failCatalog)
        return json({ message: "Catalogue unavailable" }, 500);
      return json(state.emptyCatalog ? [] : [{ payload: copy(checklist) }]);
    }
    if (url.pathname.endsWith("/checklist_progress")) {
      if (request.method() !== "GET") {
        if (body?.user_id !== viewer?.id)
          return json({ message: "Wrong account" }, 403);
        if (state.failProgress) return json({ message: "Save denied" }, 503);
        if (state.progressWriteGate) await state.progressWriteGate;
        state.progress[body.item_id] = body.completed;
        return json(null);
      }
      if (state.failProgressRead)
        return json({ message: "Read failed for this attempt" }, 500);
      return json(
        Object.entries(state.progress).map(([item_id, completed]) => ({
          item_id,
          completed,
        })),
      );
    }
    if (url.pathname.endsWith("/user_favorites"))
      return json(state.favorites.map((article_id) => ({ article_id })));
    if (url.pathname.endsWith("/shop_products")) return json([]);
    if (url.pathname.endsWith("/site_profile")) return json(null);
    if (url.pathname.endsWith("/shop_settings"))
      return json({
        id: 1,
        enabled: false,
        recommendations_enabled: true,
        amazon_affiliate: false,
        seller_name: "",
        seller_address: "",
        tax_details: "",
        shipping_terms: "",
        returns_terms: "",
        terms_url: "",
      });
    if (url.pathname.endsWith("/session_documents")) {
      if (
        url.searchParams.get("session_document_access.user_id") !==
          `eq.${viewer?.id}` ||
        url.searchParams.get("state") !== "eq.ready" ||
        url.searchParams.get("active") !== "eq.true"
      )
        return json({ message: "Missing account restriction" }, 403);
      const own = viewer?.id === patient.id && state.assigned;
      const rows = own ? [copy(document)] : [];
      if (url.searchParams.get("id")) return json(rows[0] ?? null);
      return json(rows);
    }
    if (url.pathname.endsWith("/functions/v1/document-file")) {
      if (
        viewer?.id !== patient.id ||
        !state.assigned ||
        body?.document_id !== document.id
      )
        return json({ message: "Not found" }, 404);
      expect(body).toEqual({ action: "download", document_id: document.id });
      return route.fulfill({
        status: 200,
        headers,
        contentType: "application/pdf",
        body: pdf,
      });
    }
    unexpected.push(request.method() + " " + url.pathname);
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.dismiss());
  if (viewer) {
    await page.goto(
      `${origin}/profile#access_token=${token(viewer)}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`,
    );
    await expect(button(page, "Gestisci account")).toBeVisible();
  }
  return { page, context, state };
}
async function controlled(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))))
    await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
}
async function cacheSnapshot(page) {
  return page.evaluate(async () => {
    const result = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        result.push({ name, url: request.url, text: await response.text() });
      }
    }
    return result;
  });
}
async function safeCache(page) {
  const entries = await cacheSnapshot(page);
  expect(entries.length).toBeGreaterThan(0);
  for (const entry of entries) {
    expect(new URL(entry.url).pathname).toBe("/offline.html");
    expect(entry.text).not.toContain(pdfCanary);
    expect(entry.text).not.toContain(document.title);
    expect(entry.text).not.toContain(patient.email);
    expect(entry.url).not.toContain("access_token");
  }
  return entries.map(({ name, url }) => ({ name, url }));
}
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
}

try {
  const manifest = JSON.parse(
    await readFile(resolve(root, "manifest.webmanifest"), "utf8"),
  );
  expect(manifest.display).toBe("standalone");
  expect(manifest.scope).toBe("/");
  expect(manifest.id).toBe("/");
  expect(manifest.start_url).toBe("/?app=1");
  for (const size of ["192x192", "512x512"])
    expect(manifest.icons.some((icon) => icon.sizes === size)).toBe(true);
  for (const route of [
    "index",
    "installa",
    "miei-documenti",
    "documenti",
    "account",
  ])
    expect(await readFile(resolve(root, `${route}.html`), "utf8")).toContain(
      'rel="manifest"',
    );
  passed(
    "Packaged pages share an installable manifest and iPhone/Android icons",
  );

  const qrDesktop = await fixture({ width: 1280 });
  await qrDesktop.page.goto(origin + "/welcome");
  await qrDesktop.page
    .getByRole("link", { name: "App e QR code", exact: true })
    .click();
  await expect(heading(qrDesktop.page, "MAIA sul tuo telefono")).toBeVisible();
  const qrImage = qrDesktop.page
    .getByRole("img", {
      name: "QR code per aprire le istruzioni di installazione di MAIA",
      exact: true,
    })
    .first();
  await expect(qrImage).toBeVisible();
  const qrBounds = await qrImage.boundingBox();
  expect(qrBounds.y + qrBounds.height).toBeLessThanOrEqual(
    qrDesktop.page.viewportSize().height,
  );
  await expect(qrDesktop.page.getByRole("navigation")).toHaveCount(0);
  await expect(heading(qrDesktop.page, "Apri il menu di Safari")).toHaveCount(
    0,
  );
  await qrDesktop.page.screenshot({
    path: resolve(artifacts, "install-qr-first-screen-1280.png"),
  });
  await expect(
    qrDesktop.page.getByText("https://metimaia.com/installa", { exact: true }),
  ).toBeVisible();
  const qrResponse = await qrDesktop.page.request.get(
    origin + "/maia-app-qr.png",
  );
  expect(qrResponse.status()).toBe(200);
  const png = PNG.sync.read(await qrResponse.body());
  expect(
    jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data,
  ).toBe("https://metimaia.com/installa");
  const qrDownload = qrDesktop.page.getByRole("link", {
    name: "Scarica il QR code",
    exact: true,
  });
  await expect(qrDownload).toHaveAttribute("download", "QR-App-MAIA.png");
  const pendingQr = qrDesktop.page.waitForEvent("download");
  await qrDownload.click();
  const savedQr = await pendingQr;
  await savedQr.saveAs(resolve(artifacts, "qr-downloaded-from-site.png"));
  expect(
    PNG.sync.read(
      await readFile(resolve(artifacts, "qr-downloaded-from-site.png")),
    ).width,
  ).toBe(png.width);
  await button(
    qrDesktop.page,
    "Vedi anche i passaggi per iPhone e Android",
  ).click();
  await expect(heading(qrDesktop.page, "Apri il menu di Safari")).toBeVisible();
  await qrDesktop.page
    .getByRole("button", { name: "Android", exact: true })
    .click();
  await expect(heading(qrDesktop.page, "Apri il menu di Chrome")).toBeVisible();
  await expect(heading(qrDesktop.page, "Apri il menu di Safari")).toHaveCount(
    0,
  );
  await qrDesktop.page.screenshot({
    path: resolve(artifacts, "install-qr-desktop-1280.png"),
    fullPage: true,
  });
  await button(qrDesktop.page, "Chiudi i passaggi per il telefono").click();
  await expect(heading(qrDesktop.page, "Apri il menu di Chrome")).toHaveCount(
    0,
  );
  await qrDesktop.context.close();
  passed(
    "Public site navigation reaches a visible QR that independently decodes to the public install URL, downloads and offers device-specific steps",
  );

  const welcomePhone = await fixture({ ios: true });
  await welcomePhone.page.goto(origin + "/welcome");
  await button(welcomePhone.page, "Come aggiungere MAIA al telefono").click();
  await expect(
    heading(welcomePhone.page, "MAIA sul tuo telefono"),
  ).toBeVisible();
  await expect(
    heading(welcomePhone.page, "Apri il menu di Safari"),
  ).toBeVisible();
  await expect(
    welcomePhone.page.getByRole("img", {
      name: "QR code per aprire le istruzioni di installazione di MAIA",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(button(welcomePhone.page, "Installa MAIA")).toHaveCount(0);
  await expect(
    button(welcomePhone.page, "Invia le istruzioni a un’altra persona"),
  ).toHaveCount(0);
  await button(
    welcomePhone.page,
    "Vuoi aiutare un’altra persona a installare MAIA?",
  ).click();
  await button(welcomePhone.page, "Mostra il QR per un altro telefono").click();
  await expect(
    welcomePhone.page
      .getByRole("img", {
        name: "QR code per aprire le istruzioni di installazione di MAIA",
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await button(welcomePhone.page, "Nascondi il QR code").click();
  await expect(
    welcomePhone.page.getByRole("img", {
      name: "QR code per aprire le istruzioni di installazione di MAIA",
      exact: true,
    }),
  ).toHaveCount(0);
  await noOverflow(welcomePhone.page);
  await welcomePhone.page.screenshot({
    path: resolve(artifacts, "install-phone-direct-390.png"),
    fullPage: true,
  });
  await welcomePhone.context.close();
  passed(
    "A guest can open installation from mobile welcome, follow direct iPhone steps and show a QR only for a second phone",
  );

  const install = await fixture({ android: true });
  await install.page.goto(origin + "/installa");
  await expect(heading(install.page, "MAIA sul tuo telefono")).toBeVisible();
  await controlled(install.page);
  await expect
    .poll(() => install.page.evaluate(() => window.__dispatchInstallPrompt()))
    .toBe(true);
  await expect(button(install.page, "Installa MAIA")).toBeVisible();
  expect(await install.page.evaluate(() => window.__pwaPromptCalls)).toBe(0);
  await button(install.page, "Installa MAIA").click();
  expect(await install.page.evaluate(() => window.__pwaPromptCalls)).toBe(1);
  await noOverflow(install.page);
  await install.page.screenshot({
    path: resolve(artifacts, "install-android-390.png"),
  });
  await install.context.close();
  passed("Android installation prompt opens only after an explicit user click");

  for (const width of [320, 390]) {
    const ios = await fixture({
      width,
      height: 780,
      ios: true,
      iosVersion: 26,
    });
    await ios.page.addInitScript(() => {
      window.__guideShareCalls = 0;
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: async () => {
          window.__guideShareCalls++;
          throw new Error("Installation help must not open a share sheet");
        },
      });
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.__guideCopied = text;
          },
        },
      });
    });
    await ios.page.goto(origin + "/installa");
    await expect(heading(ios.page, "MAIA sul tuo telefono")).toBeVisible();
    const firstStep = heading(ios.page, "Apri il menu di Safari");
    await expect(firstStep).toBeVisible();
    const firstStepBounds = await firstStep.boundingBox();
    expect(firstStepBounds.y + firstStepBounds.height).toBeLessThan(780);
    await expect(
      ios.page.getByText(/tre puntini.*basso a destra/),
    ).toBeVisible();
    await expect(heading(ios.page, "Scegli Condividi / Share")).toBeVisible();
    await expect(
      ios.page.getByText(/Se è già visibile nella barra di Safari/),
    ).toBeVisible();
    await expect(ios.page.getByText(/Add to Home Screen/)).toBeVisible();
    await expect(button(ios.page, "Installa MAIA")).toHaveCount(0);
    await expect(ios.page.getByRole("navigation")).toHaveCount(0);
    await expect(button(ios.page, "Apri menu del sito")).toHaveCount(0);
    await expect(button(ios.page, "Copia l’indirizzo della guida")).toHaveCount(
      0,
    );
    await noOverflow(ios.page);
    await ios.page.screenshot({
      path: resolve(artifacts, `install-ios-${width}.png`),
    });
    await button(ios.page, "Non trovi questi comandi?").click();
    await expect(
      ios.page.getByText(/apri l’app Safari \(la bussola blu\)/),
    ).toBeVisible();
    await button(ios.page, "Copia l’indirizzo della guida").click();
    await expect(ios.page.getByText(/Indirizzo copiato/)).toBeVisible();
    expect(await ios.page.evaluate(() => window.__guideCopied)).toBe(
      "https://metimaia.com/installa",
    );
    expect(await ios.page.evaluate(() => window.__guideShareCalls)).toBe(0);
    await ios.page.evaluate(() => {
      navigator.clipboard.writeText = async () => {
        throw new Error("Clipboard denied");
      };
    });
    await button(ios.page, "Copia l’indirizzo della guida").click();
    await expect(
      ios.page.getByText(/Tieni premuto sull’indirizzo qui sotto/),
    ).toBeVisible();
    await expect(
      ios.page.getByText("https://metimaia.com/installa", { exact: true }),
    ).toBeVisible();
    expect(await ios.page.evaluate(() => window.__guideShareCalls)).toBe(0);
    await noOverflow(ios.page);
    await ios.page.screenshot({
      path: resolve(artifacts, `install-ios-help-${width}.png`),
    });
    await ios.context.close();
    passed(
      `${width}px: iPhone guide explains compact and older Safari controls; browser-opening help copies the public URL or offers manual copying without invoking Web Share`,
    );
  }

  const unknownPhone = await fixture({ width: 390 });
  await unknownPhone.page.goto(origin + "/installa");
  await expect(
    heading(unknownPhone.page, "Apri il menu di Safari"),
  ).toBeVisible();
  await expect(
    unknownPhone.page.getByRole("img", {
      name: "QR code per aprire le istruzioni di installazione di MAIA",
      exact: true,
    }),
  ).toHaveCount(0);
  await noOverflow(unknownPhone.page);
  await unknownPhone.context.close();
  passed(
    "A narrow browser with an unrecognised desktop user agent prioritises phone steps rather than a QR for its own screen",
  );

  const mobileMenu = await fixture({ width: 390, ios: true });
  await mobileMenu.page.goto(origin + "/welcome");
  await expect(button(mobileMenu.page, "Apri menu del sito")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(
    mobileMenu.page.getByRole("navigation", { name: "Menu del sito" }),
  ).toHaveCount(0);
  await button(mobileMenu.page, "Apri menu del sito").click();
  await expect(button(mobileMenu.page, "Chiudi menu del sito")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  const publicMenu = mobileMenu.page.getByRole("navigation", {
    name: "Menu del sito",
  });
  await expect(
    publicMenu.getByRole("link", { name: "Contatti", exact: true }),
  ).toBeVisible();
  await noOverflow(mobileMenu.page);
  await mobileMenu.page.screenshot({
    path: resolve(artifacts, "mobile-public-menu-390.png"),
  });
  await button(mobileMenu.page, "Chiudi menu del sito").click();
  await expect(publicMenu).toHaveCount(0);
  await button(mobileMenu.page, "Apri menu del sito").click();
  await publicMenu.getByRole("link", { name: "Contatti", exact: true }).click();
  await expect(mobileMenu.page).toHaveURL(/\/contatti$/);
  await expect(button(mobileMenu.page, "Apri menu del sito")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(publicMenu).toHaveCount(0);
  await mobileMenu.context.close();
  passed(
    "Mobile public navigation opens and closes explicitly, keeps contacts reachable and closes after navigating",
  );

  const installedGuest = await fixture({
    width: 390,
    standalone: true,
    ios: true,
  });
  await installedGuest.page.goto(origin + "/welcome");
  await expect(button(installedGuest.page, "Crea un account")).toHaveCount(1);
  await expect(
    button(installedGuest.page, "Hai già un account? Accedi"),
  ).toHaveCount(1);
  await expect(
    // React Native Web gives the image wrapper and its img the same name.
    // Count actual image nodes to detect a second logo in the content.
    installedGuest.page.locator('img[alt="MAIA"]'),
  ).toHaveCount(1);
  await expect(
    button(installedGuest.page, "Come aggiungere MAIA al telefono"),
  ).toHaveCount(0);
  await expect(
    button(installedGuest.page, "Installa MAIA sul telefono"),
  ).toHaveCount(0);
  await expect(
    installedGuest.page.getByRole("navigation", { name: "Menu del sito" }),
  ).toHaveCount(0);
  await noOverflow(installedGuest.page);
  await installedGuest.page.screenshot({
    path: resolve(artifacts, "installed-guest-welcome-390.png"),
  });
  await installedGuest.page.goto(origin + "/installa");
  await expect(
    heading(installedGuest.page, "Sei già nell’app MAIA"),
  ).toBeVisible();
  await expect(
    heading(installedGuest.page, "Apri il menu di Safari"),
  ).toHaveCount(0);
  await button(installedGuest.page, "Accedi al mio account").click();
  await expect(installedGuest.page).toHaveURL(/\/account\?mode=login$/);
  await installedGuest.context.close();
  passed(
    "An installed guest sees one signup action, no installation promotion, and can continue from the already-installed page directly to login",
  );

  for (const width of [390, 1280]) {
    const app = await fixture({ width, viewer: patient, standalone: true });
    app.state.progress[itemId] = true;
    // A new page keeps only the persisted account. Its navigation provider
    // starts fresh, like opening the installed icon after closing the app.
    const launch = await app.context.newPage();
    launch.on("pageerror", (error) => errors.push(error.message));
    launch.on("dialog", (dialog) => dialog.dismiss());
    await app.page.close();
    app.page = launch;
    await app.page.goto(origin + "/?app=1");
    try {
      await expect(button(app.page, "Apri i miei documenti")).toBeVisible();
    } catch (error) {
      console.log(
        "COLD LAUNCH DIAGNOSTIC",
        JSON.stringify({
          browser: await app.page.evaluate(() => ({
            url: window.location.href,
            standalone: window.matchMedia("(display-mode: standalone)").matches,
            storageKeys: Object.keys(window.localStorage),
          })),
          calls: app.state.calls.slice(-15),
          errors,
        }),
      );
      throw error;
    }
    await expect(heading(app.page, "Crescere insieme.")).toHaveCount(0);
    await expect(
      app.page.getByText("RIPRENDI DA QUI", { exact: true }),
    ).toBeVisible();
    const resume = button(app.page, checklist.title);
    const resumeBounds = await resume.boundingBox();
    await expect(button(app.page, "Scopri i consigli d’acquisto")).toHaveCount(
      0,
    );
    const moreOptions = button(app.page, "Altre opzioni");
    await expect(moreOptions).toHaveAttribute("aria-expanded", "false");
    expect(resumeBounds.y + resumeBounds.height).toBeLessThanOrEqual(
      app.page.viewportSize().height - 84,
    );
    await app.page.screenshot({
      path: resolve(artifacts, `essential-home-installed-${width}.png`),
    });
    await moreOptions.click();
    await expect(moreOptions).toHaveAttribute("aria-expanded", "true");
    await expect(
      button(app.page, "Scopri i consigli d’acquisto"),
    ).toBeVisible();
    const shoppingBounds = await button(
      app.page,
      "Scopri i consigli d’acquisto",
    ).boundingBox();
    expect(resumeBounds.y).toBeLessThan(shoppingBounds.y);
    await moreOptions.click();
    await expect(button(app.page, "Scopri i consigli d’acquisto")).toHaveCount(
      0,
    );
    // Opening the secondary options scrolls down; return to the main action.
    await resume.scrollIntoViewIfNeeded();
    await resume.click();
    const firstActivity = app.page.getByRole("checkbox").first();
    await expect(firstActivity).toBeVisible();
    const firstActivityBounds = await firstActivity.boundingBox();
    expect(
      firstActivityBounds.y + firstActivityBounds.height,
    ).toBeLessThanOrEqual(app.page.viewportSize().height);
    await expect(
      button(app.page, "Condividi lo stato della checklist"),
    ).toHaveCount(0);
    const sharing = button(app.page, "Condividi e organizza insieme");
    await expect(sharing).toHaveAttribute("aria-expanded", "false");
    await sharing.click();
    await expect(
      button(app.page, "Condividi lo stato della checklist"),
    ).toBeVisible();
    await expect(sharing).toHaveAttribute("aria-expanded", "true");
    await sharing.click();
    await expect(
      button(app.page, "Condividi lo stato della checklist"),
    ).toHaveCount(0);
    await app.page.screenshot({
      path: resolve(artifacts, `usability-checklist-${width}.png`),
    });
    await button(app.page, "Indietro").click();
    passed(
      `${width}px: resume appears before shopping and above the tabs; checklist activities precede optional sharing`,
    );
    const tabs = app.page.getByRole("tab");
    await expect(tabs).toHaveCount(5);
    for (const label of [
      "Percorso",
      "Letture",
      "Checklist",
      "Documenti",
      "Profilo",
    ])
      await expect(
        app.page.getByRole("tab", { name: new RegExp(label) }),
      ).toBeVisible();
    await app.page.getByRole("tab", { name: /Documenti/ }).click();
    await expect(heading(app.page, document.title)).toBeVisible();
    await expect(
      app.page.getByLabel("Cerca nei miei documenti", { exact: true }),
    ).toHaveCount(0);
    const firstDownloadBounds = await button(
      app.page,
      "Scarica PDF",
    ).boundingBox();
    expect(
      firstDownloadBounds.y + firstDownloadBounds.height,
    ).toBeLessThanOrEqual(app.page.viewportSize().height - 84);
    await button(app.page, "Cerca o filtra i materiali").click();
    await app.page
      .getByLabel("Cerca nei miei documenti", { exact: true })
      .fill("Materiale");
    await button(app.page, "Cerca documenti").click();
    await button(app.page, "Chiudi ricerca e filtri").click();
    await expect(
      app.page.getByText("Ricerca o filtro attivo", { exact: true }),
    ).toBeVisible();
    await button(app.page, "Mostra tutti i materiali").click();
    await expect(heading(app.page, document.title)).toBeVisible();
    await expect(button(app.page, "Mostra tutti i materiali")).toHaveCount(0);
    await app.page.screenshot({
      path: resolve(artifacts, `usability-documents-${width}.png`),
    });
    await expect(
      app.page.getByRole("navigation", { name: "Menu del sito" }),
    ).toHaveCount(0);
    await app.page.getByRole("tab", { name: /Profilo/ }).click();
    await button(app.page, "Consigli d’acquisto").click();
    await expect(heading(app.page, "Consigli d’acquisto")).toBeVisible();
    await app.page.goto(origin + "/installa");
    await expect(heading(app.page, "Sei già nell’app MAIA")).toBeVisible();
    await expect(button(app.page, "Installa MAIA")).toHaveCount(0);
    await noOverflow(app.page);
    await app.page.screenshot({
      path: resolve(artifacts, `installed-${width}.png`),
    });
    await button(app.page, "Continua nel mio percorso").click();
    await expect(button(app.page, "Apri i miei documenti")).toBeVisible();
    await app.context.close();
    passed(
      `${width}px: installed app uses five patient tabs, preserves shop access and hides redundant install prompts`,
    );
  }

  const web = await fixture({ viewer: patient });
  await web.page.goto(origin + "/checklists");
  await expect(web.page.getByRole("tab", { name: /Consigli/ })).toBeVisible();
  await expect(web.page.getByRole("tab", { name: /^Documenti$/ })).toHaveCount(
    0,
  );
  await web.context.close();
  passed(
    "Ordinary browser retains the existing navigation and recommendations tab",
  );

  const shareInstall = await fixture();
  await shareInstall.page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__installCopied = text;
        },
      },
    });
  });
  await shareInstall.page.goto(origin + "/installa");
  await expect(
    button(shareInstall.page, "Invia le istruzioni a un’altra persona"),
  ).toHaveCount(0);
  await button(
    shareInstall.page,
    "Vuoi aiutare un’altra persona a installare MAIA?",
  ).click();
  await button(
    shareInstall.page,
    "Invia le istruzioni a un’altra persona",
  ).click();
  await expect(
    shareInstall.page.getByText(/Testo e link copiati/),
  ).toBeVisible();
  const copiedInstall = await shareInstall.page.evaluate(
    () => window.__installCopied,
  );
  expect(copiedInstall).toContain("https://metimaia.com/installa");
  expect(copiedInstall).not.toContain(patient.email);
  expect(copiedInstall).not.toContain(patient.id);
  expect(copiedInstall).not.toContain("access_token");
  await shareInstall.page.evaluate(() => {
    navigator.clipboard.writeText = async () => {
      throw new Error("Denied");
    };
  });
  await button(
    shareInstall.page,
    "Invia le istruzioni a un’altra persona",
  ).click();
  await expect(
    shareInstall.page.getByText(/Seleziona e copia il testo qui sotto/),
  ).toBeVisible();
  await expect(
    shareInstall.page.getByText(copiedInstall, { exact: true }),
  ).toBeVisible();
  await shareInstall.context.close();
  passed(
    "Installation link sharing copies only the public link and offers manual copying when clipboard access is denied",
  );

  const focusedChecklist = await fixture({ viewer: patient, standalone: true });
  focusedChecklist.state.progress[itemId] = true;
  await focusedChecklist.page.goto(`${origin}/checklist?id=${checklist.id}`);
  await expect(
    focusedChecklist.page.getByRole("checkbox").first(),
  ).toBeChecked();
  await button(focusedChecklist.page, "Da fare").click();
  await expect(focusedChecklist.page.getByRole("checkbox")).toHaveCount(1);
  let finishWrite;
  focusedChecklist.state.progressWriteGate = new Promise((done) => {
    finishWrite = done;
  });
  const remainingItem = focusedChecklist.page.getByRole("checkbox");
  const writesBefore = focusedChecklist.state.calls.filter(
    (c) => c.path.endsWith("/checklist_progress") && c.method !== "GET",
  ).length;
  await remainingItem.evaluate((element) => {
    element.click();
    element.click();
  });
  await expect(
    focusedChecklist.page.getByText("Salvataggio…", { exact: true }),
  ).toBeVisible();
  await expect(remainingItem).toBeDisabled();
  await expect
    .poll(
      () =>
        focusedChecklist.state.calls.filter(
          (c) => c.path.endsWith("/checklist_progress") && c.method !== "GET",
        ).length,
    )
    .toBe(writesBefore + 1);
  finishWrite();
  await expect(focusedChecklist.page.getByRole("checkbox")).toHaveCount(0);
  await expect(
    focusedChecklist.page.getByText(/Non restano attività da fare/),
  ).toBeVisible();
  await button(focusedChecklist.page, "Tutte le attività").click();
  await expect(focusedChecklist.page.getByRole("checkbox")).toHaveCount(2);
  for (const checkbox of await focusedChecklist.page
    .getByRole("checkbox")
    .all())
    await expect(checkbox).toBeChecked();
  passed(
    "Checklist remaining filter preserves progress, announces an in-flight save and prevents duplicate submissions",
  );

  await focusedChecklist.context.setOffline(true);
  await expect(
    focusedChecklist.page.getByText(/Sei senza connessione/),
  ).toBeVisible();
  await expect(focusedChecklist.page.getByRole("checkbox")).toHaveCount(2);
  await focusedChecklist.context.setOffline(false);
  await expect(
    focusedChecklist.page.getByText(/Sei senza connessione/),
  ).toHaveCount(0);
  await focusedChecklist.context.close();
  passed(
    "An already-open app explains connection loss and clears the connection notice after reconnecting",
  );

  const catalogStates = await fixture({ viewer: patient });
  let finishCatalog;
  catalogStates.state.catalogGate = new Promise((done) => {
    finishCatalog = done;
  });
  let catalogPage = await catalogStates.context.newPage();
  catalogPage.on("pageerror", (error) => errors.push(error.message));
  await catalogPage.goto(`${origin}/checklist?id=${checklist.id}`);
  await expect(
    catalogPage.getByText("Caricamento checklist…", { exact: true }),
  ).toBeVisible();
  await expect(
    catalogPage.getByText("Checklist non disponibile", { exact: true }),
  ).toHaveCount(0);
  finishCatalog();
  catalogStates.state.catalogGate = null;
  await expect(catalogPage.getByRole("checkbox")).toHaveCount(2);
  await catalogPage.close();
  catalogStates.state.failCatalog = true;
  catalogPage = await catalogStates.context.newPage();
  catalogPage.on("pageerror", (error) => errors.push(error.message));
  await catalogPage.goto(`${origin}/checklist?id=${checklist.id}`);
  await expect(
    button(catalogPage, "Riprova caricamento checklist"),
  ).toBeVisible();
  await expect(
    catalogPage.getByText("Checklist non disponibile", { exact: true }),
  ).toHaveCount(0);
  catalogStates.state.failCatalog = false;
  await button(catalogPage, "Riprova caricamento checklist").click();
  await expect(catalogPage.getByRole("checkbox")).toHaveCount(2);
  await catalogPage.close();
  catalogStates.state.emptyCatalog = true;
  catalogPage = await catalogStates.context.newPage();
  catalogPage.on("pageerror", (error) => errors.push(error.message));
  await catalogPage.goto(`${origin}/checklist?id=${checklist.id}`);
  await expect(
    catalogPage.getByText("Checklist non disponibile", { exact: true }),
  ).toBeVisible();
  await button(catalogPage, "Vai alle checklist").click();
  await expect(
    heading(catalogPage, "Un piccolo passo alla volta."),
  ).toBeVisible();
  await catalogStates.context.close();
  passed(
    "Checklist loading, a failed catalogue with retry, and genuinely missing content have distinct usable states",
  );

  const sync = await fixture({ viewer: patient, standalone: true });
  await sync.page.goto(`${origin}/checklist?id=${checklist.id}`);
  const firstItem = sync.page.getByRole("checkbox", {
    name: checklist.items[0].label,
    exact: true,
  });
  await expect(firstItem).not.toBeChecked();
  sync.state.progress[itemId] = true;
  const before = sync.state.calls.filter((c) =>
    c.path.endsWith("/checklist_progress"),
  ).length;
  await sync.page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(firstItem).toBeChecked();
  expect(
    sync.state.calls.filter((c) => c.path.endsWith("/checklist_progress"))
      .length,
  ).toBeGreaterThan(before);
  sync.state.failProgress = true;
  await firstItem.click();
  await expect(
    sync.page.getByText(/Non abbiamo salvato la modifica/).first(),
  ).toBeVisible();
  await expect(firstItem).toBeChecked();
  sync.state.failProgressRead = true;
  sync.state.progress[itemId] = false;
  await sync.page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(button(sync.page, "Riprova aggiornamento dati")).toBeVisible();
  await expect(
    sync.page
      .getByText(
        /Le informazioni mostrate potrebbero non includere le ultime modifiche/,
      )
      .first(),
  ).toBeVisible();
  await expect(firstItem).toBeChecked();
  sync.state.failProgressRead = false;
  await button(sync.page, "Riprova aggiornamento dati").click();
  await expect(firstItem).not.toBeChecked();
  await expect(button(sync.page, "Riprova aggiornamento dati")).toHaveCount(0);
  await sync.context.close();
  passed(
    "Returning to the app reloads another device’s checklist progress; failed writes never appear saved and failed reads warn before explicit retry",
  );

  const privateFiles = await fixture({ viewer: patient });
  await privateFiles.page.goto(origin + "/miei-documenti");
  await expect(heading(privateFiles.page, document.title)).toBeVisible();
  await controlled(privateFiles.page);
  await expect(heading(privateFiles.page, document.title)).toBeVisible();
  const downloaded = privateFiles.page.waitForEvent("download");
  await button(privateFiles.page, "Scarica PDF").click();
  const saved = await downloaded;
  const savedPath = resolve(artifacts, "private-fixture-download.pdf");
  await saved.saveAs(savedPath);
  expect((await readFile(savedPath)).toString()).toContain(pdfCanary);
  const cachesAfterPrivate = await safeCache(privateFiles.page);
  privateFiles.state.assigned = false;
  await privateFiles.page.evaluate(() =>
    window.dispatchEvent(new Event("focus")),
  );
  await expect(heading(privateFiles.page, document.title)).toHaveCount(0);
  privateFiles.state.offline = true;
  await privateFiles.context.setOffline(true);
  await privateFiles.page.goto(origin + "/miei-documenti");
  await expect(
    privateFiles.page.getByText(/connessione|offline/i).first(),
  ).toBeVisible();
  await expect(
    privateFiles.page.getByText(document.title, { exact: true }),
  ).toHaveCount(0);
  expect(await privateFiles.page.locator("body").textContent()).not.toContain(
    pdfCanary,
  );
  const offlineCaches = await safeCache(privateFiles.page);
  await privateFiles.page.screenshot({
    path: resolve(artifacts, "offline-private-route.png"),
  });
  await privateFiles.context.close();
  passed(
    "Real service worker caches only the generic offline page, never assigned document bytes or private navigation",
  );

  const unrelated = await fixture({ viewer: outsider, standalone: true });
  await unrelated.page.goto(origin + "/documenti");
  await expect(
    unrelated.page.getByText(
      /Gaia non ha ancora condiviso materiali con questo account/,
    ),
  ).toBeVisible();
  await expect(heading(unrelated.page, document.title)).toHaveCount(0);
  await controlled(unrelated.page);
  await safeCache(unrelated.page);
  await unrelated.context.close();
  passed(
    "Another account cannot discover the patient’s document in the installed app",
  );

  const stuckUpdate = await fixture({ viewer: patient, standalone: true });
  await stuckUpdate.page.addInitScript(() => {
    const target = new EventTarget();
    const worker = {
      state: "installed",
      postMessage: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    const registration = {
      waiting: worker,
      installing: null,
      update: async () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: Object.assign(target, {
        controller: {},
        register: async () => registration,
        ready: Promise.resolve(registration),
      }),
    });
    window.__lateWorkerActivation = () =>
      target.dispatchEvent(new Event("controllerchange"));
  });
  await stuckUpdate.page.clock.install();
  await stuckUpdate.page.goto(origin + "/profile");
  const pendingNickname = stuckUpdate.page.getByLabel("Nickname del profilo", {
    exact: true,
  });
  await expect(pendingNickname).toHaveValue("Account PWA");
  await pendingNickname.fill("Bozza in attesa");
  await button(stuckUpdate.page, "Aggiorna MAIA").click();
  await expect(button(stuckUpdate.page, "Aggiorna MAIA")).toBeDisabled();
  await stuckUpdate.page.clock.fastForward(20_100);
  await expect(button(stuckUpdate.page, "Aggiorna MAIA")).toBeEnabled();
  await expect(
    stuckUpdate.page.getByText(/sta impiegando più del previsto/),
  ).toBeVisible();
  await expect(pendingNickname).toHaveValue("Bozza in attesa");
  await stuckUpdate.page.evaluate(() => window.__lateWorkerActivation());
  await expect(pendingNickname).toHaveValue("Bozza in attesa");
  await button(stuckUpdate.page, "Aggiorna MAIA").click();
  await expect(pendingNickname).toHaveValue("Bozza in attesa");
  await stuckUpdate.context.close();
  passed(
    "An unresponsive update unlocks retry after twenty seconds; late activation does not reload an unsaved profile",
  );

  const update = await fixture({ viewer: patient, standalone: true });
  await update.page.goto(origin + "/profile");
  await controlled(update.page);
  const nickname = update.page.getByLabel("Nickname del profilo", {
    exact: true,
  });
  await expect(nickname).toBeVisible();
  await nickname.fill("Una modifica da conservare");
  workerRevision++;
  await update.page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration.update();
  });
  await expect(button(update.page, "Aggiorna MAIA")).toBeVisible();
  await expect(nickname).toHaveValue("Una modifica da conservare");
  await button(update.page, "Aggiorna MAIA").click();
  await expect(nickname).toHaveValue("Una modifica da conservare");
  await expect(
    update.page.getByText(
      "Salva le modifiche e premi Aggiorna MAIA quando sei pronta.",
      { exact: true },
    ),
  ).toBeVisible();
  await update.page.screenshot({
    path: resolve(artifacts, "update-preserves-unsaved-profile.png"),
  });
  await nickname.fill("Account PWA");
  await button(update.page, "Aggiorna MAIA").click();
  await expect(
    update.page.getByLabel("Nickname del profilo", { exact: true }),
  ).toHaveValue("Account PWA");
  await expect(button(update.page, "Aggiorna MAIA")).toHaveCount(0);
  await update.context.close();
  passed(
    "A waiting update is explicit and declining the unsaved-change confirmation preserves the edited profile",
  );

  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
  await writeFile(
    resolve(artifacts, "results.json"),
    JSON.stringify(
      { root, checks, errors, unexpected, cachesAfterPrivate, offlineCaches },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ checks: checks.length, errors, unexpected, artifacts }),
  );
} finally {
  await Promise.allSettled(contexts.map((context) => context.close()));
  await browser.close();
  await new Promise((ready) => server.close(ready));
}
