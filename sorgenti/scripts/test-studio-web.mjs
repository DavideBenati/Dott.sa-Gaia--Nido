// Browser verification against a production static build. All Supabase requests
// are intercepted: this does not create real users, send emails or change data.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium, expect } from "@playwright/test";
const root = resolve(process.argv[2] ?? "apps/mobile/dist-web");
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};
const server = createServer(async (request, response) => {
  try {
    let file = resolve(
      root,
      "." +
        decodeURIComponent(new URL(request.url, "http://localhost").pathname),
    );
    if (file !== root && !file.startsWith(root + "/")) {
      response.writeHead(403).end();
      return;
    }
    if (file === root) file += "/index.html";
    try {
      if (!(await stat(file)).isFile()) throw new Error("Not a file");
    } catch {
      file += ".html";
    }
    response.setHeader(
      "Content-Type",
      types[extname(file)] ?? "application/octet-stream",
    );
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(8095, "127.0.0.1", r));
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "maia-test@example.invalid",
  email_confirmed_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
  identities: [],
  created_at: new Date().toISOString(),
};
const calls = [];
let savedArticles = [];
let savedChecklists = [];
let profile = {
  id: 1,
  bio: "Presentazione verificata per il test",
  portrait_url: "",
  qualifications: "",
  service_area: "Modalità da concordare",
  services: [],
  contact_email: "contact@example.invalid",
  privacy_providers: "Fornitori di test",
  privacy_retention: "",
  privacy_transfers: "",
  privacy_reviewed: false,
};
const conversation = "22222222-2222-4222-8222-222222222222";
let careMessages = [
  {
    id: "message-1",
    conversation_id: conversation,
    sender_id: conversation,
    body: "Messaggio fittizio di test",
    created_at: new Date().toISOString(),
  },
];
async function context(editor = false, mfaPending = false) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  if (process.env.MAIA_TEST_FONT_FAILURE === "1")
    await context.route("**/*.ttf", (route) => route.abort("failed"));
  await context.route("https://*.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
      });
      return;
    }
    calls.push({
      method: request.method(),
      path: url.pathname,
      redirect: url.searchParams.get("redirect_to"),
      body: request.postDataJSON(),
    });
    let body = [];
    if (url.pathname.endsWith("/site_profile")) {
      if (request.method() === "POST") {
        profile = request.postDataJSON();
        body = profile;
      } else body = profile;
    } else if (url.pathname.endsWith("/rpc/newsletter_sync_status"))
      body = {
        pending: 0,
        errors: 0,
        synced: 2,
        confirmed: 2,
        last_update: new Date().toISOString(),
        last_webhook: null,
      };
    else if (url.pathname.endsWith("/functions/v1/newsletter-sync"))
      body = { pending: 0, errors: 0, processed: 2 };
    else if (url.pathname.endsWith("/rpc/professional_conversation_contacts"))
      body = [
        {
          user_id: conversation,
          email: "utente@example.invalid",
          last_message_at: new Date().toISOString(),
          last_message_preview: "Messaggio fittizio di test",
        },
      ];
    else if (url.pathname.endsWith("/rpc/is_chat_staff")) body = editor;
    else if (url.pathname.endsWith("/care_conversations"))
      body = [{ user_id: conversation, created_at: new Date().toISOString() }];
    else if (url.pathname.endsWith("/care_messages")) {
      if (request.method() === "POST") {
        const incoming = request.postDataJSON();
        careMessages.push({
          ...incoming,
          id: "reply-1",
          created_at: new Date().toISOString(),
        });
        body = careMessages.at(-1);
      } else body = careMessages;
    } else if (url.pathname.endsWith("/booking_requests")) body = [];
    else if (url.pathname.endsWith("/functions/v1/site-actions"))
      body = { message: "Richiesta acquisita. Attendi il ricontatto di Gaia." };
    else if (url.pathname.endsWith("/signup")) body = { user, session: null };
    else if (url.pathname.endsWith("/rpc/professional_access_status"))
      body = {
        editor,
        chat: editor,
        mfa_required: mfaPending,
        mfa_satisfied: !mfaPending,
      };
    else if (url.pathname.endsWith("/rpc/is_editor"))
      body = editor && !mfaPending;
    else if (url.pathname.endsWith("/rpc/save_article")) {
      body = request.postDataJSON().document;
      savedArticles = [body, ...savedArticles.filter((a) => a.id !== body.id)];
    } else if (url.pathname.endsWith("/rpc/save_checklist")) {
      body = request.postDataJSON().document;
      savedChecklists = [
        body,
        ...savedChecklists.filter((a) => a.id !== body.id),
      ];
    } else if (url.pathname.endsWith("/articles"))
      body = savedArticles
        .filter(
          (a) => !url.searchParams.has("status") || a.status === "published",
        )
        .map((payload) => ({ payload }));
    else if (url.pathname.endsWith("/checklists"))
      body = savedChecklists
        .filter(
          (a) => !url.searchParams.has("status") || a.status === "published",
        )
        .map((payload) => ({ payload }));
    else if (url.pathname.endsWith("/functions/v1/newsletter"))
      body = { message: "Iscrizione confermata. Grazie!" };
    else if (url.pathname.includes("article_categories"))
      body = [{ id: "gravidanza", name: "Gravidanza", icon: "leaf" }];
    else if (url.pathname.endsWith("/recover")) body = {};
    else if (url.pathname.endsWith("/user")) body = user;
    else if (
      url.pathname.includes("user_preferences") ||
      url.pathname.includes("notification_preferences")
    )
      body = null;
    else if (url.pathname.includes("care_chat_available")) body = false;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
      body: JSON.stringify(body),
    });
  });
  return context;
}

const now = Math.floor(Date.now() / 1000);
const token =
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  ) +
  "." +
  Buffer.from(
    JSON.stringify({
      sub: user.id,
      aud: "authenticated",
      role: "authenticated",
      exp: now + 3600,
      iat: now,
    }),
  ).toString("base64url") +
  ".test-only";
async function login(page) {
  await page.goto(
    `http://127.0.0.1:8095/account#access_token=${token}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`,
  );
  await expect(page.getByText(user.email, { exact: true })).toBeVisible();
}
try {
  const guest = await context();
  const guestPage = await guest.newPage();
  await guestPage.goto("http://127.0.0.1:8095/studio");
  await expect(
    guestPage.getByText("Accedi con l’account professionale autorizzato."),
  ).toBeVisible();
  await guestPage.goto("http://127.0.0.1:8095/account");
  await expect(guestPage.getByRole("checkbox")).not.toBeChecked();
  await guestPage.getByLabel("Email account").fill(user.email);
  await guestPage
    .getByLabel("Password account")
    .fill("Test-password-only-123!");
  await guestPage.getByRole("checkbox").click();
  await guestPage
    .getByRole("button", { name: "Crea account", exact: true })
    .click();
  await expect(
    guestPage.getByText(/Newsletter: se la richiesta è valida/),
  ).toBeVisible();
  expect(
    calls.some(
      (c) =>
        c.path.endsWith("/functions/v1/newsletter") && c.body.consent === true,
    ),
  ).toBe(true);
  await guest.close();
  const normal = await context(false);
  const normalPage = await normal.newPage();
  await login(normalPage);
  await expect(
    normalPage.getByRole("button", {
      name: "Area professionista",
      exact: true,
    }),
  ).toHaveCount(0);
  await normalPage.goto("http://127.0.0.1:8095/studio");
  await expect(
    normalPage.getByText(/Questo account non ha i permessi editoriali/),
  ).toBeVisible();
  await expect(
    normalPage.getByRole("button", { name: "Nuovo articolo", exact: true }),
  ).toHaveCount(0);
  await expect(
    normalPage.getByRole("tab", { name: "Studio", exact: true }),
  ).toHaveCount(0);
  await expect(
    normalPage.getByRole("tab", { name: "Shop", exact: true }),
  ).toBeVisible();
  await normalPage.getByRole("tab", { name: "Shop", exact: true }).click();
  await expect(
    normalPage.getByText("Lo Shop di metiMaia", { exact: true }),
  ).toBeVisible();
  await expect(
    normalPage.getByRole("tab", { name: "Profilo", exact: true }),
  ).toBeVisible();
  await normal.close();
  const pendingContext = await context(true, true);
  const pendingPage = await pendingContext.newPage();
  await login(pendingPage);
  await pendingPage.goto("http://127.0.0.1:8095/discover");
  await expect(
    pendingPage.getByRole("tab", { name: "Studio", exact: true }),
  ).toBeVisible();
  await pendingPage.getByRole("tab", { name: "Studio", exact: true }).click();
  await expect(
    pendingPage.getByText(/Questo account non ha i permessi editoriali/),
  ).toBeVisible();
  await expect(
    pendingPage.getByRole("button", { name: "Nuovo articolo", exact: true }),
  ).toHaveCount(0);
  await pendingContext.close();
  const editor = await context(true);
  const page = await editor.newPage();
  await login(page);
  await page
    .getByRole("button", { name: "Area professionista", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Studio", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Shop", exact: true }).click();
  await expect(
    page.getByText("Lo Shop di metiMaia", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Studio", exact: true }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect
      .poll(
        async () =>
          (
            await page
              .getByRole("tab", { name: "Studio", exact: true })
              .boundingBox()
          )?.y ?? -1,
      )
      .toBeGreaterThanOrEqual(0);
    if (width === 320) {
      await expect(
        page.getByRole("button", { name: "Torna a Studio", exact: true }),
      ).toBeInViewport();
      await expect(
        page.getByRole("tab", { name: "Studio", exact: true }),
      ).toBeInViewport();
      await page.screenshot({
        path: "/workspace/shared/downloads/MAIA-Studio-v4-320.png",
      });
    }
    for (const name of ["Shop", "Studio", "Profilo"]) {
      const box = await page
        .getByRole("tab", { name, exact: true })
        .boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(901);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Nuovo articolo", exact: true })
    .click();
  await page
    .getByLabel("Titolo", { exact: true })
    .fill("Benvenuti in metiMaia");
  await page
    .getByLabel("Sottotitolo", { exact: true })
    .fill("Il vostro percorso insieme");
  await page
    .getByLabel("Immagine di copertina (HTTPS)")
    .fill("https://example.invalid/cover.png");
  await page.getByLabel("Titolo sezione 1").fill("Un passo alla volta");
  await page
    .getByLabel("Testo sezione 1")
    .fill("Testo professionale di prova.\n\nSecondo paragrafo.");
  await page
    .getByRole("button", { name: "Aggiungi fonte", exact: true })
    .click();
  await page.getByLabel("Nome fonte 1").fill("Fonte verificata di prova");
  await page.getByLabel("Link fonte 1").fill("https://example.invalid/fonte");
  await page.getByRole("button", { name: "Anteprima", exact: true }).click();
  await expect(
    page.getByText("Secondo paragrafo.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salva bozza", exact: true }).click();
  await expect(
    page.getByText("Articolo salvato: bozza.", { exact: true }),
  ).toBeVisible();
  expect(
    calls.find((c) => c.path.endsWith("/rpc/save_article"))?.body.document
      .status,
  ).toBe("draft");
  await page
    .getByRole("button", { name: "Approva e pubblica", exact: true })
    .click();
  await expect(
    page.getByText("Articolo salvato: pubblicato.", { exact: true }),
  ).toBeVisible();
  const saved = calls.filter((c) => c.path.endsWith("/rpc/save_article")).at(-1)
    .body.document;
  expect(saved.approved).toBe(true);
  expect(saved.reviewerName).toBe("Dott.sa Gaia");
  expect(saved.sections[0].paragraphs).toHaveLength(2);
  page.on("dialog", (d) => d.accept());
  // Confirmation dialog is installed before the next navigation attempt.
  await page
    .getByRole("button", { name: "Torna all’elenco", exact: true })
    .click();
  await page.getByRole("button", { name: /^Checklist \(/ }).click();
  await page
    .getByRole("button", { name: "Nuova checklist", exact: true })
    .click();
  await page.getByLabel("Titolo", { exact: true }).fill("Preparare la visita");
  await page
    .getByLabel("Descrizione", { exact: true })
    .fill("Cose da ricordare");
  await page
    .getByLabel("Attività 1", { exact: true })
    .fill("Portare i documenti");
  await page.getByRole("button", { name: "Salva bozza", exact: true }).click();
  await expect(
    page.getByText("Checklist salvata: bozza.", { exact: true }),
  ).toBeVisible();
  expect(
    calls.some(
      (c) =>
        c.path.endsWith("/rpc/save_checklist") &&
        c.body.document.items[0].label === "Portare i documenti",
    ),
  ).toBe(true);
  const reader = await context(false);
  const rp = await reader.newPage();
  await rp.goto("http://127.0.0.1:8095/article?id=" + saved.id);
  await expect(
    rp.getByText("Benvenuti in metiMaia", { exact: true }),
  ).toBeVisible();
  await rp.reload();
  await expect(
    rp.getByText("Secondo paragrafo.", { exact: true }),
  ).toBeVisible();
  await reader.close();
  await page.goto("http://127.0.0.1:8095/impostazioni");
  await page
    .getByLabel("Presentazione", { exact: true })
    .fill("Presentazione aggiornata dal pannello");
  await page
    .getByRole("button", { name: "Salva modifiche", exact: true })
    .click();
  await expect(
    page.getByText(
      "Modifiche salvate. La pagina Gaia e servizi è aggiornata.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto("http://127.0.0.1:8095/gaia");
  await expect(
    page.getByText("Presentazione aggiornata dal pannello", { exact: true }),
  ).toBeVisible();
  await page.goto("http://127.0.0.1:8095/messaggi");
  await page.getByRole("button", { name: /utente@example.invalid/ }).click();
  await expect(
    page.getByText("Messaggio fittizio di test", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Risposta di Gaia")
    .fill("Risposta di test della professionista");
  await page
    .getByRole("button", { name: "Invia risposta", exact: true })
    .click();
  await expect(
    page.getByText("Risposta di test della professionista", { exact: true }),
  ).toBeVisible();
  expect(
    calls.some(
      (c) => c.path.endsWith("/care_conversations") && c.method === "POST",
    ),
  ).toBe(false);
  await page.goto("http://127.0.0.1:8095/verifiche");
  await expect(
    page.getByRole("heading", { name: "Verifiche del sito", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Servizi non definiti: il sito invita a chiedere informazioni/,
    ),
  ).toBeVisible();
  await page.goto("http://127.0.0.1:8095/newsletter-admin");
  await expect(page.getByText("Confermati: 2", { exact: false })).toBeVisible();
  await page
    .getByRole("button", {
      name: "Sincronizza iscritti e revoche",
      exact: true,
    })
    .click();
  await expect(page.getByText(/Controllo terminato/)).toBeVisible();
  await page.goto("http://127.0.0.1:8095/richieste");
  await expect(
    page.getByText("Nessuna richiesta in questa pagina.", { exact: true }),
  ).toBeVisible();
  const deniedContext = await context(false);
  const deniedPage = await deniedContext.newPage();
  await login(deniedPage);
  await deniedPage.goto("http://127.0.0.1:8095/messaggi");
  await expect(
    deniedPage.getByText(/Accesso chat non autorizzato/),
  ).toBeVisible();
  await deniedContext.close();
  await editor.close();
  const nl = await context();
  const np = await nl.newPage();
  const before = calls.filter((c) =>
    c.path.endsWith("/functions/v1/newsletter"),
  ).length;
  await np.goto(
    "http://127.0.0.1:8095/newsletter?action=confirm&token=" + "a".repeat(64),
  );
  await expect(
    np.getByRole("button", { name: "Confermo l’iscrizione", exact: true }),
  ).toBeVisible();
  expect(
    calls.filter((c) => c.path.endsWith("/functions/v1/newsletter")),
  ).toHaveLength(before);
  await np
    .getByRole("button", { name: "Confermo l’iscrizione", exact: true })
    .click();
  await expect(
    np.getByText("Iscrizione confermata. Grazie!", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => new URL(np.url()).search).toBe("");
  await nl.close();
  const bookingContext = await context();
  const bookingPage = await bookingContext.newPage();
  await bookingPage.goto("http://127.0.0.1:8095/contatti");
  await expect(
    bookingPage.getByRole("heading", {
      name: "Come contattare Gaia",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    bookingPage.getByRole("button", {
      name: "Apri email per informazioni",
      exact: true,
    }),
  ).toBeVisible();
  await bookingPage
    .getByRole("button", {
      name: "Richiedi disponibilità per un incontro",
      exact: true,
    })
    .click();
  await bookingPage
    .getByLabel("Nome per la richiesta")
    .fill("Persona di prova");
  await bookingPage
    .getByLabel("Email di ricontatto")
    .fill("booking@example.invalid");
  await bookingPage
    .getByRole("button", { name: "Rivedi la richiesta", exact: true })
    .click();
  await bookingPage
    .getByRole("button", { name: "Invia richiesta a Gaia", exact: true })
    .click();
  await expect(
    bookingPage.getByText(
      "Richiesta acquisita. Attendi il ricontatto di Gaia.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    bookingPage.getByRole("button", {
      name: "Richiesta acquisita",
      exact: true,
    }),
  ).toBeDisabled();
  expect(
    calls.filter((c) => c.path.endsWith("/functions/v1/site-actions")),
  ).toHaveLength(1);
  await bookingPage.goto("http://127.0.0.1:8095/welcome");
  await bookingPage
    .getByRole("button", { name: "Esplora come ospite", exact: true })
    .click();
  const personal = await bookingPage
    .getByRole("button", { name: "Personalizza il tuo percorso", exact: true })
    .elementHandle();
  const commerce = await bookingPage
    .getByRole("button", { name: "Esplora lo Shop", exact: true })
    .elementHandle();
  expect(
    await personal.evaluate(
      (el, other) =>
        Boolean(
          el.compareDocumentPosition(other) &
          window.Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      commerce,
    ),
  ).toBe(true);
  await bookingContext.close();
  console.log(
    "PASS: guest/normal-user access denied, editor draft/preview/publication/checklist, optional signup newsletter consent, explicit email confirmation, public profile editing, contact choices, personal journey before shop, editorial checks, newsletter reconciliation, staff-only inbox/reply, requests page, booking submission, responsive Shop tab and membership-controlled Studio tab including MFA enforcement. All backend requests mocked; no real data or email sent.",
  );
} finally {
  await browser.close();
  server.close();
}
