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
let failShopReads = false;
let bookings = Array.from({ length: 31 }, (_, index) => ({
  id: `${String(index + 1).padStart(8, "0")}-bbbb-4bbb-8bbb-bbbbbbbbbbbb`,
  name: index === 30 ? "Beta Fuori Pagina" : `Persona fittizia ${index + 1}`,
  email:
    index === 30
      ? "fuori@example.invalid"
      : `persona-${index + 1}@example.invalid`,
  topic: "Informazioni di prova",
  preferred_date: null,
  preferred_time: "Da concordare",
  preferred_mode: "Da concordare",
  status: "new",
  created_at: new Date(Date.now() - index * 3600000).toISOString(),
  mail_sent: true,
}));
let settings = {
  id: 1,
  enabled: true,
  recommendations_enabled: true,
  amazon_affiliate: true,
  seller_name: "Venditore di prova",
  seller_address: "Indirizzo di prova",
  seller_contact: "support@example.invalid",
  tax_details: "Dati fiscali verificati",
  shipping_terms: "Spedizioni di prova",
  returns_terms: "Resi di prova",
  terms_url: "https://example.invalid/terms",
};
let products = [
  {
    id: "11111111-1111-4111-8111-111111111112",
    kind: "amazon",
    title: "Libro scelto dalla dottoressa",
    description: "Descrizione originale di prova",
    price_cents: 0,
    image_url: "",
    checkout_url: "https://www.amazon.it/dp/TEST?tag=test-21",
    status: "published",
  },
  {
    id: "11111111-1111-4111-8111-111111111113",
    kind: "doctor",
    title: "Prodotto della dottoressa",
    description: "Descrizione reale di prova",
    price_cents: 1990,
    image_url: "https://example.invalid/product.png",
    checkout_url: "https://buy.stripe.com/test_product",
    status: "published",
  },
  {
    id: "11111111-1111-4111-8111-111111111114",
    kind: "doctor",
    title: "Bozza riservata",
    description: "",
    price_cents: 0,
    image_url: "",
    checkout_url: "",
    status: "draft",
  },
];
let savedArticles = [];
let savedChecklists = [];
async function context(editor = false) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === "http://127.0.0.1:8095") await route.continue();
    else await route.abort("blockedbyclient");
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
      query: url.search,
      redirect: url.searchParams.get("redirect_to"),
      body: request.postDataJSON(),
    });
    if (
      failShopReads &&
      request.method() === "GET" &&
      /\/shop_(settings|products)$/.test(url.pathname)
    ) {
      await route.fulfill({
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        contentType: "application/json",
        body: JSON.stringify({ message: "Simulated read failure" }),
      });
      return;
    }
    let contentRange;
    let body = [];
    if (url.pathname.endsWith("/booking_requests")) {
      if (request.method() === "PATCH") {
        const id = url.searchParams.get("id")?.replace(/^eq\./, "");
        const patch = request.postDataJSON();
        const item = bookings.find((entry) => entry.id === id);
        if (item) {
          Object.assign(item, patch);
          body = { id: item.id, status: item.status };
        } else body = null;
      } else {
        let filtered = bookings;
        const state = url.searchParams.get("status")?.replace(/^eq\./, "");
        if (state) filtered = filtered.filter((item) => item.status === state);
        const or = url.searchParams.get("or");
        if (or) {
          const quoted = or.match(/name\.ilike\.("(?:\\.|[^"\\])*")/)?.[1];
          if (!quoted)
            throw new Error("Expected safely quoted PostgREST search");
          const literal = JSON.parse(quoted)
            .slice(1, -1)
            .replace(/\\([\\%_])/g, "$1")
            .toLowerCase();
          filtered = filtered.filter((item) =>
            `${item.name} ${item.email}`.toLowerCase().includes(literal),
          );
        }
        const offset = Number(url.searchParams.get("offset") ?? 0),
          limit = Number(url.searchParams.get("limit") ?? 25);
        body = filtered.slice(offset, offset + limit);
        contentRange = `${offset}-${Math.max(offset, offset + body.length - 1)}/${filtered.length}`;
      }
    } else if (url.pathname.endsWith("/signup")) body = { user, session: null };
    else if (url.pathname.endsWith("/shop_settings")) {
      if (request.method() === "POST")
        settings = { ...settings, ...request.postDataJSON() };
      body = settings;
    } else if (url.pathname.endsWith("/shop_products")) {
      if (request.method() === "POST") {
        const value = request.postDataJSON();
        products = [value, ...products.filter((p) => p.id !== value.id)];
        body = null;
      } else
        body = products.filter(
          (p) =>
            editor ||
            (p.status === "published" &&
              (p.kind === "amazon"
                ? settings.recommendations_enabled
                : settings.enabled)),
        );
    } else if (url.pathname.endsWith("/rpc/is_editor")) body = editor;
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
        "Access-Control-Expose-Headers": "Content-Range",
        ...(contentRange ? { "Content-Range": contentRange } : {}),
      },
      body: JSON.stringify(body),
    });
  });
  await context.route("https://buy.stripe.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<h1>Checkout simulato: nessun pagamento reale</h1>",
    }),
  );
  await context.route("https://www.amazon.it/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<h1>Amazon simulato: nessun acquisto reale</h1>",
    }),
  );
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
  const guest = await context(false);
  const page = await guest.newPage();
  await page.goto("http://127.0.0.1:8095/shop");
  await expect(
    page.getByText("Libro scelto dalla dottoressa", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/In qualità di Affiliato Amazon/)).toBeVisible();
  await expect(page.getByText("Bozza riservata", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", {
      name: "Gestisci prodotti e vendite",
      exact: true,
    }),
  ).toHaveCount(0);
  const amazonPromise = page.waitForEvent("popup");
  await page
    .getByRole("button", {
      name: "Vedi su Amazon: Libro scelto dalla dottoressa",
      exact: true,
    })
    .click();
  const amazon = await amazonPromise;
  await expect(amazon).toHaveURL(/www.amazon.it/);
  await amazon.close();
  await page
    .getByRole("button", { name: "I prodotti della dottoressa", exact: true })
    .click();
  await expect(
    page.getByText("Prodotto della dottoressa", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Acquista Prodotto della dottoressa",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Prosegui al pagamento", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continua su Stripe", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    page.getByRole("button", { name: "Annulla acquisto", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Continua su Stripe", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Conferma apertura pagamento Stripe" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Acquista Prodotto della dottoressa",
      exact: true,
    }),
  ).toBeFocused();
  await page
    .getByRole("button", {
      name: "Acquista Prodotto della dottoressa",
      exact: true,
    })
    .click();
  const stripePromise = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Continua su Stripe", exact: true })
    .click();
  const stripe = await stripePromise;
  await expect(stripe).toHaveURL(/buy.stripe.com/);
  await stripe.close();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Selezionati su Amazon", exact: true }),
  ).toBeVisible();
  await guest.close();
  const editor = await context(true);
  const ep = await editor.newPage();
  await ep.goto(
    `http://127.0.0.1:8095/account#access_token=${token}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`,
  );
  await expect(ep.getByText(user.email, { exact: true })).toBeVisible();
  await ep.goto("http://127.0.0.1:8095/shop?manage=1");
  await expect(
    ep.getByRole("heading", { name: "Catalogo prodotti", exact: true }),
  ).toBeVisible();
  await expect(
    ep.getByRole("button", {
      name: "Gestisci prodotti e vendite",
      exact: true,
    }),
  ).toHaveCount(0);
  for (const width of [320, 390, 1440]) {
    await ep.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        ep.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
  }
  await ep.setViewportSize({ width: 390, height: 844 });
  await ep.getByRole("button", { name: "Nuovo prodotto", exact: true }).click();
  await ep
    .getByLabel("Nome prodotto", { exact: true })
    .fill("Bozza da proteggere");
  ep.once("dialog", (dialog) => dialog.dismiss());
  await ep.getByRole("button", { name: "Vedi lo shop", exact: true }).click();
  await expect(ep.getByLabel("Nome prodotto", { exact: true })).toHaveValue(
    "Bozza da proteggere",
  );
  ep.once("dialog", (dialog) => dialog.accept());
  await ep.getByRole("button", { name: "Vedi lo shop", exact: true }).click();
  await expect(ep.getByLabel("Nome prodotto", { exact: true })).toHaveCount(0);
  await ep
    .getByRole("button", { name: "Gestisci prodotti e vendite", exact: true })
    .click();
  await ep
    .getByRole("button", { name: "Impostazioni vendita", exact: true })
    .click();
  await ep
    .getByRole("checkbox", { name: "Link affiliati Amazon", exact: true })
    .click();
  ep.once("dialog", (dialog) => dialog.dismiss());
  await ep.getByRole("button", { name: "Prodotti", exact: true }).click();
  await expect(
    ep.getByRole("checkbox", { name: "Link affiliati Amazon", exact: true }),
  ).not.toBeChecked();
  await ep
    .getByRole("button", { name: "Salva impostazioni shop", exact: true })
    .click();
  await expect(
    ep.getByText("Modifiche allo Shop non salvate.", { exact: true }),
  ).toHaveCount(0);
  await ep.getByRole("button", { name: "Prodotti", exact: true }).click();
  await expect(ep.getByText("Bozza riservata", { exact: true })).toBeVisible();
  await ep.getByRole("button", { name: "Nuovo prodotto", exact: true }).click();
  await ep
    .getByRole("button", { name: "Selezionato su Amazon", exact: true })
    .click();
  await ep
    .getByLabel("Nome prodotto", { exact: true })
    .fill("Nuovo consiglio Amazon");
  await ep
    .getByLabel("Descrizione prodotto")
    .fill("Un contenuto originale di prova");
  await ep
    .getByLabel("Link Amazon", { exact: true })
    .fill("https://www.amazon.it/dp/NEWTEST");
  await ep
    .getByRole("button", { name: "Pubblica prodotto", exact: true })
    .click();
  await expect(
    ep.getByText("Nuovo consiglio Amazon", { exact: true }),
  ).toBeVisible();
  expect(
    calls.some(
      (c) =>
        c.path.endsWith("/shop_products") &&
        c.method === "POST" &&
        c.body.kind === "amazon" &&
        c.body.price_cents === 0,
    ),
  ).toBe(true);
  await ep
    .getByLabel("Cerca prodotti per nome o descrizione")
    .fill("Nuovo consiglio");
  await expect(
    ep.getByText("Nuovo consiglio Amazon", { exact: true }),
  ).toBeVisible();
  await expect(ep.getByText("Bozza riservata", { exact: true })).toHaveCount(0);
  await ep
    .getByRole("button", { name: "Filtra prodotti: Bozze", exact: true })
    .click();
  await expect(
    ep.getByText(/Nessun prodotto corrisponde ai filtri/),
  ).toBeVisible();
  products.push(
    ...Array.from({ length: 14 }, (_, i) => ({
      ...products[0],
      id: `${String(i + 30).padStart(8, "0")}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
      title: `Bozza per paginazione ${i}`,
      status: "draft",
    })),
  );
  await ep.goto("http://127.0.0.1:8095/shop?manage=1");
  await ep.getByRole("button", { name: "Altri prodotti", exact: true }).click();
  await expect(ep.getByText(/Pagina 2 di 2/)).toBeVisible();
  await ep
    .getByLabel("Cerca prodotti per nome o descrizione")
    .fill("Nuovo consiglio");
  await expect(
    ep.getByText("Nuovo consiglio Amazon", { exact: true }),
  ).toBeVisible();
  await expect(
    ep.getByLabel("Cerca prodotti per nome o descrizione"),
  ).toBeFocused();
  await ep.getByLabel("Cerca prodotti per nome o descrizione").fill("");
  await expect(
    ep.getByLabel("Cerca prodotti per nome o descrizione"),
  ).toHaveValue("");
  await expect(ep.getByText(/Pagina 1 di 2/)).toBeVisible();
  failShopReads = true;
  await ep.goto("http://127.0.0.1:8095/shop?manage=1");
  await expect(
    ep.getByRole("button", { name: "Riprova caricamento shop", exact: true }),
  ).toBeVisible();
  await expect(
    ep.getByRole("button", { name: "Nuovo prodotto", exact: true }),
  ).toHaveCount(0);
  failShopReads = false;
  await ep
    .getByRole("button", { name: "Riprova caricamento shop", exact: true })
    .click();
  await expect(
    ep.getByRole("button", { name: "Nuovo prodotto", exact: true }),
  ).toBeVisible();
  await ep.goto("http://127.0.0.1:8095/richieste");
  await expect(ep.getByText(/31 richieste trovate/)).toBeVisible();
  await expect(ep.getByText("Beta Fuori Pagina", { exact: true })).toHaveCount(
    0,
  );
  await ep.getByLabel("Cerca richieste per nome o email").fill("Fuori Pagina");
  await ep
    .getByRole("button", { name: "Cerca richieste", exact: true })
    .click();
  await expect(
    ep.getByText("Beta Fuori Pagina", { exact: true }),
  ).toBeVisible();
  await expect(ep.getByText(/1 richieste trovate/)).toBeVisible();
  expect(
    calls
      .filter((c) => c.path.endsWith("/booking_requests") && c.method === "GET")
      .at(-1).query,
  ).toContain("or=");
  await ep
    .getByRole("button", { name: "Segna come contattata", exact: true })
    .click();
  await expect(
    ep.getByText("Stato aggiornato: contattata. Nessuna email inviata.", {
      exact: true,
    }),
  ).toBeVisible();
  await ep.getByRole("button", { name: "Nuove", exact: true }).click();
  await expect(ep.getByText(/Nessuna richiesta corrisponde/)).toBeVisible();
  await ep.getByRole("button", { name: "Contattate", exact: true }).click();
  await expect(
    ep.getByText("Beta Fuori Pagina", { exact: true }),
  ).toBeVisible();
  await ep
    .getByRole("button", { name: "Chiudi richiesta", exact: true })
    .click();
  await expect(
    ep.getByText(/Non compare più nel filtro attuale/),
  ).toBeVisible();
  await ep.getByRole("button", { name: "Chiuse", exact: true }).click();
  await expect(
    ep.getByRole("button", { name: "Riapri richiesta", exact: true }),
  ).toBeVisible();
  await ep
    .getByRole("button", { name: "Riapri richiesta", exact: true })
    .click();
  await ep.getByRole("button", { name: "Nuove", exact: true }).click();
  await expect(
    ep.getByText("Beta Fuori Pagina", { exact: true }),
  ).toBeVisible();
  await ep.getByLabel("Cerca richieste per nome o email").fill("Fuori%");
  await ep
    .getByRole("button", { name: "Cerca richieste", exact: true })
    .click();
  await expect(ep.getByText(/Nessuna richiesta corrisponde/)).toBeVisible();
  await editor.close();
  settings = { ...settings, enabled: false, recommendations_enabled: false };
  const closed = await context();
  const cp = await closed.newPage();
  await cp.goto("http://127.0.0.1:8095/shop");
  await expect(cp.getByText("ESEMPIO DI STILE · NON IN VENDITA")).toHaveCount(
    3,
  );
  await expect(cp.getByRole("button", { name: /^Acquista / })).toHaveCount(0);
  await cp.screenshot({
    path: "/workspace/shared/downloads/MAIA-Shop-anteprima.png",
    fullPage: true,
  });
  await closed.close();
  console.log(
    "PASS: Amazon/doctor sections, affiliate disclosure, public drafts hidden, direct authorized management, unsaved product/settings guards, filters, load failure/retry, server-side booking search/status/count and local update feedback, explicit Stripe handoff, direct URL reload and closed-store preview. All external services intercepted; no purchases or real data.",
  );
} finally {
  await browser.close();
  server.close();
}
