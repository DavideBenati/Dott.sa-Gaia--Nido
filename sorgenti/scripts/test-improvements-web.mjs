// Browser verification against a production static build. All Supabase requests
// are intercepted: this does not create real users, send emails or change data.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium, expect } from "@playwright/test";
import {
  articles,
  checklists,
  categories,
} from "../packages/core/src/fixtures.ts";
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
let messages = [];
let failSend = false;
async function context() {
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
    if (url.pathname.endsWith("/signup")) body = { user, session: null };
    else if (url.pathname.endsWith("/resend")) body = {};
    else if (url.pathname.endsWith("/rpc/is_editor")) body = false;
    else if (url.pathname.endsWith("/articles"))
      body = articles.map((a) => ({
        payload: {
          ...a,
          imageUrl: "",
          isDemo: false,
          approved: true,
          status: "published",
          reviewedAt: "2026-10-20",
        },
      }));
    else if (url.pathname.endsWith("/checklists"))
      body = checklists.map((a) => ({
        payload: { ...a, isDemo: false, approved: true, status: "published" },
      }));
    else if (url.pathname.endsWith("/article_categories")) body = categories;
    else if (url.pathname.endsWith("/care_conversations")) body = {};
    else if (url.pathname.endsWith("/care_messages")) {
      if (request.method() === "POST") {
        if (failSend) {
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Temporary failure" }),
          });
          return;
        }
        const value = request.postDataJSON();
        messages.unshift({
          ...value,
          id: "test-message-" + messages.length,
          sender_id: user.id,
          created_at: new Date().toISOString(),
        });
        body = null;
      } else body = messages;
    } else if (url.pathname.endsWith("/recover")) body = {};
    else if (url.pathname.endsWith("/user")) body = user;
    else if (
      url.pathname.includes("user_preferences") ||
      url.pathname.includes("notification_preferences")
    )
      body = null;
    else if (url.pathname.includes("care_chat_available")) body = true;
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
try {
  const ctx = await context();
  const p = await ctx.newPage();
  p.on("pageerror", (error) => console.log("BROWSER ERROR:", error.message));
  await ctx.addInitScript(() => {
    window.__opened = [];
    window.open = (url) => {
      window.__opened.push(String(url));
      return null;
    };
  });
  await p.goto("http://127.0.0.1:8095/prenota");
  await expect(p).toHaveTitle(/Richiedi un incontro/);
  await p.getByLabel("Nome per la richiesta").fill("Persona di prova");
  await p.getByLabel("Email di ricontatto").fill("test@example.invalid");
  await p.getByLabel("Data preferita", { exact: true }).fill("2000-01-01");
  await p
    .getByRole("button", { name: "Rivedi la richiesta", exact: true })
    .click();
  await expect(p.getByText(/Indica una data valida/)).toBeVisible();
  await p.getByLabel("Data preferita", { exact: true }).fill("2099-01-15");
  await p
    .getByRole("button", { name: "Rivedi la richiesta", exact: true })
    .click();
  await expect(
    p.getByText("Controlla la tua richiesta", { exact: true }),
  ).toBeVisible();
  const before = calls.length;
  await p
    .getByRole("button", { name: "Apri l’email per inviare", exact: true })
    .click();
  const opened = await p.evaluate(() => window.__opened);
  expect(
    opened.some(
      (u) =>
        u.startsWith("mailto:ostetricamaia@gmail.com") &&
        decodeURIComponent(u).includes("2099-01-15"),
    ),
  ).toBe(true);
  expect(calls.length).toBe(before);
  await expect(
    p.getByText(/questa pagina non invia email e non conferma appuntamenti/),
  ).toBeVisible();
  await p.goto("http://127.0.0.1:8095/account");
  await p.getByLabel("Email account").fill(user.email);
  await p.getByLabel("Password account").fill("Test-only-123456!");
  await p.getByRole("button", { name: "Crea account", exact: true }).click();
  await expect(
    p.getByRole("heading", { name: "Controlla la tua email", exact: true }),
  ).toBeVisible();
  await p
    .getByRole("button", { name: "Invia nuovamente la conferma", exact: true })
    .click();
  await expect(
    p.getByRole("button", { name: /Nuovo link tra/ }),
  ).toBeDisabled();
  expect(calls.filter((c) => c.path.endsWith("/resend"))).toHaveLength(1);
  await p
    .getByRole("button", { name: "Ho confermato, accedi", exact: true })
    .click();
  await expect(
    p.getByRole("button", { name: "Accedi", exact: true }),
  ).toBeVisible();
  await p.goto("http://127.0.0.1:8095/discover");
  await p.getByRole("button", { name: "Nascita", exact: true }).click();
  await expect(
    p.getByRole("link", {
      name: "Il primo trimestre, un passo alla volta",
      exact: true,
    }),
  ).toHaveCount(0);
  await p
    .getByRole("checkbox", { name: "Solo letture entro 5 minuti", exact: true })
    .click();
  const links = await p
    .getByRole("link")
    .evaluateAll((items) =>
      items
        .filter((a) => a.href.includes("/article?id="))
        .map((a) => a.getAttribute("href")),
    );
  expect(links.length).toBeGreaterThan(0);
  await p.getByRole("button", { name: "Azzera filtri", exact: true }).click();
  await p
    .getByRole("link", {
      name: "Il primo trimestre, un passo alla volta",
      exact: true,
    })
    .click();
  await expect(p).toHaveTitle(/Il primo trimestre, un passo alla volta/);
  await expect(p.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /article\?id=primo-trimestre/,
  );
  await p.goto("http://127.0.0.1:8095/checklists");
  await expect(p.getByLabel("Cerca una checklist")).toBeVisible();
  await p.getByLabel("Cerca una checklist").fill("nessunrisultato");
  await expect(p.getByText(/Nessuna checklist corrisponde/)).toBeVisible();
  await p
    .getByRole("button", { name: "Azzera ricerca checklist", exact: true })
    .click();
  await expect(
    p.getByRole("link", {
      name: "Preparare la borsa per il parto",
      exact: true,
    }),
  ).toBeVisible();
  await ctx.close();
  const expired = await context();
  const ep = await expired.newPage();
  await ep.goto(
    "http://127.0.0.1:8095/account#error=access_denied&error_code=otp_expired",
  );
  await expect(ep.getByText(/Il collegamento email è scaduto/)).toBeVisible();
  await expired.close();
  const signed = await context();
  const cp = await signed.newPage();
  await cp.goto(
    `http://127.0.0.1:8095/account#access_token=${token}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`,
  );
  await expect(cp.getByText(user.email, { exact: true })).toBeVisible();
  await cp.goto("http://127.0.0.1:8095/chat");
  await expect(
    cp.getByText(/questo non indica che la dottoressa sia online/),
  ).toBeVisible();
  await cp
    .getByLabel("Scrivi un messaggio")
    .fill("Vorrei informazioni sugli incontri.");
  await cp
    .getByRole("button", { name: "Invia messaggio", exact: true })
    .click();
  await expect(
    cp.getByText(/Messaggio salvato nella conversazione/),
  ).toBeVisible();
  await expect(cp.getByLabel("Scrivi un messaggio")).toHaveValue("");
  failSend = true;
  await cp
    .getByLabel("Scrivi un messaggio")
    .fill("Un secondo messaggio di prova");
  await cp
    .getByRole("button", { name: "Invia messaggio", exact: true })
    .click();
  await expect(cp.getByText(/Invio non confermato/)).toBeVisible();
  await expect(cp.getByLabel("Scrivi un messaggio")).toHaveValue(
    "Un secondo messaggio di prova",
  );
  const sends = calls.filter(
    (c) => c.path.endsWith("/care_messages") && c.method === "POST",
  ).length;
  await cp
    .getByRole("button", { name: "Ricarica conversazione", exact: true })
    .click();
  await expect(cp.getByText(/Conversazione aggiornata alle/)).toBeVisible();
  expect(
    calls.filter(
      (c) => c.path.endsWith("/care_messages") && c.method === "POST",
    ),
  ).toHaveLength(sends);
  await signed.close();
  console.log(
    "PASS: booking review/mail draft only, confirmation/resend cooldown, expired link, birth/short-content filters, crawlable links and dynamic article metadata, checklist search, chat success/failure/reload without duplicate sending. All backend/email actions mocked.",
  );
} finally {
  await browser.close();
  server.close();
}
