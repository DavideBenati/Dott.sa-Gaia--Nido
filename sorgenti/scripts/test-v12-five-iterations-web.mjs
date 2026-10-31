// Bounded checks for the five UX/content/SEO iterations. Every external request
// is intercepted; no real users, documents, clinical data or emails are used.
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { URLSearchParams } from "node:url";
import { chromium, expect } from "@playwright/test";

const root = resolve(
  process.argv[2] ?? "/workspace/shared/downloads/maia-v12-final",
);
const artifacts = resolve(
  process.env.MAIA_V12_ARTIFACTS ??
    "/workspace/shared/downloads/maia-v12-five-iteration-checks",
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
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-external-intent-requests"],
});
const contexts = [],
  checks = [],
  errors = [],
  unexpected = [];
const stamp = "2026-10-31T10:00:00.000Z";
const manager = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "gaia-browser@example.invalid",
  manager: true,
};
const patient = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "patient-browser@example.invalid",
  manager: false,
};
const outsider = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "other-browser@example.invalid",
  manager: false,
};
const article = {
  id: "44444444-4444-4444-8444-444444444444",
  slug: "lettura-di-prova",
  title: "Una lettura da ritrovare",
  subtitle: "Un piccolo aiuto per organizzarsi.",
  categoryId: "home",
  stage: "all",
  weekFrom: null,
  weekTo: null,
  imageUrl: "storage://editorial-images/copertina-mancante.png",
  readingMinutes: 3,
  authorName: "Dott.sa Gaia",
  authorRole: "Ostetrica",
  publishedAt: "2026-10-31",
  reviewedAt: "2026-10-31",
  reviewerName: "Dott.sa Gaia",
  status: "published",
  approved: true,
  isDemo: false,
  originalContent: true,
  sections: [
    {
      heading: "Un passo concreto",
      paragraphs: ["Un testo di prova per le famiglie."],
    },
  ],
  references: [],
  videoUrl: null,
};
const documents = [
  {
    id: "55555555-5555-4555-8555-555555555555",
    title: "Materiale alfa",
    file_name: "materiale-alfa.pdf",
    mime_type: "application/pdf",
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    title: "Esercizi beta",
    file_name: "esercizi-beta.docx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    id: "77777777-7777-4777-8777-777777777777",
    title: "Presentazione gamma",
    file_name: "presentazione-gamma.pptx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
].map((item) => ({
  ...item,
  owner_id: manager.id,
  description: "Materiale assegnato soltanto alla persona autorizzata.",
  size_bytes: 100,
  storage_path: `${item.id}/88888888-8888-4888-8888-888888888888.${item.file_name.split(".").at(-1)}`,
  state: "ready",
  active: true,
  created_at: stamp,
  updated_at: stamp,
  ready_at: stamp,
}));
const copy = (value) => JSON.parse(JSON.stringify(value));
const button = (page, name) => page.getByRole("button", { name, exact: true });
const heading = (page, name) =>
  page.getByRole("heading", { name, exact: true });
function passed(label) {
  checks.push(label);
  console.log("PASS " + label);
}
function token(viewer) {
  const now = Math.floor(Date.now() / 1000);
  return [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({
        sub: viewer.id,
        aud: "authenticated",
        role: "authenticated",
        aal: viewer.manager ? "aal2" : "aal1",
        exp: now + 3600,
        iat: now,
      }),
    ).toString("base64url"),
    "test-only-not-a-valid-signature",
  ].join(".");
}
function authUser(viewer) {
  return {
    id: viewer.id,
    email: viewer.email,
    aud: "authenticated",
    role: "authenticated",
    email_confirmed_at: stamp,
    created_at: stamp,
    app_metadata: {},
    user_metadata: {},
    identities: [],
    factors: [],
  };
}
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}
async function schema(page) {
  await expect(page.locator("script#metimaia-page-schema")).toHaveCount(1);
  return page
    .locator("script#metimaia-page-schema")
    .evaluate((node) => JSON.parse(node.textContent));
}
async function fixture(width, viewer = null, options = {}) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    serviceWorkers: "block",
  });
  contexts.push(context);
  let releaseArticles;
  const gate = options.gateArticles
    ? new Promise((done) => {
        releaseArticles = done;
      })
    : Promise.resolve();
  const state = {
    articles: options.empty ? [] : [copy(article)],
    failArticles: false,
    calls: [],
    releaseArticles: () => releaseArticles?.(),
  };
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!url.hostname.endsWith(".supabase.co")) {
      unexpected.push(request.method() + " " + url.origin + url.pathname);
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
    state.calls.push({
      method: request.method(),
      path: url.pathname,
      search: url.search,
      body,
    });
    const json = (value, status = 200) =>
      route.fulfill({
        status,
        headers,
        contentType: "application/json",
        body: JSON.stringify(value),
      });
    const rpc = url.pathname.split("/rpc/")[1];
    if (url.pathname.endsWith("/auth/v1/user"))
      return json(
        viewer ? authUser(viewer) : { message: "No session" },
        viewer ? 200 : 401,
      );
    if (["is_editor", "can_manage_documents"].includes(rpc))
      return json(Boolean(viewer?.manager));
    if (["is_chat_staff", "care_chat_available"].includes(rpc))
      return json(false);
    if (rpc === "professional_access_status")
      return json({
        editor: Boolean(viewer?.manager),
        chat: false,
        mfa_required: Boolean(viewer?.manager),
        mfa_satisfied: Boolean(viewer?.manager),
      });
    if (rpc === "document_access_status")
      return json({
        membership: Boolean(viewer?.manager),
        documents_mfa_required: Boolean(viewer?.manager),
        can_manage: Boolean(viewer?.manager),
        mfa_satisfied: Boolean(viewer?.manager),
      });
    if (rpc === "my_member_profile")
      return json({
        nickname: viewer?.manager ? "Gaia" : "Account di prova",
        journey_shared: false,
        shared_journey: null,
        shared_interests: [],
        journey_consent_at: null,
        journey_consent_version: null,
        sharing_updated_at: null,
      });
    if (rpc === "my_member_milestones")
      return json({ first_recommendation_selected: false });
    if (rpc === "my_pregnancy_profile") return json(null);
    if (rpc === "document_notification_status")
      return json({
        pending: 0,
        sending: 0,
        accepted: 0,
        failed: 0,
        cancelled: 0,
        uncertain: 0,
      });
    if (["document_recipients_v2", "document_recipients"].includes(rpc))
      return json([]);
    if (url.pathname.endsWith("/user_preferences"))
      return json({
        payload: {
          profileType: "exploring",
          journey: "pregnancy",
          exploreOnly: true,
          personalized: false,
          date: null,
          feedingTopics: [],
          sensitiveConsent: false,
          notifications: false,
          marketing: false,
          onboarded: true,
        },
      });
    if (url.pathname.endsWith("/notification_preferences"))
      return json({ enabled: false, marketing: false });
    if (url.pathname.endsWith("/articles")) {
      await gate;
      return state.failArticles
        ? json({ message: "Read denied", code: "42501" }, 403)
        : json(state.articles.map((payload) => ({ payload })));
    }
    if (url.pathname.includes("/storage/v1/object/sign/editorial-images/"))
      return json({ message: "Cover unavailable" }, 403);
    if (url.pathname.endsWith("/article_categories"))
      return json([{ id: "home", name: "Primi giorni a casa", icon: "home" }]);
    if (
      [
        "checklists",
        "user_favorites",
        "checklist_progress",
        "shop_products",
      ].some((name) => url.pathname.endsWith("/" + name))
    )
      return json([]);
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
    if (url.pathname.endsWith("/session_documents")) {
      let rows =
        viewer?.manager || viewer?.id === patient.id ? copy(documents) : [];
      if (!viewer?.manager) {
        if (
          url.searchParams.get("session_document_access.user_id") !==
            `eq.${viewer?.id}` ||
          url.searchParams.get("state") !== "eq.ready" ||
          url.searchParams.get("active") !== "eq.true"
        )
          return json({ message: "Missing private-account scope" }, 403);
      }
      const fileType = url.searchParams.get("mime_type");
      if (fileType)
        rows = rows.filter((item) => `eq.${item.mime_type}` === fileType);
      const search = url.searchParams.get("or");
      if (search) {
        const term =
          search.match(/%([^%]*)%/)?.[1]?.toLocaleLowerCase("it") ?? "";
        rows = rows.filter((item) =>
          `${item.title} ${item.file_name}`
            .toLocaleLowerCase("it")
            .includes(term),
        );
      }
      const id = url.searchParams.get("id");
      if (id) return json(rows.find((item) => `eq.${item.id}` === id) ?? null);
      return json(rows);
    }
    unexpected.push(request.method() + " " + url.pathname);
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.dismiss());
  if (viewer) {
    await page.goto(
      `${origin}/profile#access_token=${token(viewer)}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`,
    );
    await expect(button(page, "Gestisci account")).toBeVisible();
  }
  return { page, context, state };
}

try {
  for (const width of [390, 1280]) {
    const home = await fixture(width, patient);
    await button(home.page, "Vai al mio percorso").click();
    const openDocuments = button(home.page, "Apri i miei documenti");
    await expect(openDocuments).toBeVisible();
    const documentsBounds = await openDocuments.boundingBox();
    expect(documentsBounds).not.toBeNull();
    expect(documentsBounds.y).toBeGreaterThanOrEqual(0);
    expect(documentsBounds.y + documentsBounds.height).toBeLessThanOrEqual(
      home.page.viewportSize().height - 84,
    );
    await expect(button(home.page, "Letture salvate")).toBeVisible();
    await expect(button(home.page, "Esplora gli Argomenti")).toBeVisible();
    await noOverflow(home.page);
    await home.page.screenshot({
      path: resolve(artifacts, `home-${width}.png`),
    });
    await button(home.page, "Letture salvate").click();
    await expect(heading(home.page, "Letture salvate")).toBeVisible();
    await expect(
      home.page.getByText("Non hai ancora salvato letture", { exact: true }),
    ).toBeVisible();
    await home.context.close();
    passed(
      `${width}px: personal home puts the documents action above the bottom tabs and labels saved readings distinctly from all topics`,
    );

    const personal = await fixture(width, patient);
    await personal.page.goto(origin + "/miei-documenti");
    await expect(heading(personal.page, documents[0].title)).toBeVisible();
    await expect(heading(personal.page, documents[1].title)).toBeVisible();
    await personal.page
      .getByLabel("Cerca nei miei documenti", { exact: true })
      .fill("beta");
    await button(personal.page, "Cerca documenti").click();
    await expect(heading(personal.page, documents[1].title)).toBeVisible();
    await expect(heading(personal.page, documents[0].title)).toHaveCount(0);
    await button(personal.page, "PDF").click();
    await expect(
      personal.page.getByText(
        "Nessun materiale corrisponde alla ricerca. Prova un’altra parola o mostra tutti i materiali.",
        { exact: true },
      ),
    ).toBeVisible();
    await button(personal.page, "Mostra tutti i materiali").click();
    await expect(heading(personal.page, documents[0].title)).toBeVisible();
    await expect(heading(personal.page, documents[2].title)).toBeVisible();
    await button(personal.page, "Word").click();
    await expect(heading(personal.page, documents[1].title)).toBeVisible();
    await expect(heading(personal.page, documents[0].title)).toHaveCount(0);
    const documentRequests = personal.state.calls.filter((call) =>
      call.path.endsWith("/session_documents"),
    );
    expect(documentRequests.length).toBeGreaterThanOrEqual(4);
    for (const request of documentRequests) {
      const params = new URLSearchParams(request.search);
      expect(params.get("session_document_access.user_id")).toBe(
        `eq.${patient.id}`,
      );
      expect(params.get("state")).toBe("eq.ready");
      expect(params.get("active")).toBe("eq.true");
    }
    const privateGraph = await schema(personal.page);
    expect(JSON.stringify(privateGraph)).not.toContain("miei-documenti");
    expect(
      await personal.page
        .locator('meta[name="robots"]')
        .getAttribute("content"),
    ).toContain("noindex");
    await noOverflow(personal.page);
    await personal.page.screenshot({
      path: resolve(artifacts, `documents-${width}.png`),
    });
    await personal.context.close();
    passed(
      `${width}px: own-document search, format and reset retain recipient scope and private-page noindex`,
    );

    const studio = await fixture(width, manager);
    await studio.page.goto(origin + "/studio");
    for (const label of [
      "Documenti e allegati",
      "Contenuti del sito",
      "Iscritti e percorsi",
      "Altri strumenti",
    ])
      await expect(heading(studio.page, label)).toBeVisible();
    for (const label of [
      "Documenti e allegati riservati",
      "Apri articoli e checklist",
      "Iscritti e percorsi",
      "Gestisci videochiamate",
      "Conversazioni riservate",
    ])
      await expect(button(studio.page, label)).toBeVisible();
    await noOverflow(studio.page);
    await studio.page.screenshot({
      path: resolve(artifacts, `studio-${width}.png`),
    });
    await button(studio.page, "Nuovo articolo").click();
    await expect(
      studio.page.getByLabel("Titolo", { exact: true }),
    ).toBeVisible();
    expect(
      studio.state.calls.some((call) =>
        call.path.endsWith("/rpc/save_article"),
      ),
    ).toBe(false);
    await studio.context.close();
    passed(
      `${width}px: Studio groups three daily tasks and keeps other tools visible without bypassing the editor workflow`,
    );

    const reading = await fixture(width, null, { gateArticles: true });
    await reading.page.goto(`${origin}/article?id=${article.id}`);
    await expect(
      reading.page.getByText("Prepariamo il tuo spazio…", { exact: true }),
    ).toBeVisible();
    await expect(
      reading.page.getByText("Lettura non disponibile", { exact: true }),
    ).toHaveCount(0);
    reading.state.releaseArticles();
    await expect(heading(reading.page, article.title)).toBeVisible();
    expect(
      reading.state.calls.some((call) =>
        call.path.includes("/storage/v1/object/sign/editorial-images/"),
      ),
    ).toBe(true);
    await expect(button(reading.page, "Riprova a caricare")).toHaveCount(0);
    const articleGraph = await schema(reading.page);
    expect(
      articleGraph["@graph"].some(
        (node) =>
          node["@id"] ===
          `https://metimaia.com/article?id=${article.id}#webpage`,
      ),
    ).toBe(true);
    reading.state.failArticles = true;
    await reading.page.reload();
    await expect(button(reading.page, "Riprova a caricare")).toBeVisible();
    await expect(
      reading.page.getByText("Lettura non disponibile", { exact: true }),
    ).toHaveCount(0);
    reading.state.failArticles = false;
    await button(reading.page, "Riprova a caricare").click();
    await expect(heading(reading.page, article.title)).toBeVisible();
    await reading.page.goto(origin + "/article?id=non-pubblicato");
    await expect(
      reading.page.getByText("Lettura non disponibile", { exact: true }),
    ).toBeVisible();
    await button(reading.page, "Vai agli Argomenti").click();
    await expect(
      heading(reading.page, "Le parole giuste, al momento giusto."),
    ).toBeVisible();
    await reading.context.close();
    passed(
      `${width}px: loading/error/cover fallback and missing-reading states are distinct, with accurate runtime page schema`,
    );

    const library = await fixture(width, null, { empty: true });
    await library.page.goto(origin + "/discover");
    await expect(
      library.page.getByText("Nessuna lettura pubblicata", { exact: true }),
    ).toBeVisible();
    await expect(button(library.page, "Contatta Gaia")).toBeVisible();
    await expect(button(library.page, "Mostra tutte le letture")).toHaveCount(
      0,
    );
    library.state.articles = [copy(article)];
    await library.page.reload();
    await expect(
      library.page.getByRole("link", { name: article.title, exact: true }),
    ).toBeVisible();
    await library.page
      .getByLabel("Cerca un articolo", { exact: true })
      .fill("nessuna-corrispondenza");
    await expect(
      library.page.getByText("Nessuna lettura trovata", { exact: true }),
    ).toBeVisible();
    await button(library.page, "Mostra tutte le letture").click();
    await expect(
      library.page.getByRole("link", { name: article.title, exact: true }),
    ).toBeVisible();
    const graph = await schema(library.page);
    expect(
      graph["@graph"].some((node) => node["@type"] === "CollectionPage"),
    ).toBe(true);
    expect(
      graph["@graph"].some((node) => node["@type"] === "BreadcrumbList"),
    ).toBe(true);
    await library.page
      .getByRole("link", { name: "Scopri il progetto MetiMaia", exact: true })
      .click();
    await expect(heading(library.page, "Crescere insieme.")).toBeVisible();
    const projectGraph = await schema(library.page);
    expect(
      projectGraph["@graph"].some((node) => node["@type"] === "AboutPage"),
    ).toBe(true);
    expect(JSON.stringify(projectGraph)).not.toContain(
      "https://metimaia.com/discover#webpage",
    );
    await noOverflow(library.page);
    await library.context.close();
    passed(
      `${width}px: catalogue-empty differs from filter-empty and SPA navigation replaces structured page data`,
    );
  }

  const unrelated = await fixture(390, outsider);
  await unrelated.page.goto(origin + "/miei-documenti");
  await expect(
    unrelated.page.getByText(
      "Gaia non ha ancora condiviso materiali con questo account. Quando lo farà, li ritroverai qui.",
      { exact: true },
    ),
  ).toBeVisible();
  for (const item of documents)
    await expect(heading(unrelated.page, item.title)).toHaveCount(0);
  await unrelated.page
    .getByLabel("Cerca nei miei documenti", { exact: true })
    .fill("alfa");
  await button(unrelated.page, "Cerca documenti").click();
  await expect(heading(unrelated.page, documents[0].title)).toHaveCount(0);
  await unrelated.context.close();
  passed(
    "390px: another account cannot discover the patient's assigned materials through search",
  );

  const narrow = await fixture(320, patient);
  await button(narrow.page, "Vai al mio percorso").click();
  await expect(button(narrow.page, "Apri i miei documenti")).toBeVisible();
  await noOverflow(narrow.page);
  await button(narrow.page, "Apri i miei documenti").click();
  await expect(heading(narrow.page, documents[0].title)).toBeVisible();
  await noOverflow(narrow.page);
  await narrow.context.close();
  passed(
    "320px: patient shortcuts and document filters fit a narrow phone viewport",
  );

  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
  await writeFile(
    resolve(artifacts, "results.json"),
    JSON.stringify({ root, checks, errors, unexpected }, null, 2),
  );
  console.log(
    JSON.stringify({ checks: checks.length, errors, unexpected, artifacts }),
  );
} finally {
  await Promise.allSettled(contexts.map((context) => context.close()));
  await browser.close();
  await new Promise((done) => server.close(done));
}
