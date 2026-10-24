// Regression checks against a static production build. All external services
// are intercepted: no real account, email, patient data or production write.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const root = resolve(process.argv[2] ?? "apps/mobile/dist-web");
const port = Number(process.env.MAIA_STUDIO_SETTINGS_PORT ?? 8099);
const origin = `http://127.0.0.1:${port}`;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
  ".json": "application/json",
};
const server = createServer(async (request, response) => {
  try {
    let path = resolve(
      root,
      "." + decodeURIComponent(new URL(request.url, origin).pathname),
    );
    if (path !== root && !path.startsWith(root + "/")) {
      response.writeHead(403).end();
      return;
    }
    if (path === root) path += "/index.html";
    try {
      if (!(await stat(path)).isFile()) throw new Error("Not a file");
    } catch {
      path += ".html";
    }
    response.setHeader(
      "Content-Type",
      types[extname(path)] ?? "application/octet-stream",
    );
    response.end(await readFile(path));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((ready) => server.listen(port, "127.0.0.1", ready));
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const contexts = [];
const unexpected = [];
const results = [];
const at = new Date().toISOString();
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "manager-beta@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: at,
  created_at: at,
  app_metadata: {},
  user_metadata: {},
  identities: [],
};
const patient = "22222222-2222-4222-8222-222222222222";
const contacts = [
  {
    user_id: patient,
    email: "patient-beta@example.invalid",
    last_message_at: at,
    last_message_preview: "Messaggio fittizio per la prova",
  },
  {
    user_id: "33333333-3333-4333-8333-333333333333",
    email: "",
    last_message_at: null,
    last_message_preview: "",
  },
];
const initialProfile = {
  id: 1,
  bio: "Presentazione già salvata da conservare",
  portrait_url: "",
  qualifications: "",
  service_area: "Modalità di prova",
  services: [
    {
      title: "Servizio fittizio",
      description: "Descrizione salvata",
      details: "Dettagli salvati",
    },
  ],
  contact_email: "professional-beta@example.invalid",
  privacy_providers: "Fornitori di prova",
  privacy_retention: "",
  privacy_transfers: "",
  privacy_reviewed: false,
};
const copy = (value) => JSON.parse(JSON.stringify(value));
const now = Math.floor(Date.now() / 1000);
const tokenFor = (level) =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        role: "authenticated",
        aud: "authenticated",
        aal: level,
        iat: now,
        exp: now + 3600,
      }),
    ).toString("base64url"),
    "test-only-not-a-valid-signature",
  ].join(".");

async function fixture({
  width = 390,
  chat = true,
  contactsError = null,
  legacy = false,
  aal = "aal2",
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    serviceWorkers: "block",
  });
  contexts.push(context);
  const state = {
    calls: [],
    failProfile: false,
    holdSave: false,
    releaseSave: null,
    profile: copy(initialProfile),
  };
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) {
      await route.continue();
      return;
    }
    if (!url.hostname.endsWith(".supabase.co")) {
      unexpected.push({
        method: request.method(),
        path: url.origin + url.pathname,
      });
      await route.abort("blockedbyclient");
      return;
    }
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
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
    if (
      url.pathname.endsWith("/auth/v1/factors") &&
      request.method() === "POST"
    )
      return json({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        type: "totp",
        totp: {
          secret: "JBSWY3DPEHPK3PXP",
          uri: "otpauth://totp/metimaia?secret=JBSWY3DPEHPK3PXP",
          qr_code:
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="white"/><rect width="32" height="32" fill="black"/></svg>',
        },
      });
    if (url.pathname.endsWith("/rpc/is_editor")) return json(true);
    if (url.pathname.endsWith("/rpc/is_chat_staff")) return json(chat);
    if (url.pathname.endsWith("/rpc/professional_access_status"))
      return json({
        editor: true,
        chat,
        mfa_required: false,
        mfa_satisfied: true,
      });
    if (url.pathname.endsWith("/rpc/care_chat_available")) return json(false);
    if (url.pathname.endsWith("/rpc/document_access_status"))
      return json({
        membership: false,
        documents_mfa_required: false,
        can_manage: false,
        mfa_satisfied: true,
      });
    if (url.pathname.endsWith("/rpc/professional_conversation_contacts")) {
      if (legacy)
        return json(
          { code: "PGRST202", message: "Function absent in legacy fixture" },
          404,
        );
      if (contactsError)
        return json(
          { code: contactsError.code, message: "Simulated contacts failure" },
          contactsError.status,
        );
      const query = String(body?.search_term ?? "").toLowerCase();
      return json(
        contacts.filter((item) => item.email.toLowerCase().includes(query)),
      );
    }
    if (url.pathname.endsWith("/care_conversations"))
      return json([{ user_id: patient, created_at: at }]);
    if (url.pathname.endsWith("/care_messages") && request.method() === "GET")
      return json([
        {
          id: "44444444-4444-4444-8444-444444444444",
          conversation_id: patient,
          sender_id: patient,
          body: "Messaggio fittizio per la prova",
          created_at: at,
        },
      ]);
    if (url.pathname.endsWith("/site_profile")) {
      if (request.method() === "GET")
        return state.failProfile
          ? json(
              { code: "XX000", message: "Simulated profile read error" },
              500,
            )
          : json(state.profile);
      if (request.method() === "POST") {
        const submitted = copy(body);
        if (state.holdSave)
          await new Promise((release) => {
            state.releaseSave = release;
          });
        state.profile = submitted;
        return json(submitted);
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
    unexpected.push({ method: request.method(), path: url.pathname });
    await route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(
    `${origin}/account#access_token=${tokenFor(aal)}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`,
  );
  await expect(page.getByText(user.email, { exact: true })).toBeVisible();
  return { page, state };
}
function passed(name) {
  results.push(name);
  console.log(`PASS ${name}`);
}
try {
  const { page, state } = await fixture();
  state.failProfile = true;
  await page.goto(`${origin}/impostazioni`);
  await expect(
    page.getByRole("button", {
      name: "Riprova caricamento informazioni",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Presentazione", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Salva modifiche", exact: true }),
  ).toHaveCount(0);
  expect(
    state.calls.filter(
      (call) => call.path.endsWith("/site_profile") && call.method === "POST",
    ),
  ).toHaveLength(0);
  passed("profile read failure blocks editor and writes");

  state.failProfile = false;
  await page
    .getByRole("button", {
      name: "Riprova caricamento informazioni",
      exact: true,
    })
    .click();
  await expect(page.getByLabel("Presentazione", { exact: true })).toHaveValue(
    initialProfile.bio,
  );
  await expect(
    page.getByLabel("Titolo servizio 1", { exact: true }),
  ).toHaveValue("Servizio fittizio");
  await expect(
    page.getByLabel("Email pubblica di contatto", { exact: true }),
  ).toHaveValue(initialProfile.contact_email);
  passed("profile retry restores existing fields and services");

  await page
    .getByLabel("Presentazione", { exact: true })
    .fill("Versione da salvare");
  state.holdSave = true;
  await page
    .getByRole("button", { name: "Salva modifiche", exact: true })
    .click();
  await expect.poll(() => typeof state.releaseSave).toBe("function");
  await expect(
    page.getByLabel("Presentazione", { exact: true }),
  ).not.toBeEditable();
  await expect(
    page.getByLabel("Titolo servizio 1", { exact: true }),
  ).not.toBeEditable();
  await expect(
    page.getByRole("button", { name: "Aggiungi servizio", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Apri pagina pubblica", exact: true }),
  ).toBeDisabled();
  state.releaseSave();
  await expect(
    page.getByText(
      "Modifiche salvate. La pagina Gaia e servizi è aggiornata.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(state.profile.bio).toBe("Versione da salvare");
  expect(state.profile.services).toEqual(initialProfile.services);
  passed(
    "in-flight save locks all editor controls and preserves saved snapshot",
  );

  await page.goto(`${origin}/messaggi`);
  await expect(
    page.getByRole("button", {
      name: "Apri conversazione: patient-beta@example.invalid",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Nessun messaggio", { exact: true }),
  ).toBeAttached();
  await page
    .getByLabel("Cerca conversazioni per email", { exact: true })
    .fill("patient-beta");
  await expect
    .poll(
      () =>
        state.calls
          .filter((call) =>
            call.path.endsWith("/professional_conversation_contacts"),
          )
          .at(-1)?.body.search_term,
    )
    .toBe("patient-beta");
  await expect(page.getByText("Nessun messaggio", { exact: true })).toHaveCount(
    0,
  );
  passed("RPC contacts show email, search and empty conversation safely");

  await page
    .getByRole("button", {
      name: "Apri conversazione: patient-beta@example.invalid",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Vai alla risposta", exact: true })
    .click();
  await page
    .getByLabel("Risposta di Gaia", { exact: true })
    .fill("Risposta non inviata da conservare");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Torna alle conversazioni", exact: true })
    .click();
  await expect(
    page.getByLabel("Risposta di Gaia", { exact: true }),
  ).toHaveValue("Risposta non inviata da conservare");
  passed("cancel discard keeps chat draft and selected recipient");

  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Torna alle conversazioni", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Apri conversazione: patient-beta@example.invalid",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Apri conversazione: patient-beta@example.invalid",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Risposta di Gaia", { exact: true }),
  ).toHaveValue("");
  expect(
    state.calls.filter(
      (call) => call.path.endsWith("/care_messages") && call.method === "POST",
    ),
  ).toHaveLength(0);
  passed("explicit discard clears chat draft without sending it");

  for (const contactsError of [
    { code: "XX000", status: 500 },
    { code: "42501", status: 403 },
  ]) {
    const denied = await fixture({ contactsError });
    await denied.page.goto(`${origin}/messaggi`);
    await expect(
      denied.page.getByRole("button", {
        name: "Riprova caricamento casella",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      denied.state.calls.filter((call) =>
        call.path.endsWith("/care_conversations"),
      ),
    ).toHaveLength(0);
    await expect(
      denied.page.getByText("patient-beta@example.invalid", { exact: true }),
    ).toHaveCount(0);
    passed(
      `contacts ${contactsError.status} does not fall back to another lookup`,
    );
  }
  const editorOnly = await fixture({ chat: false });
  await editorOnly.page.goto(`${origin}/messaggi`);
  await expect(
    editorOnly.page.getByText(/Accesso chat non autorizzato/),
  ).toBeVisible();
  expect(
    editorOnly.state.calls.filter(
      (call) =>
        call.path.endsWith("/professional_conversation_contacts") ||
        call.path.endsWith("/care_conversations"),
    ),
  ).toHaveLength(0);
  passed("editor-only account never requests chat contacts");

  const oldProject = await fixture({ legacy: true });
  await oldProject.page.goto(`${origin}/messaggi`);
  await expect(
    oldProject.page.getByRole("button", { name: /Conversazione 22222222/ }),
  ).toBeVisible();
  await expect(oldProject.page.getByText(/Supabase 008/)).toBeAttached();
  expect(
    oldProject.state.calls.filter((call) =>
      call.path.endsWith("/care_conversations"),
    ),
  ).toHaveLength(1);
  passed(
    "missing optional RPC retains authorized ID inbox with upgrade notice",
  );

  const security = await fixture();
  await security.page.goto(`${origin}/sicurezza?returnTo=/documenti-studio`);
  await expect(
    security.page.getByText(
      "Secondo fattore già verificato per questa sessione.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    security.page.getByRole("button", {
      name: "Torna ai documenti riservati",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    security.page.getByLabel("Codice di autenticazione"),
  ).toHaveCount(0);
  passed("MFA reads verified AAL2 session and preserves a safe return area");
  const enrolling = await fixture({ aal: "aal1" });
  await enrolling.page.goto(`${origin}/sicurezza?returnTo=/documenti-studio`);
  await enrolling.page
    .getByRole("button", {
      name: "Configura autenticazione a due fattori",
      exact: true,
    })
    .click();
  const qr = enrolling.page.locator('img[src^="data:image/svg+xml"]');
  await expect(qr).toHaveCount(1);
  await expect
    .poll(() => qr.evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);
  await enrolling.page
    .getByRole("button", {
      name: "Mostra chiave per inserimento manuale",
      exact: true,
    })
    .click();
  await expect(
    enrolling.page.getByText("JBSWY3DPEHPK3PXP", { exact: true }),
  ).toBeVisible();
  await expect(
    enrolling.page.getByRole("button", {
      name: "Verifica codice",
      exact: true,
    }),
  ).toBeDisabled();
  await enrolling.page.getByLabel("Codice di autenticazione").fill("123456");
  await expect(
    enrolling.page.getByRole("button", {
      name: "Verifica codice",
      exact: true,
    }),
  ).toBeEnabled();
  passed(
    "MFA setup displays a local QR and manual alternative without external QR services",
  );
  await security.page.goto(
    `${origin}/sicurezza?returnTo=https://example.invalid`,
  );
  await expect(
    security.page.getByRole("button", { name: "Torna a Studio", exact: true }),
  ).toBeVisible();
  await security.page
    .getByRole("button", { name: "Torna a Studio", exact: true })
    .click();
  await expect
    .poll(() => new URL(security.page.url()).pathname)
    .toBe("/studio");
  passed("MFA return target rejects arbitrary external destinations");
  expect(unexpected).toEqual([]);
  console.log(
    JSON.stringify({
      checks: results.length,
      results,
      externalRequests: "all intercepted; no live writes",
    }),
  );
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  await new Promise((done) => server.close(done));
}
