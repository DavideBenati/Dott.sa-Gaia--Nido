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
async function context() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
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
try {
  const ctx = await context();
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:8095/account");
  await expect(page.getByLabel("Email account")).toBeEditable();
  await page.getByLabel("Email account").fill(user.email);
  await page.getByLabel("Password account").fill("Test-only-password-123!");
  await page.getByRole("button", { name: "Crea account", exact: true }).click();
  await expect(
    page.getByText(
      "Controlla la tua email per confermare la registrazione, poi accedi.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(calls.find((c) => c.path.endsWith("/signup"))?.redirect).toBe(
    "https://metimaia.com/account",
  );
  await page
    .getByRole("button", { name: "Password dimenticata?", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Invia link di recupero", exact: true })
    .click();
  await expect(page.getByText(/Se esiste un account associato/)).toBeVisible();
  expect(calls.find((c) => c.path.endsWith("/recover"))?.redirect).toBe(
    "https://metimaia.com/account",
  );
  await page.reload();
  await expect(page.getByLabel("Email account")).toBeEditable();
  await ctx.close();
  const recovery = await context();
  const resetPage = await recovery.newPage();
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
    ".test-only-no-valid-signature";
  await resetPage.goto(
    `http://127.0.0.1:8095/account#access_token=${token}&refresh_token=test-only-refresh&expires_in=3600&token_type=bearer&type=recovery`,
  );
  await expect(
    resetPage.getByLabel("Nuova password", { exact: true }),
  ).toBeVisible();
  await resetPage
    .getByLabel("Nuova password", { exact: true })
    .fill("New-test-password-456!");
  await resetPage
    .getByRole("button", { name: "Salva nuova password", exact: true })
    .click();
  await expect(
    resetPage.getByText(
      "Password aggiornata. Usa la nuova password anche nell’app.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    calls.some(
      (c) =>
        c.method === "PUT" &&
        c.path.endsWith("/user") &&
        c.body?.password === "New-test-password-456!",
    ),
  ).toBe(true);
  await expect.poll(() => new URL(resetPage.url()).hash).toBe("");
  await recovery.close();
  console.log(
    "PASS: static account URL/reload, signup redirect, recovery email request, verified recovery session, password update and URL-token cleanup. Supabase entirely mocked; no real emails or accounts.",
  );
} finally {
  await browser.close();
  server.close();
}
