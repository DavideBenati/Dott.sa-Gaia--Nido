// Visual spacing regression for the packaged web release. All external
// requests are intercepted; no real account, consent or content writes occur.
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const roots = {
  before: resolve(
    process.argv[2] ?? "/workspace/shared/downloads/maia-v11-final",
  ),
  after: resolve(
    process.argv[3] ?? "/workspace/shared/downloads/maia-v11-1-final",
  ),
};
const artifacts = resolve(
  process.env.MAIA_SPACING_ARTIFACTS ??
    "/workspace/shared/downloads/maia-v11-1-spacing-checks",
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
const servers = [];
const origins = {};
for (const [version, root] of Object.entries(roots)) {
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
      response.setHeader(
        "Content-Type",
        mime[extname(file)] ?? "application/octet-stream",
      );
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  servers.push(server);
  origins[version] = `http://127.0.0.1:${server.address().port}`;
}
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-external-intent-requests"],
});
const contexts = [];
const errors = [];
const unexpected = [];
const metrics = {};
const checks = [];
function passed(label) {
  checks.push(label);
  console.log("PASS " + label);
}
const heading = (page, name) =>
  page.getByRole("heading", { name, exact: true });
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}
async function fixture(version, width) {
  const origin = origins[version];
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    serviceWorkers: "block",
  });
  contexts.push(context);
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!url.hostname.endsWith(".supabase.co")) {
      unexpected.push(request.method() + " " + url.origin + url.pathname);
      return route.abort("blockedbyclient");
    }
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
    };
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    const json = (body) =>
      route.fulfill({
        contentType: "application/json",
        headers,
        body: JSON.stringify(body),
      });
    const rpc = url.pathname.split("/rpc/")[1];
    if (["is_editor", "is_chat_staff", "care_chat_available"].includes(rpc))
      return json(false);
    if (rpc === "professional_access_status")
      return json({
        editor: false,
        chat: false,
        mfa_required: false,
        mfa_satisfied: false,
      });
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
    if (
      ["articles", "checklists", "article_categories", "shop_products"].some(
        (table) => url.pathname.endsWith("/" + table),
      )
    )
      return json([]);
    unexpected.push(request.method() + " " + url.pathname);
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.dismiss());
  return { page, context, origin };
}

try {
  for (const width of [320, 390, 1280, 1577]) {
    metrics[width] = {};
    for (const version of ["before", "after"]) {
      const { page, context, origin } = await fixture(version, width);
      await page.goto(origin + "/gaia");
      const title = heading(page, "Crescere insieme.");
      const intro = heading(page, "Benvenuti in MetiMaia");
      await expect(title).toBeVisible();
      await expect(intro).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const cardBounds = await intro.evaluate((node) => {
        let card = node.parentElement;
        while (card && window.getComputedStyle(card).borderTopWidth !== "1px")
          card = card.parentElement;
        if (!card) throw new Error("Introduction card not found");
        const bounds = card.getBoundingClientRect();
        return {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        };
      });
      const back = page.getByRole("button", { name: "Indietro", exact: true });
      const nav = page.getByRole("navigation");
      const bounds = {
        title: await title.boundingBox(),
        card: cardBounds,
        firstParagraph: await page
          .getByText(
            "Ogni nascita dà inizio a un nuovo viaggio. Insieme, è più bello.",
            { exact: true },
          )
          .boundingBox(),
        back: await back.boundingBox(),
        navigation: await nav.boundingBox(),
      };
      metrics[width][version] = bounds;
      await noOverflow(page);
      if (version === "after") {
        expect(bounds.back.height).toBeGreaterThanOrEqual(44);
        expect(Math.abs(bounds.title.x - bounds.card.x)).toBeLessThanOrEqual(1);
        const projectLink = nav.getByRole("link", {
          name: "Scopri il progetto MetiMaia",
          exact: true,
        });
        expect(
          await projectLink.evaluate(
            (node) => window.getComputedStyle(node).fontFamily,
          ),
        ).toContain("NidoSansBold");
        const readMore = page.getByRole("button", {
          name: "La nostra filosofia",
          exact: true,
        });
        await readMore.scrollIntoViewIfNeeded();
        await expect(readMore).toHaveAttribute("aria-expanded", "false");
        await readMore.click();
        await expect(readMore).toHaveAttribute("aria-expanded", "true");
        await expect(
          page.getByText(
            "MetiMaia — La conoscenza che accompagna, la cura che unisce",
            {
              exact: true,
            },
          ),
        ).toBeVisible();
        await readMore.click();
        await expect(readMore).toHaveAttribute("aria-expanded", "false");
        await expect(
          page.getByRole("button", {
            name: "Scrivi a Gaia via email",
            exact: true,
          }),
        ).toHaveCount(1);
        await page.reload();
        await expect(title).toBeVisible();
        await expect(
          page.getByRole("button", {
            name: "Crea il tuo account",
            exact: true,
          }),
        ).toHaveCount(1);
        await page
          .getByRole("button", { name: "Crea il tuo account", exact: true })
          .click();
        await expect(heading(page, "Il tuo spazio MAIA")).toBeVisible();
        await expect(
          page.getByRole("textbox", { name: "Nickname", exact: true }),
        ).toBeVisible();
        await noOverflow(page);
        await page.goto(origin + "/gaia");
        await expect(title).toBeVisible();
      }
      if ([320, 390, 1577].includes(width))
        await page.screenshot({
          path: resolve(artifacts, `${version}-gaia-${width}.png`),
        });
      await context.close();
    }
    const before = metrics[width].before;
    const after = metrics[width].after;
    expect(after.card.y).toBeLessThan(before.card.y);
    metrics[width].firstCardRaisedBy = before.card.y - after.card.y;
    passed(
      `${width}px: first project card moved up, heading aligned, navigation bold, 44px back control, accordion and signup available`,
    );
  }

  for (const width of [390, 1280]) {
    const { page, context, origin } = await fixture("after", width);
    for (const [route, title] of [
      ["/welcome", "Da dove iniziamo?"],
      ["/account", "Il tuo spazio MAIA"],
      ["/shop", "Consigli d’acquisto"],
      ["/help", "Quando chiedere aiuto"],
      ["/contatti", "Come contattare Gaia"],
    ]) {
      await page.goto(origin + route);
      await expect(heading(page, title)).toBeVisible();
      await noOverflow(page);
    }
    await page.goto(origin + "/studio");
    await expect(
      page.getByText("Accedi", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Nuovo articolo", exact: true }),
    ).toHaveCount(0);
    await noOverflow(page);
    passed(
      `${width}px: welcome, account, recommendations, help and contacts fit; Studio remains gated for guests`,
    );
    await context.close();
  }
  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
  await writeFile(
    resolve(artifacts, "results.json"),
    JSON.stringify({ roots, checks, metrics, errors, unexpected }, null, 2),
  );
  console.log(
    JSON.stringify({ checks: checks.length, errors, unexpected, artifacts }),
  );
} finally {
  await Promise.allSettled(contexts.map((context) => context.close()));
  await browser.close();
  await Promise.all(
    servers.map((server) => new Promise((done) => server.close(done))),
  );
}
