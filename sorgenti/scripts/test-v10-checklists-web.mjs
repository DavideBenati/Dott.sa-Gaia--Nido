// Production-build smoke with an isolated browser and mocked read-only services.
// Anonymous checkbox progress stays in this disposable browser context.
import { createServer } from "node:http";
import { mkdir, readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const root = resolve(process.argv[2] ?? "apps/mobile/dist-web");
const port = Number(process.env.MAIA_V10_CHECKLIST_PORT ?? 8153);
const origin = `http://127.0.0.1:${port}`;
const artifacts = resolve(
  process.env.MAIA_V10_CHECKLIST_ARTIFACTS ??
    "/workspace/shared/downloads/metimaia-v10/checklist-browser",
);
await mkdir(artifacts, { recursive: true });
const migration = await readFile(
  new URL(
    "../supabase/migrations/202610250014_borsa_parto.sql",
    import.meta.url,
  ),
  "utf8",
);
const checklist = JSON.parse(
  migration.match(/\$document\$([\s\S]*?)\$document\$/)[1],
);
const article = {
  id: "b71c621d-9ce7-4385-a97a-467ef9011071",
  slug: "borsa-parto-verifica",
  title: "Borsa parto: organizzarsi insieme",
  subtitle: "Piccoli gesti per prepararsi alla nascita.",
  categoryId: "birth",
  stage: "pregnancy",
  weekFrom: null,
  weekTo: null,
  imageUrl: "",
  readingMinutes: 3,
  authorName: "Dott.sa Gaia",
  authorRole: "Ostetrica",
  publishedAt: "2026-10-25",
  reviewedAt: null,
  reviewerName: null,
  status: "published",
  approved: true,
  isDemo: false,
  sections: [
    {
      heading: "Prepararsi con calma",
      paragraphs: ["Una lista da adattare alle proprie esigenze."],
    },
  ],
  references: [],
  videoUrl: null,
};
const mime = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};
const server = createServer(async (request, response) => {
  try {
    let file = resolve(
      root,
      "." + decodeURIComponent(new URL(request.url, origin).pathname),
    );
    if (file !== root && !file.startsWith(root + "/"))
      return response.writeHead(403).end();
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
  args: ["--no-sandbox"],
});
const errors = [],
  unexpected = [],
  checks = [];
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  serviceWorkers: "block",
});
await context.addInitScript(() => {
  window.__shareMode = "shared";
  window.__shares = [];
  window.__copies = [];
  Object.defineProperty(window.navigator, "share", {
    configurable: true,
    value: async (content) => {
      if (window.__shareMode === "cancel")
        throw new window.DOMException("Cancelled", "AbortError");
      if (window.__shareMode === "unsupported") throw new Error("Unsupported");
      window.__shares.push(content);
    },
  });
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (value) => {
        if (window.__shareMode === "manual")
          throw new Error("Permission denied");
        window.__copies.push(value);
      },
    },
  });
});
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
    "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  };
  if (request.method() === "OPTIONS")
    return route.fulfill({ status: 204, headers });
  if (!["GET", "HEAD"].includes(request.method())) {
    unexpected.push(`${request.method()} ${url.pathname}`);
    return route.abort("blockedbyclient");
  }
  const json = (value) =>
    route.fulfill({
      headers,
      contentType: "application/json",
      body: JSON.stringify(value),
    });
  if (url.pathname.endsWith("/articles")) return json([{ payload: article }]);
  if (url.pathname.endsWith("/checklists"))
    return json([{ payload: checklist }]);
  if (url.pathname.endsWith("/article_categories"))
    return json([{ id: "birth", name: "Nascita", icon: "baby" }]);
  if (url.pathname.endsWith("/shop_settings"))
    return json({
      id: 1,
      enabled: false,
      recommendations_enabled: true,
      amazon_affiliate: false,
      seller_name: "",
      seller_address: "",
      seller_contact: "",
      tax_details: "",
      shipping_terms: "",
      returns_terms: "",
      terms_url: "",
    });
  if (url.pathname.endsWith("/shop_products")) return json([]);
  if (url.pathname.endsWith("/site_profile"))
    return json({
      id: 1,
      bio: "Come ostetrica desidero accompagnarvi con ascolto, rispetto e competenza. Ogni famiglia ha la propria storia, i propri tempi e il proprio modo di crescere insieme.",
      portrait_url: "",
      qualifications: "",
      service_area:
        "Modalità, luoghi e disponibilità da concordare direttamente.",
      services: [],
      contact_email: "ostetricamaia@gmail.com",
      privacy_providers: "Fornitori",
      privacy_retention: "",
      privacy_transfers: "",
      privacy_reviewed: true,
    });
  unexpected.push(url.pathname);
  return route.abort("blockedbyclient");
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
page.on("pageerror", (error) => errors.push(error.message));
const passed = (message) => {
  checks.push(message);
  console.log("PASS " + message);
};
async function noOverflow() {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}
try {
  await page.goto(`${origin}/checklist?id=${checklist.id}`);
  await expect(
    page.getByRole("heading", { name: "Borsa parto", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(18);
  await expect(
    page.getByText("Un piccolo traguardo raggiunto", { exact: false }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Condividi lo stato della checklist",
      exact: true,
    })
    .click();
  let payload = await page.evaluate(() => window.__shares.at(-1));
  expect(payload.text).toContain("0 di 18");
  expect(payload.text).toContain("non si aggiorna automaticamente");
  expect(payload.text).toContain(checklist.items[0].label);
  expect(payload.url).toBe(`https://metimaia.com/checklist?id=${checklist.id}`);
  await page.getByRole("checkbox").first().click();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
  for (let index = 1; index < checklist.items.length; index++)
    await page.getByRole("checkbox").nth(index).click();
  await expect(
    page.getByRole("heading", { name: "🌷 Un piccolo traguardo raggiunto" }),
  ).toBeVisible();
  await page
    .getByRole("heading", { name: "🌷 Un piccolo traguardo raggiunto" })
    .scrollIntoViewIfNeeded();
  await page
    .getByRole("button", { name: "Condividi il traguardo", exact: true })
    .click();
  payload = await page.evaluate(() => window.__shares.at(-1));
  expect(payload.text).toContain("Traguardo raggiunto");
  expect(payload.text).not.toContain("Attività ancora da fare");
  await noOverflow();
  await page.screenshot({
    path: resolve(artifacts, "checklist-badge-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("checkbox").last().click();
  await expect(
    page.getByRole("heading", { name: "🌷 Un piccolo traguardo raggiunto" }),
  ).toHaveCount(0);
  passed(
    "Checklist supplied from the document: 18 real checkboxes, earned badge, reversal and text snapshot",
  );

  await page.evaluate(() => {
    window.__shareMode = "cancel";
  });
  await page
    .getByRole("button", {
      name: "Condividi lo stato della checklist",
      exact: true,
    })
    .click();
  expect(await page.evaluate(() => window.__copies.length)).toBe(0);
  await expect(
    page.getByText("Testo e link copiati.", { exact: false }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      value: undefined,
    });
    window.__shareMode = "copied";
  });
  await page
    .getByRole("button", {
      name: "Condividi lo stato della checklist",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Testo e link copiati.", { exact: false }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.__copies.at(-1))).toContain(
    "17 di 18",
  );
  await page.evaluate(() => {
    window.__shareMode = "manual";
  });
  await page
    .getByRole("button", {
      name: "Condividi lo stato della checklist",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Seleziona e copia il testo qui sotto.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Testo e link copiati.", { exact: false }),
  ).toHaveCount(0);
  passed(
    "Web Share cancellation, confirmed clipboard success, and manual fallback produce honest feedback",
  );

  await page.goto(
    `${origin}/discover?category=birth&stage=birth&query=borsa&short=1&sort=title`,
  );
  await expect(
    page.getByRole("textbox", { name: "Cerca un articolo", exact: true }),
  ).toHaveValue("borsa");
  await expect(
    page.getByRole("button", { name: "Categoria: Nascita", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("checkbox", {
      name: "Solo letture entro 5 minuti",
      exact: true,
    }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Condividi questo argomento", exact: true })
    .click();
  payload = await page.evaluate(() => window.__shares.at(-1));
  const sharedTopic = new URL(payload.url);
  for (const [key, value] of Object.entries({
    category: "birth",
    stage: "birth",
    query: "borsa",
    short: "1",
    sort: "title",
  }))
    expect(sharedTopic.searchParams.get(key)).toBe(value);
  await noOverflow();
  await page.screenshot({
    path: resolve(artifacts, "argomenti-filters-mobile.png"),
    fullPage: true,
  });
  passed(
    "Argomenti shared category URLs restore every filter on a direct page load",
  );

  await page.goto(`${origin}/article?id=${article.id}`);
  await page
    .getByRole("button", { name: "Condividi questa lettura", exact: true })
    .click();
  payload = await page.evaluate(() => window.__shares.at(-1));
  expect(payload.url).toBe(`https://metimaia.com/article?id=${article.id}`);
  expect(payload.text).toContain(article.title);
  expect(JSON.stringify(payload)).not.toMatch(
    /nickname|email|preferences|progress/,
  );
  passed(
    "Public article sharing includes the reading title and refreshable public URL",
  );

  await page.goto(`${origin}/`);
  await expect(
    page.getByRole("heading", { name: /Da dove iniziamo/i }),
  ).toBeVisible();
  for (const name of [
    "Aspetto un bambino",
    "Sono un familiare o amico",
    "Dopo la nascita",
    "Mi informo",
  ])
    await expect(page.getByRole("radio", { name, exact: true })).toBeVisible();
  await noOverflow();
  await page.screenshot({
    path: resolve(artifacts, "welcome-mobile.png"),
    fullPage: true,
  });
  passed(
    "The first mobile landing invites the visitor to choose where to begin",
  );
  await page
    .getByRole("radio", { name: "Dopo la nascita", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Iscriviti e iniziamo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account\?journey=postpartum/);
  await expect(
    page.getByRole("button", { name: "Crea account", exact: true }),
  ).toBeVisible();
  passed("The selected journey continues into registration");

  await page.goto(`${origin}/gaia`);
  const meaning = page.getByRole("button", {
    name: "Il nome e il fiore di loto",
    exact: true,
  });
  await expect(meaning).toHaveAttribute("aria-expanded", "false");
  await meaning.click();
  await expect(meaning).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("heading", {
      name: "Il significato di MetiMaia",
      exact: true,
    }),
  ).toBeVisible();
  await meaning.click();
  await expect(
    page.getByRole("heading", {
      name: "Il significato di MetiMaia",
      exact: true,
    }),
  ).toHaveCount(0);
  await noOverflow();
  await page.screenshot({
    path: resolve(artifacts, "project-mobile.png"),
    fullPage: true,
  });
  passed(
    "The project introduction preserves the supplied text behind accessible expandable sections",
  );

  await page.goto(`${origin}/shop`);
  const productSearch = page.getByRole("textbox", {
    name: "Cerca nella selezione Amazon",
    exact: true,
  });
  await expect(productSearch).toBeVisible();
  await productSearch.fill("pannolini");
  await expect(
    page.getByText("Nessun prodotto trovato.", { exact: true }),
  ).toBeVisible();
  await noOverflow();
  passed("Amazon search stays available when the product selection is empty");

  const header = page.getByRole("navigation");
  const shopLink = header.getByRole("link", {
    name: "Apri i consigli d’acquisto",
    exact: true,
  });
  const projectLink = header.getByRole("link", {
    name: "Scopri il progetto MetiMaia",
    exact: true,
  });
  expect(
    await shopLink.evaluate(
      (element) => window.getComputedStyle(element).fontFamily,
    ),
  ).toContain("NidoSansBold");
  expect(
    await projectLink.evaluate(
      (element) => window.getComputedStyle(element).fontFamily,
    ),
  ).not.toContain("NidoSansBold");
  await projectLink.click();
  await expect(page).toHaveURL(/\/gaia$/);
  await expect
    .poll(() =>
      projectLink.evaluate(
        (element) => window.getComputedStyle(element).fontFamily,
      ),
    )
    .toContain("NidoSansBold");
  expect(
    await shopLink.evaluate(
      (element) => window.getComputedStyle(element).fontFamily,
    ),
  ).not.toContain("NidoSansBold");
  await page.setViewportSize({ width: 1280, height: 900 });
  await noOverflow();
  await page.screenshot({
    path: resolve(artifacts, "project-desktop.png"),
    fullPage: true,
  });
  passed(
    "Header navigation moves bold emphasis to the selected page and fits desktop width",
  );

  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
  console.log(JSON.stringify({ checks, artifacts }, null, 2));
} finally {
  await context.close();
  await browser.close();
  await new Promise((done) => server.close(done));
}
