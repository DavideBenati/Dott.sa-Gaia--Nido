// Bounded checks against the packaged build. Every external request is mocked;
// all account, preference and progress writes stay inside disposable fixtures.
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const root = resolve(
  process.argv[2] ?? "/workspace/shared/downloads/maia-v11-rc1",
);
const artifacts = resolve(
  process.env.MAIA_V11_ONBOARDING_ARTIFACTS ??
    "/workspace/shared/downloads/maia-v11-onboarding-checks",
);
const port = Number(process.env.MAIA_V11_ONBOARDING_PORT ?? 8157);
const origin = `http://127.0.0.1:${port}`;
const uid = "11111111-1111-4111-8111-111111111111";
const stamp = "2026-10-25T10:00:00.123456+00:00";
const user = {
  id: uid,
  email: "onboarding-browser@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: stamp,
  created_at: stamp,
  app_metadata: {},
  user_metadata: {},
  identities: [],
  factors: [],
};
const defaults = {
  journey: "pregnancy",
  personalized: false,
  date: null,
  feedingTopics: [],
  sensitiveConsent: false,
  notifications: false,
  marketing: false,
  onboarded: false,
};
const member = {
  nickname: "Nickname Riservato",
  journey_shared: false,
  shared_journey: null,
  shared_interests: [],
  journey_consent_at: null,
  journey_consent_version: null,
  sharing_updated_at: null,
};
const checklist = {
  id: "22222222-2222-4222-8222-222222222222",
  title: "Due piccoli passi",
  description: "Una checklist di prova.",
  stage: "all",
  status: "published",
  approved: true,
  isDemo: false,
  items: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      label: "Preparare una domanda",
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      label: "Scegliere un momento tranquillo",
    },
  ],
};
const emptyChecklist = {
  ...checklist,
  id: "55555555-5555-4555-8555-555555555555",
  title: "Lista ancora vuota",
  items: [],
};
const article = {
  id: "66666666-6666-4666-8666-666666666666",
  slug: "lettura-di-prova",
  title: "Una lettura di prova",
  subtitle: "Con i tuoi tempi.",
  categoryId: "birth",
  stage: "all",
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
      paragraphs: ["Piccoli gesti da adattare alle proprie esigenze."],
    },
  ],
  references: [],
  videoUrl: null,
};
const shopProduct = {
  id: "77777777-7777-4777-8777-777777777777",
  kind: "amazon",
  title: "Libro di prova",
  description: "Un consiglio di acquisto di prova.",
  price_cents: 0,
  image_url: "",
  checkout_url: "https://www.amazon.it/dp/FIXTURE",
  status: "published",
};
const checks = [],
  errors = [],
  unexpected = [],
  contexts = [];
let currentPage;
await mkdir(artifacts, { recursive: true });
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
  args: ["--no-sandbox", "--disable-external-intent-requests"],
});
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
        exp: now + 3600,
        iat: now,
      }),
    ).toString("base64url"),
    "test-only",
  ].join(".");
}
function passed(label) {
  checks.push(label);
  console.log("PASS " + label);
}
const heading = (page, name) =>
  page.getByRole("heading", { name, exact: true });
const button = (page, name) => page.getByRole("button", { name, exact: true });
const saves = (state) =>
  state.calls.filter((call) => call.path.endsWith("/rpc/save_preferences"));
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}
async function fixture(options = {}) {
  const context = await browser.newContext({
    viewport: { width: options.width ?? 390, height: 844 },
    serviceWorkers: "block",
  });
  contexts.push(context);
  const state = {
    preferences: { ...defaults, ...options.preferences },
    favorites: [...(options.favorites ?? [])],
    progress: { ...options.progress },
    calls: [],
    failPreferences: Boolean(options.failPreferences),
    failSelection: Boolean(options.failSelection),
    milestones: { first_recommendation_selected: false },
  };
  let releaseHydration;
  const hydration = options.gateHydration
    ? new Promise((done) => {
        releaseHydration = done;
      })
    : Promise.resolve();
  state.releaseHydration = () => releaseHydration?.();
  await context.addInitScript(() => {
    window.__shares = [];
    window.__externalOpens = [];
    window.open = (url) => {
      window.__externalOpens.push(String(url));
      return null;
    };
    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      value: async (value) => {
        window.__shares.push(value);
      },
    });
  });
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
    state.calls.push({ method: request.method(), path: url.pathname, body });
    const json = (value, status = 200) =>
      route.fulfill({
        status,
        headers,
        contentType: "application/json",
        body: JSON.stringify(value),
      });
    const rpc = url.pathname.split("/rpc/")[1];
    if (url.pathname.endsWith("/auth/v1/user")) return json(user);
    if (url.pathname.endsWith("/auth/v1/signup"))
      return json({ user, session: null });
    if (url.pathname.endsWith("/auth/v1/token"))
      return json({
        access_token: token(),
        refresh_token: "test-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user,
      });
    if (["is_editor", "is_chat_staff", "care_chat_available"].includes(rpc))
      return json(false);
    if (rpc === "professional_access_status")
      return json({
        editor: false,
        chat: false,
        mfa_required: false,
        mfa_satisfied: true,
      });
    if (rpc === "my_member_profile") return json(member);
    if (rpc === "my_member_milestones") return json(state.milestones);
    if (rpc === "record_first_recommendation_selection") {
      if (state.failSelection)
        return json(
          { message: "Fixture selection denied", code: "42501" },
          403,
        );
      state.milestones.first_recommendation_selected = true;
      return json(state.milestones);
    }
    if (rpc === "my_pregnancy_profile") return json(null);
    if (rpc === "save_preferences") {
      state.preferences = JSON.parse(JSON.stringify(body.preferences));
      return json(null);
    }
    if (url.pathname.endsWith("/user_preferences")) {
      await hydration;
      return state.failPreferences
        ? json({ message: "Fixture preferences denied", code: "42501" }, 403)
        : json({ payload: state.preferences });
    }
    if (url.pathname.endsWith("/notification_preferences"))
      return json({
        enabled: state.preferences.notifications,
        marketing: state.preferences.marketing,
      });
    if (url.pathname.endsWith("/user_favorites")) {
      if (request.method() === "POST")
        state.favorites = [...new Set([...state.favorites, body.article_id])];
      if (request.method() === "DELETE")
        state.favorites = state.favorites.filter(
          (id) => `eq.${id}` !== url.searchParams.get("article_id"),
        );
      return json(
        request.method() === "GET"
          ? state.favorites.map((article_id) => ({ article_id }))
          : null,
      );
    }
    if (url.pathname.endsWith("/checklist_progress")) {
      if (request.method() === "POST")
        state.progress[body.item_id] = body.completed;
      return json(
        request.method() === "GET"
          ? Object.entries(state.progress).map(([item_id, completed]) => ({
              item_id,
              completed,
            }))
          : null,
      );
    }
    if (url.pathname.endsWith("/articles")) return json([{ payload: article }]);
    if (url.pathname.endsWith("/checklists"))
      return json([{ payload: checklist }, { payload: emptyChecklist }]);
    if (url.pathname.endsWith("/article_categories"))
      return json([{ id: "birth", name: "Nascita", icon: "baby" }]);
    if (url.pathname.endsWith("/shop_products")) return json([shopProduct]);
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
    if (url.pathname.endsWith("/site_profile"))
      return json({
        id: 1,
        bio: "Presentazione di prova.",
        portrait_url: "",
        qualifications: "",
        service_area: "Roma",
        services: [],
        contact_email: "contact@example.invalid",
        privacy_providers: "Fornitori di prova",
        privacy_retention: "",
        privacy_transfers: "",
        privacy_reviewed: false,
      });
    unexpected.push(request.method() + " " + url.pathname);
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  currentPage = page;
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  const callback = (type = "signup", path = "/account") =>
    page.goto(
      `${origin}${path}#access_token=${token()}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=${type}`,
    );
  return { page, state, callback, close: () => context.close() };
}
async function atProfileChoice(page) {
  await expect(heading(page, "Come vuoi vivere MAIA?")).toBeVisible();
  await expect(heading(page, "Crescere insieme.")).toHaveCount(0);
}
async function selectType(page, type) {
  await page.getByRole("radio", { name: type, exact: true }).click();
  await button(page, "Continua").click();
}
async function atProject(page) {
  await expect(heading(page, "Crescere insieme.")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/gaia");
}
try {
  {
    const { page, state, close } = await fixture();
    await page.goto(origin + "/welcome");
    await expect(heading(page, "Da dove iniziamo?")).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await button(page, "Iscriviti e iniziamo").click();
    await expect(heading(page, "Il tuo spazio MAIA")).toBeVisible();
    expect(saves(state)).toHaveLength(0);
    await noOverflow(page);
    await page.screenshot({
      path: resolve(artifacts, "signup-mobile.png"),
      fullPage: true,
    });
    passed(
      "390: guest starts with account creation; no pre-authentication profile choice or preference write",
    );
    await close();
  }
  {
    const { page, state, callback, close } = await fixture();
    await page.goto(origin + "/account?journey=partner");
    await page
      .getByLabel("Nickname", { exact: true })
      .fill("Nickname Riservato");
    await page.getByLabel("Email account", { exact: true }).fill(user.email);
    await page
      .getByLabel("Password account", { exact: true })
      .fill("Fixture-password-123");
    await button(page, "Crea account").click();
    await expect(heading(page, "Controlla la tua email")).toBeVisible();
    expect(
      state.calls.filter((call) => call.path.endsWith("/auth/v1/signup")),
    ).toHaveLength(1);
    expect(saves(state)).toHaveLength(0);
    await callback();
    await atProfileChoice(page);
    await expect(button(page, "Continua")).toBeDisabled();
    await expect(page.getByRole("radio")).toHaveCount(5);
    await selectType(page, "Genitore");
    await expect(heading(page, "Un percorso che ti somiglia.")).toBeVisible();
    expect(state.preferences).toMatchObject({
      profileType: "parent",
      journey: "pregnancy",
      exploreOnly: false,
      onboarded: false,
      date: null,
      sensitiveConsent: false,
    });
    expect(
      state.calls.filter((call) =>
        call.path.endsWith("/rpc/save_my_pregnancy_profile"),
      ),
    ).toHaveLength(0);
    await expect(
      button(page, "Aggiungi dati gravidanza facoltativi"),
    ).toBeVisible();
    await button(page, "Continua").click();
    await expect(heading(page, "Solo ciò che ti fa stare bene.")).toBeVisible();
    await button(page, "Entra in MAIA").click();
    await atProject(page);
    expect(state.preferences).toMatchObject({
      profileType: "parent",
      onboarded: true,
      date: null,
      personalized: false,
      sensitiveConsent: false,
    });
    passed(
      "390: signup waits for confirmation, then explicit parent choice and optional medical step precede the project",
    );
    await close();
  }
  {
    const { page, state, close } = await fixture({ width: 1280 });
    await page.goto(origin + "/account?mode=login&journey=postpartum");
    await page.getByLabel("Email account", { exact: true }).fill(user.email);
    await page
      .getByLabel("Password account", { exact: true })
      .fill("Fixture-password-123");
    await button(page, "Accedi").click();
    await atProfileChoice(page);
    await noOverflow(page);
    await page.screenshot({
      path: resolve(artifacts, "profile-choice-desktop.png"),
      fullPage: true,
    });
    await selectType(page, "Partner");
    await expect(heading(page, "Un percorso che ti somiglia.")).toBeVisible();
    await button(page, "Dopo la nascita").click();
    await button(page, "Continua").click();
    await button(page, "Entra in MAIA").click();
    await atProject(page);
    expect(state.preferences).toMatchObject({
      profileType: "partner",
      journey: "partner",
      partnerStage: "postpartum",
      exploreOnly: false,
      onboarded: true,
      date: null,
      personalized: false,
      sensitiveConsent: false,
    });
    passed(
      "1280: direct login resumes explicit partner selection and saves the selected phase without health data",
    );
    await close();
  }
  for (const [label, profileType, journey] of [
    ["Parente", "relative", "partner"],
    ["Amico/a", "friend", "partner"],
    ["Mi informo", "exploring", "pregnancy"],
  ]) {
    const { page, state, callback, close } = await fixture();
    await callback();
    await atProfileChoice(page);
    await selectType(page, label);
    await expect(heading(page, "Solo ciò che ti fa stare bene.")).toBeVisible();
    await expect(heading(page, "Un percorso che ti somiglia.")).toHaveCount(0);
    expect(state.preferences).toMatchObject({
      profileType,
      journey,
      exploreOnly: true,
      onboarded: false,
      date: null,
      personalized: false,
      sensitiveConsent: false,
    });
    await button(page, "Entra in MAIA").click();
    await atProject(page);
    expect(state.preferences.onboarded).toBe(true);
    passed(
      `390: confirmed direct entry maps ${profileType} to a general path and skips medical questions`,
    );
    await close();
  }
  {
    const { page, state, callback, close } = await fixture({
      preferences: { profileType: "parent", onboarded: false },
    });
    await callback();
    await expect(heading(page, "Un percorso che ti somiglia.")).toBeVisible();
    await page.reload();
    await expect(heading(page, "Un percorso che ti somiglia.")).toBeVisible();
    expect(saves(state)).toHaveLength(0);
    await button(page, "Continua senza personalizzazione").click();
    await atProject(page);
    expect(state.preferences).toMatchObject({
      profileType: "parent",
      onboarded: true,
      date: null,
    });
    passed(
      "390: an interrupted parent checkpoint resumes after reload and can finish without personalization",
    );
    await close();
  }
  {
    const existing = {
      profileType: "parent",
      onboarded: true,
      journey: "postpartum",
      personalized: true,
      sensitiveConsent: true,
      date: "2026-10-01",
      feedingTopics: ["Benessere emotivo"],
    };
    const { page, state, callback, close } = await fixture({
      width: 1280,
      preferences: existing,
    });
    await callback("signup", "/account?journey=partner");
    await atProject(page);
    expect(state.preferences).toMatchObject(existing);
    expect(saves(state)).toHaveLength(0);
    passed(
      "1280: an existing complete profile opens the project without resetting its date, consent or journey from URL parameters",
    );
    await close();
  }
  {
    const { page, state, callback, close } = await fixture({
      preferences: { profileType: "friend", onboarded: true },
      gateHydration: true,
    });
    await callback();
    await expect
      .poll(() =>
        state.calls.some((call) => call.path.endsWith("/user_preferences")),
      )
      .toBe(true);
    await expect(heading(page, "Come vuoi vivere MAIA?")).toHaveCount(0);
    await expect(heading(page, "Crescere insieme.")).toHaveCount(0);
    expect(saves(state)).toHaveLength(0);
    state.releaseHydration();
    await atProject(page);
    expect(saves(state)).toHaveLength(0);
    passed(
      "390: confirmation waits for remote preferences before deciding whether onboarding is already complete",
    );
    await close();
  }
  {
    const { page, state, callback, close } = await fixture();
    await callback("recovery");
    await expect(
      page.getByLabel("Nuova password", { exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/account");
    await expect(heading(page, "Come vuoi vivere MAIA?")).toHaveCount(0);
    await expect(heading(page, "Crescere insieme.")).toHaveCount(0);
    expect(saves(state)).toHaveLength(0);
    passed(
      "390: password recovery stays on password editing and never redirects into signup or project",
    );
    await close();
  }
  {
    const { page, state, callback, close } = await fixture({
      failPreferences: true,
    });
    await callback();
    await expect(heading(page, "Il tuo account MAIA")).toBeVisible();
    await page.goto(origin + "/welcome?onboarding=1");
    await expect(
      page.getByText(
        "Non riusciamo a caricare le preferenze. Accedi nuovamente prima di completare il profilo.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(heading(page, "Come vuoi vivere MAIA?")).toHaveCount(0);
    expect(saves(state)).toHaveLength(0);
    passed(
      "390: failed remote preference loading blocks onboarding saves instead of overwriting an account with defaults",
    );
    await close();
  }
  {
    const { page, state, close } = await fixture();
    await page.goto(origin + "/traguardi");
    await expect(page.getByText(/^0 traguardi raggiunti\./)).toBeVisible();
    await expect(
      button(page, "Condividi il badge: Benvenuto in MetiMaia"),
    ).toHaveCount(0);
    await expect(
      button(page, "Condividi il badge: Lista ancora vuota"),
    ).toHaveCount(0);
    await page.goto(`${origin}/checklist?id=${checklist.id}`);
    await expect(page.getByRole("checkbox")).toHaveCount(2);
    await page.getByRole("checkbox").first().click();
    await expect(page.getByRole("checkbox").first()).toBeChecked();
    await expect(
      heading(page, "🌷 Un piccolo traguardo raggiunto"),
    ).toHaveCount(0);
    await page.getByRole("checkbox").last().click();
    await expect(
      heading(page, "🌷 Un piccolo traguardo raggiunto"),
    ).toBeVisible();
    await page.goto(origin + "/traguardi");
    await expect(page.getByText(/^1 traguardo raggiunto\./)).toBeVisible();
    await expect(
      button(page, "Condividi il badge: Due piccoli passi"),
    ).toBeVisible();
    await expect(
      button(page, "Condividi il badge: Lista ancora vuota"),
    ).toHaveCount(0);
    await button(
      page,
      "Condividi il badge: Due piccoli passi",
    ).scrollIntoViewIfNeeded();
    await noOverflow(page);
    await page.screenshot({
      path: resolve(artifacts, "guest-checklist-badge-mobile.png"),
      fullPage: true,
    });
    await page.goto(`${origin}/checklist?id=${checklist.id}`);
    await page.getByRole("checkbox").last().click();
    await expect(
      heading(page, "🌷 Un piccolo traguardo raggiunto"),
    ).toHaveCount(0);
    await page.goto(origin + "/traguardi");
    await expect(page.getByText(/^0 traguardi raggiunti\./)).toBeVisible();
    expect(
      state.calls.filter((call) => !["GET", "HEAD"].includes(call.method)),
    ).toHaveLength(0);
    passed(
      "390: guests earn only a fully checked nonempty checklist badge; unchecking reverses it and writes stay local",
    );
    await close();
  }
  {
    const { page, state, callback, close } = await fixture({
      width: 1280,
      preferences: {
        profileType: "parent",
        onboarded: true,
        personalized: true,
        sensitiveConsent: true,
        date: "2026-10-01",
      },
      favorites: [article.id],
    });
    await callback();
    await atProject(page);
    await page.goto(origin + "/traguardi");
    await expect(page.getByText(/^3 traguardi raggiunti\./)).toBeVisible();
    for (const name of [
      "Benvenuto in MetiMaia",
      "Il mio spazio è pronto",
      "Una lettura da ritrovare",
    ]) {
      await button(page, `Condividi il badge: ${name}`).click();
      const payload = await page.evaluate(() => window.__shares.at(-1));
      expect(payload.text).toContain(name);
      expect(payload.url).toBe("https://metimaia.com/welcome");
      const shared = JSON.stringify(payload);
      for (const secret of [
        user.email,
        uid,
        member.nickname,
        "2026-10-01",
        "personalized",
        "sensitiveConsent",
      ])
        expect(shared).not.toContain(secret);
    }
    await expect(
      page.getByText(/primo acquisto|acquisto verificato|prima scoperta/i),
    ).toHaveCount(0);
    await noOverflow(page);
    await page.screenshot({
      path: resolve(artifacts, "account-badges-desktop.png"),
      fullPage: true,
    });
    await page.goto(`${origin}/article?id=${article.id}`);
    await button(page, "Rimuovi dai salvati").click();
    await expect(button(page, "Salva articolo")).toBeVisible();
    await page.goto(origin + "/traguardi");
    await expect(page.getByText(/^2 traguardi raggiunti\./)).toBeVisible();
    expect(state.favorites).toEqual([]);
    passed(
      "1280: account, completed-profile and saved-reading badges count correctly; shares exclude private data and unsaving reverses its badge",
    );
    await close();
  }
  {
    const guest = await fixture();
    await guest.page.goto(origin + "/shop");
    await button(guest.page, `Vedi su Amazon: ${shopProduct.title}`).click();
    expect(await guest.page.evaluate(() => window.__externalOpens)).toEqual([
      shopProduct.checkout_url,
    ]);
    expect(
      guest.state.calls.filter((call) =>
        call.path.endsWith("/rpc/record_first_recommendation_selection"),
      ),
    ).toHaveLength(0);
    await guest.page.goto(origin + "/traguardi");
    await expect(
      button(guest.page, "Condividi il badge: Prima selezione"),
    ).toHaveCount(0);
    await guest.close();
    for (const failSelection of [false, true]) {
      const { page, state, callback, close } = await fixture({
        preferences: { profileType: "exploring", onboarded: true },
        failSelection,
      });
      await callback();
      await atProject(page);
      const before = JSON.stringify(state.preferences);
      await page.goto(origin + "/shop");
      await button(page, `Vedi su Amazon: ${shopProduct.title}`).click();
      await expect
        .poll(
          () =>
            state.calls.filter((call) =>
              call.path.endsWith("/rpc/record_first_recommendation_selection"),
            ).length,
        )
        .toBe(1);
      expect(await page.evaluate(() => window.__externalOpens)).toEqual([
        shopProduct.checkout_url,
      ]);
      const record = state.calls.find((call) =>
        call.path.endsWith("/rpc/record_first_recommendation_selection"),
      );
      expect(record.body.p_expected_user_id).toBe(uid);
      expect(saves(state)).toHaveLength(0);
      expect(JSON.stringify(state.preferences)).toBe(before);
      await page.goto(origin + "/traguardi");
      if (failSelection) {
        await expect(
          button(page, "Condividi il badge: Prima selezione"),
        ).toHaveCount(0);
        await expect(page.getByText(/^2 traguardi raggiunti\./)).toBeVisible();
      } else {
        await expect(
          button(page, "Condividi il badge: Prima selezione"),
        ).toBeVisible();
        await expect(page.getByText(/^3 traguardi raggiunti\./)).toBeVisible();
        await button(page, "Condividi il badge: Prima selezione").click();
        await noOverflow(page);
        await page.screenshot({
          path: resolve(artifacts, "first-selection-mobile.png"),
          fullPage: true,
        });
        const payload = await page.evaluate(() => window.__shares.at(-1));
        expect(JSON.stringify(payload)).not.toMatch(
          /primo acquisto|acquisto verificato|ordine confermato|onboarding-browser|Nickname Riservato/i,
        );
      }
      await expect(
        page.getByText(/primo acquisto|acquisto verificato|ordine confermato/i),
      ).toHaveCount(0);
      await close();
    }
    passed(
      "390: an authenticated Amazon selection records its own milestone without changing preferences; denied persistence leaves the badge locked and no purchase is claimed",
    );
  }
  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
  await writeFile(
    resolve(artifacts, "results.json"),
    JSON.stringify(
      { root, viewports: [390, 1280], checks, errors, unexpected },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `PASS ${checks.length} bounded onboarding and achievement checks; all external requests mocked`,
  );
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await currentPage
      .screenshot({ path: resolve(artifacts, "failure.png"), fullPage: true })
      .catch(() => {});
    await writeFile(
      resolve(artifacts, "failure.txt"),
      await currentPage
        .locator("body")
        .innerText()
        .catch(() => ""),
    ).catch(() => {});
  }
  await writeFile(
    resolve(artifacts, "results.json"),
    JSON.stringify(
      { root, checks, errors, unexpected, failure: String(error) },
      null,
      2,
    ) + "\n",
  );
  throw error;
} finally {
  await Promise.allSettled(contexts.map((context) => context.close()));
  await browser.close();
  await new Promise((done) => server.close(done));
}
