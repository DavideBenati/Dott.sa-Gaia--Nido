// Presentation regression against a production static build. Every external
// service is intercepted: no real account, phone call, message or write.
import { createServer } from "node:http";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const root = resolve(process.argv[2] ?? "apps/mobile/dist-web");
const port = Number(process.env.MAIA_GAIA_PRESENTATION_PORT ?? 8117);
const origin = `http://127.0.0.1:${port}`;
const artifacts = resolve(
  process.env.MAIA_GAIA_PRESENTATION_ARTIFACTS ??
    "/workspace/shared/downloads/presentazione-gaia-v8-2/browser",
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
};
const server = createServer(async (request, response) => {
  try {
    let file = resolve(
      root,
      "." + decodeURIComponent(new URL(request.url, origin).pathname),
    );
    if (file !== root && !file.startsWith(root + "/")) {
      response.writeHead(403).end();
      return;
    }
    if (file === root) file += "/index.html";
    try {
      if (!(await stat(file)).isFile()) throw new Error();
    } catch {
      file += ".html";
    }
    response.setHeader(
      "Content-Type",
      mime[extname(file)] ?? "application/octet-stream",
    );
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((ready) => server.listen(port, "127.0.0.1", ready));
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-external-intent-requests"],
});
const contexts = [];
const unexpected = [];
const pageerrors = [];
const checks = [];
const copy = (value) => JSON.parse(JSON.stringify(value));
const serviceTitles = [
  "Corsi di accompagnamento al parto",
  "Ginnastica e movimento in gravidanza",
  "Aromaterapia e gestione dello stress",
  "Supporto dopo il parto e allattamento",
];
const legacyProfile = {
  id: 1,
  bio: "Come ostetrica desidero accompagnarvi con ascolto, rispetto e competenza. Ogni famiglia ha la propria storia, i propri tempi e il proprio modo di crescere insieme.",
  portrait_url: "",
  qualifications: "",
  service_area: "Modalità, luoghi e disponibilità da concordare direttamente.",
  services: [],
  contact_email: "ostetricamaia@gmail.com",
  privacy_providers: "Fornitori già salvati, da conservare.",
  privacy_retention: "Criteri di conservazione già salvati, da conservare.",
  privacy_transfers: "Garanzie già salvate, da conservare.",
  privacy_reviewed: true,
};
const customProfile = {
  ...legacyProfile,
  bio: "Presentazione personalizzata già salvata.",
  portrait_url: "https://images.example.invalid/gaia-portrait.png",
  qualifications: "Formazione personalizzata già salvata.",
  service_area: "Zona personalizzata già salvata.",
  services: [
    {
      title: "Servizio già configurato",
      description: "Descrizione già configurata.",
      details: "Dettagli già configurati.",
    },
  ],
  contact_email: "professional-beta@example.invalid",
};
const at = new Date().toISOString();
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "studio-beta@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: at,
  created_at: at,
  app_metadata: {},
  user_metadata: {},
  identities: [],
};
const now = Math.floor(Date.now() / 1000);
const token = [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  ),
  Buffer.from(
    JSON.stringify({
      sub: user.id,
      role: "authenticated",
      aud: "authenticated",
      aal: "aal2",
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url"),
  "test-only-not-a-valid-signature",
].join(".");

function passed(name) {
  checks.push(name);
  console.log(`PASS ${name}`);
}
async function fixture({
  width = 390,
  admin = false,
  profile = legacyProfile,
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height: width > 900 ? 1000 : 844 },
    serviceWorkers: "block",
  });
  contexts.push(context);
  await context.addInitScript(() => {
    window.__maiaOpenedURLs = [];
    window.open = (url) => {
      window.__maiaOpenedURLs.push(String(url));
      return null;
    };
  });
  const state = { profile: copy(profile), failProfile: false, calls: [] };
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === "images.example.invalid")
      return route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
          "base64",
        ),
      });
    if (!url.hostname.endsWith(".supabase.co")) {
      unexpected.push({
        method: request.method(),
        url: url.origin + url.pathname,
      });
      return route.abort("blockedbyclient");
    }
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS",
    };
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    const body = request.headers()["content-type"]?.includes("application/json")
      ? request.postDataJSON()
      : null;
    state.calls.push({ method: request.method(), path: url.pathname, body });
    const json = (value, status = 200) =>
      route.fulfill({
        status,
        headers,
        contentType: "application/json",
        body: JSON.stringify(value),
      });
    if (url.pathname.endsWith("/auth/v1/user"))
      return json({ ...user, factors: [] });
    if (url.pathname.endsWith("/rpc/is_editor")) return json(admin);
    if (url.pathname.endsWith("/rpc/is_chat_staff")) return json(false);
    if (url.pathname.endsWith("/rpc/care_chat_available")) return json(false);
    if (url.pathname.endsWith("/rpc/professional_access_status"))
      return json({
        editor: admin,
        chat: false,
        mfa_required: false,
        mfa_satisfied: true,
      });
    if (url.pathname.endsWith("/site_profile")) {
      if (request.method() === "GET")
        return state.failProfile
          ? json(
              { code: "XX000", message: "Simulated profile read error" },
              500,
            )
          : json(state.profile);
      if (request.method() === "POST" && admin) {
        state.profile = copy(body);
        return json(state.profile);
      }
    }
    if (
      [
        "articles",
        "checklists",
        "article_categories",
        "user_favorites",
        "checklist_progress",
      ].some((name) => url.pathname.endsWith("/" + name))
    )
      return json([]);
    if (
      ["user_preferences", "notification_preferences"].some((name) =>
        url.pathname.endsWith("/" + name),
      )
    )
      return json(null);
    unexpected.push({
      method: request.method(),
      url: url.origin + url.pathname,
    });
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => pageerrors.push(error.message));
  if (admin) {
    await page.goto(
      `${origin}/account#access_token=${token}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`,
    );
    await expect(page.getByText(user.email, { exact: true })).toBeVisible();
  }
  return { context, page, state };
}
async function noOverflow(page, label) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  passed(`${label}: no horizontal overflow`);
}
async function suppliedCopy(page, label) {
  await expect(
    page.getByRole("heading", { name: "Dott.sa Gaia", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/^Ciao, sono Gaia\./).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/Da 5 anni lavoro come ostetrica/).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/oltre 2.300 ore di tirocinio/).filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText(/Master biennale in Oli Essenziali.*in fase di completamento/)
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(
    page
      .getByText(/Si tratta di una ricerca in corso\./)
      .filter({ visible: true }),
  ).toBeVisible();
  for (const title of serviceTitles)
    await expect(
      page.getByText(title, { exact: true }).filter({ visible: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Chiedi informazioni e disponibilità",
      exact: true,
    }),
  ).toHaveCount(4);
  await expect(page.locator("body")).not.toContainText(/brunetti/i);
  await expect(
    page.getByText(
      /Le richieste da questo sito riguardano le consulenze private/,
    ),
  ).toBeVisible();
  passed(
    `${label}: supplied biography, training status and four services displayed`,
  );
}
async function phoneActions(context, page, label) {
  await expect(page.getByText("392 793 9566", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Apri WhatsApp", exact: true })
    .click();
  expect(await page.evaluate(() => window.__maiaOpenedURLs)).toContain(
    "https://wa.me/393927939566",
  );
  // React Native Web uses location for tel:, rather than window.open. Observe
  // the requested protocol URL in headless Chromium; no phone handler exists.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Page.enable");
  const requested = [];
  cdp.on("Page.frameRequestedNavigation", (event) => requested.push(event.url));
  await page.getByRole("button", { name: "Chiama Gaia", exact: true }).click();
  await expect.poll(() => requested.includes("tel:+393927939566")).toBe(true);
  await cdp.detach();
  passed(`${label}: WhatsApp and phone request the supplied contact URLs`);
}

let currentPage;
try {
  for (const width of [390, 1440]) {
    const { context, page, state } = await fixture({ width });
    currentPage = page;
    const original = copy(state.profile);
    await page.goto(`${origin}/gaia`);
    await suppliedCopy(page, `${width}px legacy profile`);
    await noOverflow(page, `${width}px biography`);
    await page.screenshot({
      path: `${artifacts}/gaia-${width}.png`,
      fullPage: true,
    });
    await phoneActions(context, page, `${width}px biography`);
    expect(state.profile).toEqual(original);
    expect(
      state.calls.filter(
        (call) => call.path.endsWith("/site_profile") && call.method !== "GET",
      ),
    ).toEqual([]);
    passed(
      `${width}px public fallback does not write or mutate the stored profile`,
    );
    await page.goto(`${origin}/contatti`);
    await phoneActions(context, page, `${width}px contacts`);
    await noOverflow(page, `${width}px contacts`);

    const custom = await fixture({
      width,
      profile: { ...customProfile, services: [] },
    });
    currentPage = custom.page;
    await custom.page.goto(`${origin}/gaia`);
    await expect(
      custom.page.getByText(customProfile.bio, { exact: true }),
    ).toBeVisible();
    await expect(
      custom.page.getByText(customProfile.qualifications, { exact: true }),
    ).toBeVisible();
    await expect(
      custom.page.getByText(customProfile.service_area, { exact: true }),
    ).toBeVisible();
    await expect(
      custom.page.getByRole("button", {
        name: "Chiedi informazioni e disponibilità",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(custom.page.getByText(/^Ciao, sono Gaia\./)).toHaveCount(0);
    await noOverflow(custom.page, `${width}px customized profile`);
    passed(
      `${width}px customized presentation and intentionally empty services preserved`,
    );
  }

  const admin = await fixture({
    width: 390,
    admin: true,
    profile: customProfile,
  });
  currentPage = admin.page;
  const { page, state } = admin;
  state.failProfile = true;
  await page.goto(`${origin}/impostazioni`);
  await expect(
    page.getByRole("button", {
      name: "Riprova caricamento informazioni",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Usa la presentazione dal documento",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Presentazione", { exact: true })).toHaveCount(
    0,
  );
  expect(
    state.calls.filter(
      (call) => call.path.endsWith("/site_profile") && call.method === "POST",
    ),
  ).toEqual([]);
  passed("failed administrative read hides import, inputs and save actions");

  state.failProfile = false;
  await page
    .getByRole("button", {
      name: "Riprova caricamento informazioni",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Presentazione", { exact: true })).toHaveValue(
    customProfile.bio,
  );
  await expect(
    page.getByLabel("Titolo servizio 1", { exact: true }),
  ).toHaveValue(customProfile.services[0].title);
  await expect(
    page.getByLabel("Email pubblica di contatto", { exact: true }),
  ).toHaveValue(customProfile.contact_email);
  await expect(
    page.getByRole("button", { name: "Salva modifiche", exact: true }),
  ).toBeDisabled();
  passed(
    "administrative editor loads original saved presentation without implicit import",
  );

  await page
    .getByLabel("Presentazione", { exact: true })
    .fill("Bozza da non perdere");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", {
      name: "Usa la presentazione dal documento",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Presentazione", { exact: true })).toHaveValue(
    "Bozza da non perdere",
  );
  await expect(
    page.getByLabel("Titolo servizio 1", { exact: true }),
  ).toHaveValue(customProfile.services[0].title);
  passed("cancelled import keeps unsaved biography and existing services");

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", {
      name: "Usa la presentazione dal documento",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Presentazione", { exact: true })).toHaveValue(
    /^Ciao, sono Gaia\./,
  );
  await expect(
    page.getByLabel("Qualifiche e iscrizione professionale verificate", {
      exact: true,
    }),
  ).toHaveValue(/in fase di completamento.*ricerca in corso/s);
  for (const [index, title] of serviceTitles.entries())
    await expect(
      page.getByLabel(`Titolo servizio ${index + 1}`, { exact: true }),
    ).toHaveValue(title);
  await expect(
    page.getByLabel("Email pubblica di contatto", { exact: true }),
  ).toHaveValue("ostetricamaia@gmail.com");
  await expect(
    page.getByLabel("Foto: URL HTTPS (facoltativo)", { exact: true }),
  ).toHaveValue(customProfile.portrait_url);
  await expect(
    page.getByLabel("Fornitori e ruoli", { exact: true }),
  ).toHaveValue(customProfile.privacy_providers);
  await expect(
    page.getByLabel("Tempi e criteri di conservazione", { exact: true }),
  ).toHaveValue(customProfile.privacy_retention);
  await expect(
    page.getByLabel("Trasferimenti e garanzie", { exact: true }),
  ).toHaveValue(customProfile.privacy_transfers);
  expect(
    state.calls.filter(
      (call) => call.path.endsWith("/site_profile") && call.method === "POST",
    ),
  ).toEqual([]);
  passed(
    "explicit import populates document content while preserving photo and privacy without writing",
  );
  await noOverflow(page, "390px administrative editor");
  await page
    .getByRole("button", { name: "Salva modifiche", exact: true })
    .click();
  await expect(
    page.getByText(
      "Modifiche salvate. La pagina Gaia e servizi è aggiornata.",
      { exact: true },
    ),
  ).toBeVisible();
  const writes = state.calls.filter(
    (call) => call.path.endsWith("/site_profile") && call.method === "POST",
  );
  expect(writes).toHaveLength(1);
  const submitted = writes[0].body;
  expect(submitted.bio).toMatch(/^Ciao, sono Gaia\./);
  expect(submitted.services.map((service) => service.title)).toEqual(
    serviceTitles,
  );
  expect(submitted.contact_email).toBe("ostetricamaia@gmail.com");
  for (const key of [
    "id",
    "portrait_url",
    "privacy_providers",
    "privacy_retention",
    "privacy_transfers",
    "privacy_reviewed",
  ])
    expect(submitted[key]).toEqual(customProfile[key]);
  expect(submitted.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  passed(
    "one explicit save sends supplied content and preserves original photo/privacy fields",
  );

  await page
    .getByRole("button", { name: "Apri pagina pubblica", exact: true })
    .click();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/gaia");
  await suppliedCopy(page, "saved public preview");
  await noOverflow(page, "saved public preview");
  await page.screenshot({
    path: `${artifacts}/saved-preview-390.png`,
    fullPage: true,
  });
  passed("public preview displays the explicitly saved presentation");

  expect(unexpected).toEqual([]);
  expect(pageerrors).toEqual([]);
  passed("no JavaScript errors or unexpected external requests");
  await writeFile(
    `${artifacts}/results.json`,
    JSON.stringify(
      {
        passed: checks.length,
        checks,
        unexpected,
        pageerrors,
        externalServices: "intercepted; no live writes or messages",
      },
      null,
      2,
    ) + "\n",
  );
  await rm(`${artifacts}/failure.txt`, { force: true });
  await rm(`${artifacts}/failure.png`, { force: true });
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} catch (error) {
  if (currentPage)
    await currentPage
      .screenshot({ path: `${artifacts}/failure.png`, fullPage: true })
      .catch(() => {});
  await writeFile(`${artifacts}/failure.txt`, String(error?.stack ?? error));
  throw error;
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  await new Promise((done) => server.close(done));
}
