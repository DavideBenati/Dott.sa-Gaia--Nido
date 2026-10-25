// Focused production-build smoke. All external requests are mocked; this never
// changes a real account, sends email, opens a real meeting or buys a product.
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
const root = resolve(process.argv[2] ?? "apps/mobile/dist-web");
const port = Number(process.env.MAIA_V9_CONTENT_PORT ?? 8141);
const origin = `http://127.0.0.1:${port}`;
const artifacts = resolve(
  process.env.MAIA_V9_CONTENT_ARTIFACTS ??
    "/workspace/shared/downloads/iscritti-percorsi-v9/content-browser",
);
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
const server = createServer(async (req, res) => {
  try {
    let file = resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, origin).pathname),
    );
    if (file !== root && !file.startsWith(root + "/"))
      return res.writeHead(403).end();
    if (file === root) file += "/index.html";
    try {
      if (!(await stat(file)).isFile()) throw new Error();
    } catch {
      file += ".html";
    }
    res.setHeader(
      "Content-Type",
      mime[extname(file)] ?? "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ready) => server.listen(port, "127.0.0.1", ready));
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-external-intent-requests"],
});
const contexts = [],
  checks = [],
  errors = [],
  unexpected = [];
let currentPage;
const uid = "11111111-1111-4111-8111-111111111111";
const recipientId = "22222222-2222-4222-8222-222222222222";
const invitationId = "33333333-3333-4333-8333-333333333333";
const room = "https://meet.hostpoint.ch/beta-random-room-938473";
const stamp = new Date().toISOString();
const user = {
  id: uid,
  email: "beta@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: stamp,
  created_at: stamp,
  app_metadata: {},
  user_metadata: {},
  identities: [],
  factors: [],
};
const starter = {
  id: 1,
  bio: "Come ostetrica desidero accompagnarvi con ascolto, rispetto e competenza. Ogni famiglia ha la propria storia, i propri tempi e il proprio modo di crescere insieme.",
  portrait_url: "",
  qualifications: "",
  service_area: "Modalità, luoghi e disponibilità da concordare direttamente.",
  services: [],
  contact_email: "ostetricamaia@gmail.com",
  privacy_providers: "Fornitori già configurati",
  privacy_retention: "",
  privacy_transfers: "",
  privacy_reviewed: true,
};
// Exact previous supplied biography, captured from the preceding release.
const oldBio =
  "Ciao, sono Gaia. Benvenuta in questo spazio dedicato a te, alla nuova vita che cresce e alla tua famiglia.\n\nSe sei qui, probabilmente stai attraversando uno dei momenti più intensi, emozionanti e ricchi di trasformazione della tua vita. Come ostetrica desidero camminare al tuo fianco, passo dopo passo, offrendoti supporto clinico, pratico ed emotivo durante la gravidanza, il parto e i primi mesi da mamma.\n\nNon c’è una ricetta unica per diventare genitori o per partorire. Il mio obiettivo è mettere a tua disposizione l’esperienza ospedaliera e la preparazione scientifica, per rispondere alle tue domande e affrontare insieme dubbi e paure.\n\nLavoreremo insieme ascoltando il tuo corpo, le tue emozioni e i desideri della tua famiglia.";
const oldQualifications =
  "Da 5 anni lavoro come ostetrica presso l’Ospedale San Pietro Fatebenefratelli di Roma. In sala parto e in reparto accompagno le mamme durante la nascita e nei momenti più delicati del loro percorso.\n\nLa mia formazione sul campo è iniziata con oltre 2.300 ore di tirocinio clinico nelle sale parto, nei reparti e nei pronto soccorso della Clinica Fabia Mater, dell’Azienda Ospedaliera Sant’Andrea, dell’Ospedale Sandro Pertini e del San Pietro Fatebenefratelli.\n\nCredo in uno sguardo completo sulla salute della donna, che unisca competenza scientifica, ascolto e attenzione al benessere. Per questo continuo a studiare e ad approfondire la mia formazione.\n\nMaster di I livello in Chirurgia per la Salute della Donna — Università Cattolica del Sacro Cuore di Roma. Un percorso dedicato all’attività di strumentista e alla sala operatoria, anche nel contesto del parto cesareo.\n\nMaster biennale in Oli Essenziali e Formulazioni Cosmetiche — in fase di completamento presso l’Università Cattolica. Sto portando avanti una tesi sperimentale sulla diffusione nell’aria di una miscela di oli essenziali, per studiarne il rapporto con i livelli di cortisolo, un ormone coinvolto nella risposta allo stress. Si tratta di una ricerca in corso.\n\nDiploma da Istruttrice di Ginnastica in Gravidanza. Una formazione per accompagnare il movimento, la preparazione del bacino e del pavimento pelvico e il benessere del corpo durante la gestazione.";
const persisted = {
  ...starter,
  bio: oldBio,
  qualifications: oldQualifications,
  service_area: "Roma: consulenze private da concordare.",
  services: [
    {
      title: "Corsi di accompagnamento al parto",
      description: "Incontri dedicati alla nascita.",
      details: "",
    },
  ],
};
const products = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    kind: "amazon",
    title: "Libro Amazon di prova",
    description: "Un libro selezionato, descrizione originale.",
    price_cents: 0,
    image_url: "",
    checkout_url: "https://www.amazon.it/dp/TEST?tag=beta-21",
    status: "published",
  },
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    kind: "doctor",
    title: "Vecchio prodotto proprio",
    description: "Non deve più comparire.",
    price_cents: 1900,
    image_url: "",
    checkout_url: "https://buy.stripe.com/test",
    status: "published",
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    kind: "amazon",
    title: "Bozza Amazon riservata",
    description: "Bozza",
    price_cents: 0,
    image_url: "",
    checkout_url: "https://amzn.to/test",
    status: "draft",
  },
];
function token() {
  const now = Math.floor(Date.now() / 1000);
  return (
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(
      JSON.stringify({
        sub: uid,
        role: "authenticated",
        aud: "authenticated",
        aal: "aal2",
        iat: now,
        exp: now + 3600,
      }),
    ).toString("base64url") +
    ".test-only"
  );
}
const passed = (label) => {
  checks.push(label);
  console.log("PASS " + label);
};
async function fixture({
  width = 390,
  signed = false,
  admin = false,
  profile = starter,
  invited = false,
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height: width > 900 ? 1000 : 844 },
    serviceWorkers: "block",
  });
  contexts.push(context);
  await context.addInitScript(() => {
    window.__opened = [];
    window.open = (url) => {
      window.__opened.push(String(url));
      return null;
    };
  });
  const state = {
    calls: [],
    meetingNavigations: [],
    invitations: invited
      ? [
          {
            id: invitationId,
            recipient_id: uid,
            nickname: "Beta",
            email: user.email,
            expires_at: new Date(Date.now() + 86400000).toISOString(),
          },
        ]
      : [],
  };
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (url.href === room && request.isNavigationRequest()) {
      state.meetingNavigations.push(url.href);
      return route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Meeting mock</title><p>Meeting mock: no external service contacted.</p>",
      });
    }
    if (!url.hostname.endsWith(".supabase.co")) {
      unexpected.push(url.origin + url.pathname);
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
    state.calls.push({ path: url.pathname, method: request.method(), body });
    const json = (value) =>
      route.fulfill({
        headers,
        contentType: "application/json",
        body: JSON.stringify(value),
      });
    const rpc = url.pathname.split("/rpc/")[1];
    if (url.pathname.endsWith("/auth/v1/user")) return json(user);
    if (rpc === "is_editor") return json(admin);
    if (rpc === "is_chat_staff" || rpc === "care_chat_available")
      return json(false);
    if (rpc === "professional_access_status")
      return json({
        editor: admin,
        chat: false,
        mfa_required: false,
        mfa_satisfied: true,
      });
    if (rpc === "my_member_profile")
      return json({
        nickname: "Beta",
        journey_shared: false,
        shared_journey: null,
        shared_interests: [],
        journey_consent_at: null,
        journey_consent_version: null,
        sharing_updated_at: stamp,
      });
    if (rpc === "search_video_call_users")
      return json([
        {
          user_id: recipientId,
          nickname: "Cliente Beta",
          email: "cliente-beta@example.invalid",
        },
      ]);
    if (rpc === "list_video_call_invitations") return json(state.invitations);
    if (rpc === "create_video_call_invitation") {
      state.invitations = [
        {
          id: invitationId,
          recipient_id: body.p_recipient_id,
          nickname: "Cliente Beta",
          email: "cliente-beta@example.invalid",
          expires_at: new Date(Date.now() + 86400000).toISOString(),
        },
      ];
      return json(invitationId);
    }
    if (rpc === "revoke_video_call_invitation") {
      state.invitations = [];
      return json(null);
    }
    if (rpc === "open_video_call_invitation") return json(room);
    if (url.pathname.endsWith("/site_profile")) return json(profile);
    if (url.pathname.endsWith("/shop_settings"))
      return json({
        id: 1,
        enabled: true,
        recommendations_enabled: true,
        amazon_affiliate: true,
        seller_name: "Vecchio venditore",
        seller_address: "",
        seller_contact: "",
        tax_details: "",
        shipping_terms: "",
        returns_terms: "",
        terms_url: "",
      });
    if (url.pathname.endsWith("/shop_products")) return json(products);
    if (url.pathname.endsWith("/user_preferences"))
      return json({
        payload: {
          journey: "pregnancy",
          personalized: false,
          date: null,
          feedingTopics: [],
          sensitiveConsent: false,
          notifications: false,
          marketing: false,
          onboarded: true,
        },
      });
    if (url.pathname.endsWith("/notification_preferences")) return json(null);
    if (
      [
        "articles",
        "checklists",
        "article_categories",
        "user_favorites",
        "checklist_progress",
      ].some((name) => url.pathname.endsWith("/" + name))
    )
      return json([]);
    unexpected.push(url.pathname);
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  currentPage = page;
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  if (signed) {
    await page.goto(
      `${origin}/account#access_token=${token()}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`,
    );
    await expect(
      page.getByText(user.email, { exact: true }).first(),
    ).toBeVisible();
  }
  return { page, state };
}
async function cleanPublic(page) {
  await expect(page.locator("body")).not.toContainText(
    /brunetti|whats\s*app|392[\s.-]*793[\s.-]*9566/i,
  );
  await expect(page.locator('a[href^="tel:"], a[href*="wa.me"]')).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}
async function philosophy(page) {
  await expect(
    page.getByRole("heading", { name: "MetiMaia", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Il significato di MetiMaia",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Il fiore di loto: il simbolo di MetiMaia",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "La crescita della famiglia",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /Ciao, sono Gaia|2\.300 ore|Fatebenefratelli/,
  );
  await cleanPublic(page);
}
try {
  for (const width of [390, 1440]) {
    const { page, state } = await fixture({ width });
    await page.goto(`${origin}/gaia`);
    await philosophy(page);
    expect(
      state.calls.filter(
        (call) => call.path.endsWith("/site_profile") && call.method !== "GET",
      ),
    ).toEqual([]);
    passed(
      `${width}px project philosophy replaces starter, no public phone/surname or overflow`,
    );
    await page.screenshot({
      path: `${artifacts}/filosofia-${width}.png`,
      fullPage: true,
    });
    const { page: priorPage } = await fixture({ width, profile: persisted });
    await priorPage.goto(`${origin}/gaia`);
    await philosophy(priorPage);
    passed(
      `${width}px exact previously saved personal biography replaced on public page`,
    );
    await page.goto(`${origin}/shop`);
    await expect(
      page.getByRole("button", {
        name: "Vedi su Amazon: Libro Amazon di prova",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      /Vecchio prodotto proprio|Bozza Amazon riservata|Stripe|prodotti della dottoressa/i,
    );
    await expect(
      page.getByText(/In qualità di Affiliato Amazon/),
    ).toBeVisible();
    const nav = page.getByRole("tab", {
      name: "Consigli d’acquisto",
      exact: true,
    });
    await expect(nav).toBeVisible();
    const box = await nav.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    await cleanPublic(page);
    passed(
      `${width}px Amazon-only vetrina, disclosure and two-line navigation fit`,
    );
    await page.screenshot({
      path: `${artifacts}/consigli-${width}.png`,
      fullPage: true,
    });
    await page.goto(`${origin}/videochiamate`);
    await expect(
      page.getByRole("button", { name: "Accedi", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Entra nella videochiamata",
        exact: true,
      }),
    ).toHaveCount(0);
    await cleanPublic(page);
    passed(`${width}px video calls require sign-in and reveal no meeting URL`);
  }
  const { page: admin, state: adminState } = await fixture({
    signed: true,
    admin: true,
  });
  await admin.goto(`${origin}/videochiamate?manage=1`);
  await admin
    .getByLabel("Cerca destinatario videochiamata", { exact: true })
    .fill("Beta");
  await admin
    .getByRole("button", { name: "Scegli questo account", exact: true })
    .click();
  await admin
    .getByLabel("Link della stanza Hostpoint", { exact: true })
    .fill(room);
  await admin
    .getByRole("button", {
      name: "Condividi l’invito con questo account",
      exact: true,
    })
    .click();
  await expect(admin.getByText(/Invito creato\./)).toBeVisible();
  const create = adminState.calls.find((call) =>
    call.path.endsWith("/create_video_call_invitation"),
  );
  expect(create.body).toMatchObject({
    p_recipient_id: recipientId,
    p_room_url: room,
    p_expected_user_id: uid,
  });
  await expect(
    admin.getByRole("button", { name: "Revoca questo invito", exact: true }),
  ).toBeVisible();
  passed(
    "Studio creates the meeting invitation for the selected UUID, not nickname/email",
  );
  await admin.screenshot({
    path: `${artifacts}/videochiamate-studio.png`,
    fullPage: true,
  });
  await admin
    .getByRole("button", { name: "Revoca questo invito", exact: true })
    .click();
  await expect(
    admin.getByText("Invito rimosso dall’area personale.", { exact: true }),
  ).toBeVisible();
  expect(
    adminState.calls.find((call) =>
      call.path.endsWith("/revoke_video_call_invitation"),
    ).body,
  ).toMatchObject({ p_invitation_id: invitationId, p_expected_user_id: uid });
  passed("Studio revokes a meeting invitation by UUID and reloads its list");
  const { page: member, state: memberState } = await fixture({
    signed: true,
    invited: true,
  });
  await member.goto(`${origin}/videochiamate`);
  await expect(
    member.getByRole("button", {
      name: "Entra nella videochiamata",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    member.getByLabel("Cerca destinatario videochiamata", { exact: true }),
  ).toHaveCount(0);
  await member
    .getByRole("button", { name: "Entra nella videochiamata", exact: true })
    .click();
  await expect.poll(() => memberState.meetingNavigations).toEqual([room]);
  expect(
    memberState.calls.find((call) =>
      call.path.endsWith("/open_video_call_invitation"),
    ).body,
  ).toMatchObject({ p_invitation_id: invitationId, p_expected_user_id: uid });
  passed(
    "Member opening fetches fresh authorization before opening the external meeting",
  );
  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
  await writeFile(
    `${artifacts}/results.json`,
    JSON.stringify(
      { checks, errors, unexpected, mockedExternalServices: true },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: checks.length, artifacts }));
} catch (error) {
  if (currentPage)
    await currentPage
      .screenshot({ path: `${artifacts}/failure.png`, fullPage: true })
      .catch(() => {});
  await writeFile(
    `${artifacts}/failure.json`,
    JSON.stringify(
      { checks, errors, unexpected, error: String(error) },
      null,
      2,
    ),
  );
  throw error;
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  await new Promise((done) => server.close(done));
}
