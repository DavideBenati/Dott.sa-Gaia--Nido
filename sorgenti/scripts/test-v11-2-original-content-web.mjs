// Original authorship and external references in the production static build.
// All services are disposable fixtures: no real users or publications change.
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const root = resolve(
  process.argv[2] ?? "/workspace/shared/downloads/maia-v11-2-final",
);
const artifacts = resolve(
  process.env.MAIA_ORIGINAL_ARTIFACTS ??
    "/workspace/shared/downloads/maia-v11-2-original-checks",
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
const contexts = [];
const errors = [];
const unexpected = [];
const checks = [];
const uid = "11111111-1111-4111-8111-111111111111";
const stamp = "2026-10-30T12:00:00.000Z";
const user = {
  id: uid,
  email: "original-editor@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: stamp,
  created_at: stamp,
  app_metadata: {},
  user_metadata: {},
  identities: [],
  factors: [],
};
const article = {
  id: "22222222-2222-4222-8222-222222222222",
  slug: "materiale-originale-di-prova",
  title: "Materiale originale di prova",
  subtitle: "Un testo scritto per accompagnare le famiglie.",
  categoryId: "home",
  stage: "all",
  weekFrom: null,
  weekTo: null,
  imageUrl: "https://images.example.invalid/cover.png",
  readingMinutes: 3,
  authorName: "Dott.sa Gaia",
  authorRole: "Ostetrica",
  publishedAt: null,
  reviewedAt: null,
  reviewerName: null,
  status: "draft",
  approved: false,
  isDemo: true,
  sections: [
    {
      heading: "Un testo originale",
      paragraphs: ["Un messaggio originale della professionista."],
    },
  ],
  references: [],
  videoUrl: null,
};
const button = (page, name) => page.getByRole("button", { name, exact: true });
const saveCalls = (state) =>
  state.calls.filter((call) => call.path.endsWith("/rpc/save_article"));
const copy = (value) => JSON.parse(JSON.stringify(value));
function passed(label) {
  checks.push(label);
  console.log("PASS " + label);
}
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
async function fixture(width) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    serviceWorkers: "block",
  });
  contexts.push(context);
  const state = { article: copy(article), calls: [] };
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === "images.example.invalid")
      return route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
          "base64",
        ),
      });
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
    state.calls.push({ method: request.method(), path: url.pathname, body });
    const json = (value) =>
      route.fulfill({
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
    if (rpc === "is_editor") return json(true);
    if (["is_chat_staff", "care_chat_available"].includes(rpc))
      return json(false);
    if (rpc === "professional_access_status")
      return json({
        editor: true,
        chat: false,
        mfa_required: true,
        mfa_satisfied: true,
      });
    if (rpc === "my_member_profile")
      return json({
        nickname: "Gaia",
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
    if (rpc === "save_article") {
      state.article = copy(body.document);
      return json(state.article);
    }
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
      const publicRequest = url.searchParams.has("status");
      return json(
        !publicRequest ||
          (state.article.status === "published" &&
            state.article.approved &&
            !state.article.isDemo)
          ? [{ payload: state.article }]
          : [],
      );
    }
    if (url.pathname.endsWith("/article_categories"))
      return json([{ id: "home", name: "Primi giorni a casa", icon: "home" }]);
    if (
      ["checklists", "user_favorites", "checklist_progress"].some((name) =>
        url.pathname.endsWith("/" + name),
      )
    )
      return json([]);
    unexpected.push(request.method() + " " + url.pathname);
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(
    `${origin}/studio#access_token=${token()}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`,
  );
  await expect(button(page, "Apri articoli e checklist")).toBeVisible();
  return { context, page, state };
}
async function editArticle(page) {
  await button(page, "Apri articoli e checklist").click();
  await button(page, `Modifica ${article.title}`).click();
  await expect(page.getByLabel("Titolo", { exact: true })).toHaveValue(
    article.title,
  );
}
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}

try {
  for (const width of [390, 1280]) {
    const { context, page, state } = await fixture(width);
    await editArticle(page);
    const original = page.getByRole("checkbox", {
      name: "Materiale originale dell’autrice o dell’autore",
      exact: true,
    });
    await expect(original).not.toBeChecked();
    await button(page, "Approva e pubblica").click();
    await expect(
      page.getByText(
        "Aggiungi una fonte oppure conferma che il testo è materiale originale dell’autrice o dell’autore.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(saveCalls(state)).toHaveLength(0);
    await expect(original).not.toBeChecked();
    passed(
      `${width}px: an unchanged legacy article still requires a source declaration`,
    );

    await original.click();
    await expect(original).toBeChecked();
    await button(page, "Salva bozza").click();
    await expect(
      page.getByText("Articolo salvato: bozza.", { exact: true }),
    ).toBeVisible();
    expect(saveCalls(state).at(-1).body.document).toMatchObject({
      originalContent: true,
      references: [],
      approved: false,
      status: "draft",
    });
    await button(page, "Approva e pubblica").click();
    await expect(
      page.getByText("Articolo salvato: pubblicato.", { exact: true }),
    ).toBeVisible();
    expect(saveCalls(state).at(-1).body.document).toMatchObject({
      originalContent: true,
      references: [],
      authorName: "Dott.sa Gaia",
      reviewerName: "Dott.sa Gaia",
      approved: true,
      status: "published",
      isDemo: false,
    });
    await noOverflow(page);
    await original.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: resolve(artifacts, `original-studio-${width}.png`),
    });
    passed(
      `${width}px: original material saves and publishes without invented external references`,
    );

    await page.goto(`${origin}/article?id=${article.id}`);
    await expect(
      page.getByRole("heading", { name: article.title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Materiale originale di Dott.sa Gaia", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Fonti e approfondimenti", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Dott.sa Gaia", { exact: true }).first(),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: article.title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Materiale originale di Dott.sa Gaia", { exact: true }),
    ).toBeVisible();
    await noOverflow(page);
    await page.screenshot({
      path: resolve(artifacts, `original-article-${width}.png`),
    });
    passed(
      `${width}px: the public original attribution survives a direct-URL reload`,
    );

    await page.goto(`${origin}/studio`);
    await editArticle(page);
    await expect(original).toBeChecked();
    const before = saveCalls(state).length;
    await original.click();
    await button(page, "Approva e pubblica").click();
    expect(saveCalls(state)).toHaveLength(before);
    await original.click();
    await button(page, "Aggiungi fonte").click();
    await page
      .getByLabel("Nome fonte 1", { exact: true })
      .fill("Fonte di prova");
    await page
      .getByLabel("Link fonte 1", { exact: true })
      .fill("http://example.invalid/fonte");
    await button(page, "Approva e pubblica").click();
    await expect(
      page.getByText(
        "Ogni riferimento deve avere un titolo e un collegamento HTTPS.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(saveCalls(state)).toHaveLength(before);
    await noOverflow(page);
    passed(
      `${width}px: removing original authorship or supplying an invalid reference blocks publication before a write`,
    );
    await context.close();
  }
  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
  await writeFile(
    resolve(artifacts, "results.json"),
    JSON.stringify({ root, checks, errors, unexpected }, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({ checks: checks.length, errors, unexpected, artifacts }),
  );
} finally {
  await Promise.allSettled(contexts.map((context) => context.close()));
  await browser.close();
  await new Promise((done) => server.close(done));
}
