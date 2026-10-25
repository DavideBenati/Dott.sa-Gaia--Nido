// Bounded browser checks against the packaged web build. All external traffic
// is mocked; these checks never create accounts or write to a real service.
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const root = resolve(
  process.argv[2] ?? "/workspace/shared/downloads/maia-v10-rc1",
);
const artifacts = resolve(
  process.env.MAIA_V10_PRIVATE_ARTIFACTS ??
    "/workspace/shared/downloads/maia-v10-private-checks",
);
const port = Number(process.env.MAIA_V10_PRIVATE_PORT ?? 8147);
const origin = `http://127.0.0.1:${port}`;
const uid = "11111111-1111-4111-8111-111111111111";
const linkId = "22222222-2222-4222-8222-222222222222";
const incomingId = "33333333-3333-4333-8333-333333333333";
const stamp = "2026-10-25T10:00:00.123456+00:00";
const code = "a".repeat(64);
const user = {
  id: uid,
  email: "private-browser@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: stamp,
  created_at: stamp,
  app_metadata: {},
  user_metadata: {},
  identities: [],
  factors: [],
};
const preferences = {
  journey: "pregnancy",
  personalized: false,
  date: null,
  feedingTopics: [],
  sensitiveConsent: false,
  notifications: false,
  marketing: false,
  onboarded: true,
};
const member = {
  nickname: "Beta Gaia",
  journey_shared: false,
  shared_journey: null,
  shared_interests: [],
  journey_consent_at: null,
  journey_consent_version: null,
  sharing_updated_at: null,
};
const snapshot = {
  nickname: "Persona Fiduciosa",
  checklists: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      title: "Checklist condivisa di prova",
      items: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          label: "Preparare una domanda",
          completed: true,
        },
      ],
    },
  ],
  articles: [
    {
      id: "66666666-6666-4666-8666-666666666666",
      title: "Articolo salvato di prova",
    },
  ],
};
const checks = [],
  errors = [],
  unexpected = [],
  contexts = [];
let currentPage;
await mkdir(artifacts, { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};
const server = createServer(async (req, res) => {
  try {
    let file = resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, origin).pathname),
    );
    if (file !== root && !file.startsWith(root + "/"))
      return res.writeHead(403).end();
    if (file === root) file += "/index.html";
    try {
      if (!(await stat(file)).isFile()) throw new Error();
    } catch {
      file += ".html";
    }
    res.setHeader(
      "Content-Type",
      mime[extname(file)] ?? "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(port, "127.0.0.1", done));
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-external-intent-requests"],
});
function token() {
  const now = Math.floor(Date.now() / 1000);
  return [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: uid,
        aud: "authenticated",
        role: "authenticated",
        aal: "aal2",
        exp: now + 3600,
        iat: now,
      }),
    ).toString("base64url"),
    "test-only",
  ].join(".");
}
function passed(label) {
  checks.push(label);
  console.log("PASS " + label);
}
async function fixture() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "block",
  });
  contexts.push(context);
  const state = {
    calls: [],
    pregnancy: null,
    conflict: false,
    incoming: [
      { id: incomingId, nickname: "Richiesta Da Rifiutare", status: "pending" },
    ],
    outgoing: [],
  };
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!url.hostname.endsWith(".supabase.co")) {
      unexpected.push(url.origin + url.pathname);
      return route.abort("blockedbyclient");
    }
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
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
    const rpc = url.pathname.split("/rpc/")[1];
    if (url.pathname.endsWith("/auth/v1/user")) return json(user);
    if (url.pathname.endsWith("/auth/v1/token"))
      return json({
        access_token: token(),
        refresh_token: "test-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user,
      });
    if (
      rpc === "is_editor" ||
      rpc === "is_chat_staff" ||
      rpc === "care_chat_available"
    )
      return json(false);
    if (rpc === "professional_access_status")
      return json({
        editor: false,
        chat: false,
        mfa_required: false,
        mfa_satisfied: true,
      });
    if (rpc === "my_member_profile") return json(member);
    if (rpc === "my_pregnancy_profile") return json(state.pregnancy);
    if (rpc === "save_my_pregnancy_profile") {
      if (body.p_expected_user_id !== uid)
        return json({ code: "42501", message: "Owner mismatch" }, 403);
      if (
        state.conflict ||
        body.p_expected_updated_at !== (state.pregnancy?.updated_at ?? null)
      )
        return json({ code: "40001", message: "Changed profile" }, 409);
      state.pregnancy = {
        ...body.p_profile,
        updated_at: stamp,
        consent_at: stamp,
        consent_version: "2026-10-25-pregnancy-v1",
      };
      return json(state.pregnancy);
    }
    if (rpc === "list_family_sharing")
      return json({ incoming: state.incoming, outgoing: state.outgoing });
    if (rpc === "request_family_share") {
      if (body.p_expected_user_id !== uid || body.p_code !== code)
        return json({ code: "42501", message: "Codice non valido" }, 403);
      state.outgoing = [
        { id: linkId, nickname: "Persona Fiduciosa", status: "pending" },
      ];
      return json(linkId);
    }
    if (rpc === "decide_family_share_request") {
      state.incoming = state.incoming.map((link) =>
        link.id === body.p_grant_id
          ? { ...link, status: body.p_approve ? "approved" : "declined" }
          : link,
      );
      return json(null);
    }
    if (rpc === "family_shared_snapshot") {
      const approved = state.outgoing.some(
        (link) => link.id === body.p_grant_id && link.status === "approved",
      );
      return approved
        ? json(snapshot)
        : json({ code: "42501", message: "Approvazione richiesta" }, 403);
    }
    if (url.pathname.endsWith("/user_preferences"))
      return json({ payload: preferences });
    if (url.pathname.endsWith("/notification_preferences")) return json(null);
    if (url.pathname.endsWith("/site_profile"))
      return json({
        id: 1,
        bio: "Presentazione di prova",
        portrait_url: "",
        qualifications: "",
        service_area: "Roma",
        services: [],
        contact_email: "contact@example.invalid",
        privacy_providers: "Fornitori di prova",
        privacy_retention: "",
        privacy_transfers: "",
        privacy_reviewed: false,
      });
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
    unexpected.push(request.method() + " " + url.pathname);
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  currentPage = page;
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(
    `${origin}/account#access_token=${token()}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`,
  );
  await page.waitForURL(
    (url) => url.origin === origin && url.pathname === "/gaia",
  );
  await expect(
    page.getByRole("heading", { name: "Crescere insieme.", exact: true }),
  ).toBeVisible();
  passed("390: authenticated callback opens the project page after hydration");
  return { page, state };
}
const calls = (state, rpc) =>
  state.calls.filter((call) => call.path.endsWith("/rpc/" + rpc));
try {
  const { page, state } = await fixture();
  await page.goto(origin + "/profile");
  await page
    .getByRole("button", {
      name: "Aggiungi dati gravidanza facoltativi",
      exact: true,
    })
    .click();
  const consents = page.getByRole("checkbox", { name: /^Acconsento/ });
  await expect(consents).toHaveCount(3);
  for (const consent of await consents.all())
    await expect(consent).not.toBeChecked();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type) => parts.find((value) => value.type === type).value;
  const lmp = new Date(
    Date.UTC(
      Number(part("year")),
      Number(part("month")) - 1,
      Number(part("day")),
    ) -
      84 * 86400000,
  )
    .toISOString()
    .slice(0, 10);
  await page
    .getByLabel("Data dell’ultima mestruazione", { exact: true })
    .fill(lmp);
  await expect(
    page.getByText(
      "Calcolo dall’ultima mestruazione: 12 settimane + 0 giorni oggi.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(calls(state, "save_my_pregnancy_profile")).toHaveLength(0);
  passed(
    "390: pregnancy fields are optional, three consents start off and LMP previews age without a save",
  );

  await page
    .getByRole("radio", {
      name: "Il calcolo corrisponde all’ecografia?: No",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Settimane ecografiche oggi", { exact: true })
    .fill("11");
  await page.getByLabel("Giorni ecografici oggi", { exact: true }).fill("3");
  await page
    .getByRole("radio", {
      name: "Hai avuto altre gravidanze?: Sì",
      exact: true,
    })
    .click();
  await page
    .getByRole("checkbox", { name: "Parto spontaneo", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "Taglio cesareo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Salva la scheda gravidanza", exact: true })
    .click();
  await expect(
    page.getByText(
      "Per salvare questi dati serve il consenso alla loro conservazione.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(calls(state, "save_my_pregnancy_profile")).toHaveLength(0);
  passed(
    "390: ultrasound override and previous outcomes work; saving without storage consent is rejected locally",
  );

  for (const consent of await consents.all()) await consent.click();
  await page
    .getByRole("button", { name: "Salva la scheda gravidanza", exact: true })
    .click();
  await expect(
    page.getByText(
      "Scheda gravidanza salvata. Puoi modificare o ritirare ogni consenso qui.",
      { exact: true },
    ),
  ).toBeVisible();
  const save = calls(state, "save_my_pregnancy_profile")[0];
  expect(save.body.p_expected_user_id).toBe(uid);
  expect(save.body.p_expected_updated_at).toBeNull();
  expect(save.body.p_profile).toMatchObject({
    last_menstrual_date: lmp,
    ultrasound_matches: false,
    ultrasound_weeks: 11,
    ultrasound_days: 3,
    previous_pregnancies: true,
    previous_outcomes: ["spontaneous", "cesarean"],
    storage_consent: true,
    gaia_share_consent: true,
    personalization_consent: true,
  });
  expect(save.body.p_profile.ultrasound_reference_date).toMatch(
    /^\d{4}-\d{2}-\d{2}$/,
  );
  const local = await page.evaluate(() =>
    Object.fromEntries(Object.entries(localStorage)),
  );
  expect(JSON.stringify(local)).not.toMatch(
    /last_menstrual_date|ultrasound_reference_date|previous_outcomes/,
  );
  expect(local["nido:user-state:v1"] ?? "").not.toContain(lmp);
  await page.screenshot({
    path: resolve(artifacts, "pregnancy-profile-390.png"),
    fullPage: true,
  });
  passed(
    "390: explicit save carries owner/reference date, while clinical fields stay out of localStorage",
  );

  state.conflict = true;
  await page
    .getByRole("checkbox", { name: "Altro esito", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Salva la scheda gravidanza", exact: true })
    .click();
  await expect(
    page.getByText(
      "La scheda è cambiata. Ricarica i dati prima di salvare nuovamente.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    calls(state, "save_my_pregnancy_profile").at(-1).body.p_expected_updated_at,
  ).toBe(stamp);
  passed(
    "390: clinical conflicts preserve the exact server version and request a reload",
  );

  await page.goto(origin + "/condivisioni");
  await expect(
    page.getByRole("button", { name: "Aggiorna condivisioni", exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Nickname della persona da accompagnare", { exact: true })
    .fill("Persona Fiduciosa");
  await page
    .getByLabel("Codice privato di condivisione", { exact: true })
    .fill("short-code");
  await page
    .getByRole("button", {
      name: "Invia richiesta di collegamento",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      "Incolla il codice privato completo ricevuto dalla persona.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(calls(state, "request_family_share")).toHaveLength(0);
  await page
    .getByLabel("Codice privato di condivisione", { exact: true })
    .fill(code);
  await page
    .getByRole("button", {
      name: "Invia richiesta di collegamento",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("In attesa di approvazione", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Vedi checklist e articoli salvati",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(calls(state, "family_shared_snapshot")).toHaveLength(0);
  passed(
    "390: an invalid family code is rejected and a valid request exposes no snapshot before approval",
  );

  state.outgoing[0].status = "approved"; // Simulate the owner's separate approval.
  await page
    .getByRole("button", { name: "Aggiorna condivisioni", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Vedi checklist e articoli salvati",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Checklist condivisa di prova", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Completato: Preparare una domanda", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Articolo salvato di prova",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(lmp);
  await expect(page.locator("body")).not.toContainText(
    /Settimane ecografiche|Ultima mestruazione|previous_outcomes|private-browser@example\.invalid/,
  );
  expect(Object.keys(snapshot).sort()).toEqual([
    "articles",
    "checklists",
    "nickname",
  ]);
  expect(calls(state, "family_shared_snapshot").at(-1).body).toEqual({
    p_grant_id: linkId,
    p_expected_user_id: uid,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 2,
    ),
  ).toBe(true);
  await page.screenshot({
    path: resolve(artifacts, "family-approved-390.png"),
    fullPage: true,
  });
  passed(
    "390: approved family access renders only checklist progress and saved article titles without clinical data",
  );

  state.outgoing[0].status = "revoked";
  await page
    .getByRole("button", { name: "Aggiorna condivisioni", exact: true })
    .click();
  await expect(
    page.getByText("Condivisione revocata", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Checklist condivisa di prova", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Vedi checklist e articoli salvati",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Rifiuta la richiesta", exact: true })
    .click();
  await expect(
    page.getByText("Richiesta rifiutata.", { exact: true }),
  ).toBeVisible();
  expect(calls(state, "decide_family_share_request").at(-1).body).toMatchObject(
    { p_grant_id: incomingId, p_approve: false, p_expected_user_id: uid },
  );
  passed(
    "390: revocation clears the loaded family snapshot and an incoming request can be declined",
  );
  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
  await writeFile(
    resolve(artifacts, "results.json"),
    JSON.stringify(
      {
        success: true,
        root,
        checks,
        pageErrors: errors,
        unexpectedRequests: unexpected,
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (currentPage)
    await currentPage
      .screenshot({ path: resolve(artifacts, "failure.png"), fullPage: true })
      .catch(() => {});
  await writeFile(
    resolve(artifacts, "results.json"),
    JSON.stringify(
      {
        success: false,
        root,
        checks,
        error: String(error),
        pageErrors: errors,
        unexpectedRequests: unexpected,
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  await new Promise((done) => server.close(done));
}
