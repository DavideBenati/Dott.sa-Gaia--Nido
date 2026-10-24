// UI regression against the packaged static website. Every external request is
// intercepted or rejected; no real account, document, email or service is used.
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const root = resolve(process.argv[2] ?? "apps/mobile/dist-web");
const port = Number(process.env.MAIA_STUDIO_V8_PORT ?? 8110);
const origin = `http://127.0.0.1:${port}`;
const artifacts = resolve(
  process.env.MAIA_STUDIO_V8_ARTIFACTS ??
    "/workspace/shared/downloads/studio-v8-tests",
);
await mkdir(artifacts, { recursive: true });
const mime = {
  ".html": "text/html",
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
  args: ["--no-sandbox"],
});
const now = Math.floor(Date.now() / 1000);
const user = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "studio-beta@example.invalid",
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  app_metadata: {},
  user_metadata: {},
  identities: [],
};
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
const contexts = [];
const results = [];
const unexpected = [];
let currentPage;
const article = (i) => ({
  id: `${String(i + 1).padStart(8, "0")}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
  slug: `articolo-campione-${i}`,
  title: `Articolo campione ${String(i).padStart(2, "0")}`,
  subtitle: "Sottotitolo fittizio",
  categoryId: "gravidanza",
  stage: "all",
  weekFrom: null,
  weekTo: null,
  imageUrl: "",
  readingMinutes: 3,
  authorName: "Gaia Brunetti",
  authorRole: "Ostetrica",
  publishedAt: "2026-10-24",
  reviewedAt: "2026-10-24",
  reviewerName: "Gaia Brunetti",
  status: i % 2 ? "published" : "draft",
  approved: i % 2 === 1,
  isDemo: false,
  sections: [
    {
      heading: "Titolo sezione fittizio",
      paragraphs: ["Testo fittizio per il test."],
    },
  ],
  references: [],
  videoUrl: null,
});
async function fixture(width = 390) {
  const context = await browser.newContext({
    viewport: { width, height: width >= 900 ? 900 : 844 },
    acceptDownloads: true,
    serviceWorkers: "block",
  });
  contexts.push(context);
  const control = {
    failEditorial: false,
    articles: Array.from({ length: 24 }, (_, i) => article(i)),
    checklists: [],
    calls: [],
  };
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === origin) {
      await route.continue();
      return;
    }
    if (!url.hostname.endsWith(".supabase.co")) {
      unexpected.push(url.origin + url.pathname);
      await route.abort("blockedbyclient");
      return;
    }
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Expose-Headers": "Content-Disposition",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    const body = request.headers()["content-type"]?.includes("application/json")
      ? request.postDataJSON()
      : null;
    control.calls.push({ path: url.pathname, method: request.method(), body });
    const json = (data, status = 200) =>
      route.fulfill({
        status,
        headers,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (url.pathname.endsWith("/auth/v1/user")) {
      await json(user);
      return;
    }
    if (url.pathname.endsWith("/rpc/is_editor")) {
      await json(true);
      return;
    }
    if (url.pathname.endsWith("/rpc/professional_access_status")) {
      await json({
        editor: true,
        chat: true,
        mfa_required: false,
        mfa_satisfied: true,
      });
      return;
    }
    if (url.pathname.endsWith("/rpc/care_chat_available")) {
      await json(false);
      return;
    }
    if (url.pathname.endsWith("/rpc/newsletter_sync_status")) {
      await json({
        pending: 0,
        errors: 0,
        synced: 2,
        confirmed: 2,
        last_update: null,
        last_webhook: null,
      });
      return;
    }
    if (url.pathname.endsWith("/functions/v1/newsletter-sync")) {
      await json({ pending: 0, errors: 0, processed: 2 });
      return;
    }
    if (url.pathname.endsWith("/rpc/newsletter_editor_list")) {
      await json([
        {
          email: "confirmed-one@example.invalid",
          confirmed_at: "2026-10-24T10:00:00Z",
          consent_version: "test-v1",
        },
        {
          email: "confirmed-two@example.invalid",
          confirmed_at: "2026-10-24T11:00:00Z",
          consent_version: "test-v1",
        },
      ]);
      return;
    }
    if (url.pathname.endsWith("/rpc/save_article")) {
      control.articles = [
        body.document,
        ...control.articles.filter((item) => item.id !== body.document.id),
      ];
      await json(body.document);
      return;
    }
    if (url.pathname.endsWith("/rpc/save_checklist")) {
      control.checklists = [
        body.document,
        ...control.checklists.filter((item) => item.id !== body.document.id),
      ];
      await json(body.document);
      return;
    }
    if (url.pathname.endsWith("/articles")) {
      await json(
        control.failEditorial
          ? { message: "Simulated read failure" }
          : control.articles
              .filter(
                (item) =>
                  !url.searchParams.has("status") ||
                  item.status === "published",
              )
              .map((payload) => ({ payload })),
        control.failEditorial ? 500 : 200,
      );
      return;
    }
    if (url.pathname.endsWith("/checklists")) {
      await json(control.checklists.map((payload) => ({ payload })));
      return;
    }
    if (url.pathname.endsWith("/article_categories")) {
      await json([{ id: "gravidanza", name: "Gravidanza", icon: "leaf" }]);
      return;
    }
    if (url.pathname.endsWith("/shop_products")) {
      await json([]);
      return;
    }
    if (url.pathname.endsWith("/shop_settings")) {
      await json({
        id: 1,
        enabled: false,
        recommendations_enabled: false,
        amazon_affiliate: false,
        seller_name: "",
        seller_address: "",
        seller_contact: "",
        tax_details: "",
        shipping_terms: "",
        returns_terms: "",
        terms_url: "",
      });
      return;
    }
    if (url.pathname.endsWith("/site_profile")) {
      await json({
        id: 1,
        bio: "Presentazione fittizia",
        services: [],
        contact_email: "studio@example.invalid",
        portrait_url: "",
        qualifications: "",
        service_area: "",
        privacy_providers: "",
        privacy_retention: "",
        privacy_transfers: "",
        privacy_reviewed: false,
      });
      return;
    }
    if (/\/(user_preferences|notification_preferences)$/.test(url.pathname)) {
      await json(null);
      return;
    }
    if (/\/(user_favorites|checklist_progress|profiles)$/.test(url.pathname)) {
      await json([]);
      return;
    }
    unexpected.push(request.method() + " " + url.pathname);
    await json(
      { message: "Unexpected request blocked by isolated fixture" },
      404,
    );
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  currentPage = page;
  await page.goto(
    `${origin}/account#access_token=${token}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`,
  );
  await expect(page.getByText(user.email, { exact: true })).toBeVisible();
  return { context, page, control };
}
async function check(name, task) {
  const detail = await task();
  results.push({ name, passed: true, detail });
  console.log(JSON.stringify(results.at(-1)));
}
async function visibleInScroll(locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    let top = 0,
      bottom = window.innerHeight;
    for (let p = el.parentElement; p; p = p.parentElement)
      if (/auto|scroll/.test(window.getComputedStyle(p).overflowY)) {
        const pr = p.getBoundingClientRect();
        top = Math.max(top, pr.top);
        bottom = Math.min(bottom, pr.bottom);
      }
    return r.top >= top && r.bottom <= bottom;
  });
}
async function expectInScroll(locator) {
  await expect.poll(() => visibleInScroll(locator)).toBe(true);
}
try {
  for (const width of [320, 390, 1440]) {
    const { page, context, control } = await fixture(width);
    await page.goto(`${origin}/studio`);
    const create = page.getByRole("button", {
      name: "Nuovo articolo",
      exact: true,
    });
    await expect(create).toBeEnabled();
    await check(`dashboard-${width}`, async () => {
      await expectInScroll(create);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({ path: `${artifacts}/studio-home-${width}.png` });
      return { createInFirstScreen: true, horizontalOverflow: false };
    });
    await create.click();
    await expect(page.getByLabel("Titolo", { exact: true })).toBeAttached();
    await check(`editor-separate-${width}`, async () => {
      await expect(
        page.getByRole("button", {
          name: "Documenti e allegati riservati",
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(page.getByText(/Modifiche non salvate/)).toHaveCount(0);
      return { globalQuicklinksAbsent: true, freshDraftClean: true };
    });
    await page
      .getByLabel("Titolo", { exact: true })
      .fill(`Bozza verificata ${width}`);
    let dialogs = 0;
    const dismiss = async (dialog) => {
      dialogs++;
      await dialog.dismiss();
    };
    page.on("dialog", dismiss);
    await page.getByRole("tab", { name: "Shop", exact: true }).click();
    await check(`dirty-cancel-navigation-${width}`, async () => {
      await expect.poll(() => dialogs).toBe(1);
      await expect(page.getByLabel("Titolo", { exact: true })).toHaveValue(
        `Bozza verificata ${width}`,
      );
      expect(new URL(page.url()).pathname).toBe("/studio");
      return { confirmation: true, cancelled: true, draftPreserved: true };
    });
    await page.getByRole("tab", { name: "Studio", exact: true }).click();
    await page
      .getByRole("button", { name: "Torna a Studio", exact: true })
      .click();
    await check(`same-area-no-discard-${width}`, async () => {
      expect(dialogs).toBe(1);
      await expect(page.getByLabel("Titolo", { exact: true })).toHaveValue(
        `Bozza verificata ${width}`,
      );
      return { sameAreaKeptDraft: true, noUnnecessaryPrompt: true };
    });
    page.off("dialog", dismiss);
    let exitConfirmations = 0;
    page.once("dialog", async (dialog) => {
      exitConfirmations++;
      await dialog.accept();
    });
    await page.getByRole("tab", { name: "Shop", exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/shop");
    await page.getByRole("tab", { name: "Studio", exact: true }).click();
    await expect(page.getByLabel("Titolo", { exact: true })).toHaveValue(
      `Bozza verificata ${width}`,
    );
    page.on("dialog", dismiss);
    await page.getByRole("tab", { name: "Shop", exact: true }).click();
    await check(`retained-tab-rearms-guard-${width}`, async () => {
      expect(exitConfirmations).toBe(1);
      await expect.poll(() => dialogs).toBe(2);
      expect(new URL(page.url()).pathname).toBe("/studio");
      return { explicitExitConfirmedOnce: true, guardActiveOnReturn: true };
    });
    // Account for the second deliberately canceled exit in later checks.
    await page.getByLabel("Titolo", { exact: true }).fill("");
    await page
      .getByRole("button", { name: "Salva bozza", exact: true })
      .click();
    await check(`validation-focus-${width}`, async () => {
      const title = page.getByLabel("Titolo", { exact: true });
      await expect(title).toBeFocused();
      await expect(title).toHaveAttribute("aria-invalid", "true");
      await expectInScroll(title);
      await expect(
        page.getByText("Inserisci un titolo di almeno 3 caratteri.", {
          exact: true,
        }),
      ).toBeVisible();
      return { focusOnFirstField: true, ariaInvalid: true };
    });
    await page
      .getByLabel("Titolo", { exact: true })
      .fill(`Bozza verificata ${width}`);
    await page
      .getByRole("button", {
        name: "Salva bozza, comandi iniziali",
        exact: true,
      })
      .click();
    await check(`top-save-feedback-${width}`, async () => {
      const result = page.getByText("Articolo salvato: bozza.", {
        exact: true,
      });
      await expect(result).toBeVisible();
      await expectInScroll(result);
      expect(
        control.calls
          .filter((call) => call.path.endsWith("/rpc/save_article"))
          .at(-1).body.document.title,
      ).toBe(`Bozza verificata ${width}`);
      return { feedbackInViewport: true };
    });
    await page
      .getByLabel("Titolo", { exact: true })
      .fill(`Bozza aggiornata ${width}`);
    await page
      .getByRole("button", { name: "Salva bozza", exact: true })
      .click();
    await check(`bottom-save-feedback-${width}`, async () => {
      const result = page.getByText("Articolo salvato: bozza.", {
        exact: true,
      });
      await expect(result).toBeVisible();
      await expectInScroll(result);
      await page.screenshot({
        path: `${artifacts}/studio-salvataggio-${width}.png`,
      });
      return { feedbackInViewport: true };
    });
    await page
      .getByRole("button", { name: "Torna all’elenco", exact: true })
      .click();
    await check(`saved-return-no-prompt-${width}`, async () => {
      await expect(
        page.getByLabel("Cerca contenuti per titolo"),
      ).toBeAttached();
      expect(dialogs).toBe(2);
      return { unnecessaryConfirmation: false };
    });
    await check(`list-pagination-${width}`, async () => {
      await expect(
        page.getByRole("button", { name: /^Modifica / }),
      ).toHaveCount(10);
      await page
        .getByRole("button", {
          name: "Pagina successiva contenuti",
          exact: true,
        })
        .click();
      await expect(
        page.getByText("25 contenuti · Pagina 2 di 3", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^Modifica / }),
      ).toHaveCount(10);
      return { pageSize: 10, pageTwo: true };
    });
    await check(`list-search-filter-${width}`, async () => {
      await page
        .getByLabel("Cerca contenuti per titolo")
        .fill("Articolo campione 23");
      await expect(
        page.getByRole("button", { name: /^Modifica / }),
      ).toHaveCount(1);
      await expect(page.getByLabel("Cerca contenuti per titolo")).toBeFocused();
      await page.getByLabel("Cerca contenuti per titolo").fill("");
      await expect(page.getByLabel("Cerca contenuti per titolo")).toHaveValue(
        "",
      );
      await expect(
        page.getByText("25 contenuti · Pagina 1 di 3", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Pubblicati", exact: true })
        .click();
      await expect(
        page.getByText("12 contenuti · Pagina 1 di 2", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText("Bozza", { exact: true })).toHaveCount(0);
      return { search: true, statusFilter: true };
    });
    page.off("dialog", dismiss);
    await context.close();
  }
  {
    const { page, control, context } = await fixture();
    control.failEditorial = true;
    await page.goto(`${origin}/studio`);
    await check("editorial-load-retry", async () => {
      const error = page.getByText(
        "Caricamento non riuscito. Controlla la connessione e riprova.",
        { exact: true },
      );
      await expect(error).toBeVisible();
      await expect(
        page.getByText("Caricamento dei contenuti…", { exact: true }),
      ).toHaveCount(0);
      await expectInScroll(error);
      control.failEditorial = false;
      await page
        .getByRole("button", {
          name: "Riprova caricamento contenuti",
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("button", { name: "Nuovo articolo", exact: true }),
      ).toBeEnabled();
      await expect(error).toHaveCount(0);
      return { distinctErrorState: true, recovered: true };
    });
    await page.goto(`${origin}/newsletter-admin`);
    await page
      .getByRole("button", {
        name: "Sincronizza iscritti e revoche",
        exact: true,
      })
      .click();
    await check("newsletter-sync-feedback", async () => {
      const feedback = page.getByText(/Controllo terminato/);
      await expect(feedback).toBeVisible();
      await expectInScroll(feedback);
      await page.screenshot({ path: `${artifacts}/newsletter-esito-390.png` });
      return { feedbackInViewport: true };
    });
    await check("newsletter-csv-same-page", async () => {
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page
          .getByRole("button", {
            name: "Esporta iscritti confermati (CSV)",
            exact: true,
          })
          .click(),
      ]);
      expect(download.suggestedFilename()).toBe(
        "metimaia-newsletter-confermati.csv",
      );
      const csv = await readFile(await download.path(), "utf8");
      expect(csv).toContain("email,confirmed_at,consent_version");
      expect(csv).toContain("confirmed-one@example.invalid");
      expect(csv).toContain("confirmed-two@example.invalid");
      expect(new URL(page.url()).pathname).toBe("/newsletter-admin");
      await expectInScroll(page.getByText(/Esportati 2 indirizzi confermati/));
      return { exportOnNewsletterPage: true, confirmedFixtureRows: 2 };
    });
    await check("newsletter-open-resend-distinct", async () => {
      await page.evaluate(() => {
        window.open = (url) => {
          window.__maiaExternalTestUrl = String(url);
          return null;
        };
      });
      await page
        .getByRole("button", {
          name: "Apri Resend (sito esterno)",
          exact: true,
        })
        .click();
      await expect
        .poll(() => page.evaluate(() => window.__maiaExternalTestUrl))
        .toBe("https://resend.com/emails");
      return { externalActionSeparate: true, realRequestSent: false };
    });
    await context.close();
  }
  expect(unexpected).toEqual([]);
  console.log(
    JSON.stringify({
      completed: true,
      checks: results.length,
      unexpectedRequests: unexpected,
    }),
  );
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage
      .screenshot({ path: `${artifacts}/failure.png`, fullPage: true })
      .catch(() => {});
    await writeFile(
      `${artifacts}/failure.txt`,
      String(error) +
        "\n" +
        (await currentPage
          .locator("body")
          .innerText()
          .catch(() => "")),
    );
  }
  throw error;
} finally {
  await writeFile(
    `${artifacts}/results.json`,
    JSON.stringify(
      {
        scope:
          "Static v8 browser UI with isolated fake services; not a production Supabase test",
        results,
        unexpected,
      },
      null,
      2,
    ),
  );
  for (const context of contexts) await context.close().catch(() => {});
  await browser.close();
  await new Promise((done) => server.close(done));
}
