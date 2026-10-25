// Browser regression for nickname registration and optional Studio journey
// cards. Every external request is mocked; no account, email or patient data
// is created or sent to a real service.
import { createServer } from "node:http";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const root = resolve(process.argv[2] ?? "apps/mobile/dist-web");
const port = Number(process.env.MAIA_MEMBERS_PORT ?? 8131);
const origin = `http://127.0.0.1:${port}`;
const artifacts = resolve(
  process.env.MAIA_MEMBERS_ARTIFACTS ??
    "/workspace/shared/downloads/iscritti-percorsi-v9/browser",
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
await new Promise((r) => server.listen(port, "127.0.0.1", r));
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-external-intent-requests"],
});
const contexts = [],
  checks = [],
  errors = [],
  unexpected = [];
let currentPage;
const copy = (v) => JSON.parse(JSON.stringify(v));
const uid = "11111111-1111-4111-8111-111111111111";
const memberId = (i) =>
  `${String(i + 2).padStart(8, "0")}-2222-4222-8222-222222222222`;
const stamp = "2026-10-25T10:00:00.000Z";
const user = {
  id: uid,
  email: "nickname-beta@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: stamp,
  created_at: stamp,
  app_metadata: {},
  user_metadata: {},
  identities: [],
  factors: [],
};
const blankProfile = {
  nickname: "Beta Gaia",
  journey_shared: false,
  shared_journey: null,
  shared_interests: [],
  journey_consent_at: null,
  journey_consent_version: null,
  sharing_updated_at: stamp,
};
const initialPreferences = {
  journey: "pregnancy",
  personalized: false,
  date: null,
  feedingTopics: [],
  sensitiveConsent: false,
  notifications: false,
  marketing: false,
  onboarded: true,
};
const siteProfile = {
  id: 1,
  bio: "Presentazione pubblica di prova.",
  portrait_url: "",
  qualifications: "",
  service_area: "Roma",
  services: [],
  contact_email: "contact@example.invalid",
  privacy_providers: "Fornitori di prova",
  privacy_retention: "",
  privacy_transfers: "",
  privacy_reviewed: false,
};
const members = Array.from({ length: 24 }, (_, i) => ({
  user_id: memberId(i),
  nickname: i < 2 ? "Stesso Nome" : `Iscritto ${String(i).padStart(2, "0")}`,
  email: `member-${String(i).padStart(2, "0")}@example.invalid`,
  created_at: stamp,
  email_confirmed: true,
  journey_shared: i % 2 === 0,
  shared_journey: i % 2 === 0 ? "pregnancy" : null,
  shared_interests: i % 2 === 0 ? ["birth_preparation"] : [],
  sharing_updated_at: i % 2 === 0 ? stamp : null,
}));
const doc = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  owner_id: uid,
  title: "Materiale di prova",
  description: "Descrizione fittizia",
  file_name: "materiale-beta.pdf",
  mime_type: "application/pdf",
  size_bytes: 1024,
  storage_path:
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf",
  state: "ready",
  active: true,
  created_at: stamp,
  updated_at: stamp,
  ready_at: stamp,
};
function token(aal = "aal2") {
  const now = Math.floor(Date.now() / 1000);
  return (
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(
      JSON.stringify({
        sub: uid,
        aud: "authenticated",
        role: "authenticated",
        aal,
        exp: now + 3600,
        iat: now,
      }),
    ).toString("base64url") +
    ".test-only"
  );
}
function passed(label) {
  checks.push(label);
  console.log("PASS " + label);
}
async function fixture({
  width = 390,
  signed = false,
  editor = false,
  care = false,
  pending = false,
  failRead = false,
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height: width > 900 ? 1000 : 844 },
    serviceWorkers: "block",
  });
  contexts.push(context);
  await context.addInitScript(() => {
    window.__openedEmails = [];
    window.open = (url) => {
      window.__openedEmails.push(String(url));
      return null;
    };
  });
  const state = {
    calls: [],
    member: copy(blankProfile),
    preferences: copy(initialPreferences),
    members: copy(members),
    failRead,
    failNickname: false,
    conflict: false,
    recipients: [],
    counter: 0,
  };
  const nextStamp = () =>
    new Date(Date.parse(stamp) + ++state.counter * 1000).toISOString();
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (!url.hostname.endsWith(".supabase.co")) {
      unexpected.push({
        method: request.method(),
        url: url.origin + url.pathname,
      });
      return route.abort("blockedbyclient");
    }
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
      "Access-Control-Expose-Headers": "Content-Range",
    };
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    const body = request.headers()["content-type"]?.includes("application/json")
      ? request.postDataJSON()
      : null;
    state.calls.push({
      method: request.method(),
      path: url.pathname,
      query: url.search,
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
    if (
      url.pathname.endsWith("/auth/v1/recover") ||
      url.pathname.endsWith("/auth/v1/logout")
    )
      return json({});
    if (rpc === "is_editor") return json(editor);
    if (rpc === "is_chat_staff") return json(editor && care && !pending);
    if (rpc === "professional_access_status")
      return json({
        editor,
        chat: care,
        mfa_required: false,
        mfa_satisfied: !pending,
      });
    if (rpc === "care_chat_available") return json(false);
    if (rpc === "my_member_profile")
      return state.failRead
        ? json({ code: "XX000", message: "Simulated member read failure" }, 500)
        : json(state.member);
    if (rpc === "set_my_nickname") {
      if (state.failNickname)
        return json(
          { code: "XX000", message: "Simulated nickname save failure" },
          500,
        );
      if (body.p_expected_user_id !== uid)
        return json({ code: "42501", message: "account è cambiato" }, 403);
      state.member.nickname = body.nickname;
      return json(state.member);
    }
    if (rpc === "save_my_shared_journey") {
      if (body.p_expected_user_id !== uid)
        return json({ code: "42501", message: "account è cambiato" }, 403);
      if (state.conflict && body.p_share) {
        state.conflict = false;
        state.member = {
          ...state.member,
          ...blankProfile,
          nickname: state.member.nickname,
          sharing_updated_at: nextStamp(),
        };
        return json({ code: "40001", message: "Il percorso è cambiato" }, 409);
      }
      if (
        body.p_share &&
        body.p_expected_updated_at !== state.member.sharing_updated_at
      )
        return json({ code: "40001", message: "Il percorso è cambiato" }, 409);
      const value = nextStamp();
      state.member = {
        ...state.member,
        journey_shared: body.p_share,
        shared_journey: body.p_share ? body.p_journey : null,
        shared_interests: body.p_share ? body.p_interests : [],
        journey_consent_at: body.p_share ? value : null,
        journey_consent_version: body.p_share ? "2026-10-25-studio-v1" : null,
        sharing_updated_at: value,
      };
      return json(state.member);
    }
    if (rpc === "member_directory") {
      if (!editor)
        return json({ code: "42501", message: "Accesso negato" }, 403);
      const can = care && !pending;
      if (!can && body.journey_filter !== "all")
        return json({ code: "42501", message: "Accesso negato" }, 403);
      const term = (body.search_term ?? "").toLowerCase();
      let rows = state.members.filter((m) =>
        (m.nickname + " " + m.email).toLowerCase().includes(term),
      );
      if (body.journey_filter !== "all")
        rows = rows.filter(
          (m) => m.journey_shared && m.shared_journey === body.journey_filter,
        );
      const total = rows.length;
      rows = rows
        .slice(body.page_offset, body.page_offset + body.page_limit)
        .map((m) =>
          can
            ? m
            : {
                ...m,
                journey_shared: false,
                shared_journey: null,
                shared_interests: [],
                sharing_updated_at: null,
              },
        );
      return json({
        members: rows,
        total,
        can_view_journeys: can,
        journey_membership: care,
        journey_mfa_required: care,
        mfa_satisfied: !pending,
      });
    }
    if (rpc === "save_preferences") {
      state.preferences = copy(body.preferences);
      return json(null);
    }
    if (rpc === "professional_conversation_contacts_v2")
      return json([
        {
          user_id: memberId(0),
          nickname: "Stesso Nome",
          email: "member-00@example.invalid",
          last_message_at: stamp,
          last_message_preview: "Messaggio fittizio",
        },
      ]);
    if (rpc === "document_access_status")
      return json({
        membership: editor && care,
        documents_mfa_required: true,
        can_manage: editor && care && !pending,
        mfa_satisfied: !pending,
      });
    if (rpc === "document_recipients_v2")
      return json(
        state.recipients.map((id) => ({
          user_id: id,
          nickname: "Stesso Nome",
          email:
            id === memberId(0)
              ? "member-00@example.invalid"
              : "member-01@example.invalid",
          granted_at: stamp,
        })),
      );
    if (rpc === "search_document_users_v2")
      return json([
        {
          user_id: memberId(0),
          nickname: "Stesso Nome",
          email: "member-00@example.invalid",
        },
        {
          user_id: memberId(1),
          nickname: "Stesso Nome",
          email: "member-01@example.invalid",
        },
      ]);
    if (rpc === "set_document_recipients") {
      state.recipients = copy(body.user_ids);
      return json(null);
    }
    if (url.pathname.endsWith("/site_profile")) return json(siteProfile);
    if (url.pathname.endsWith("/session_documents")) return json([doc]);
    if (url.pathname.endsWith("/care_messages"))
      return json([
        {
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          conversation_id: memberId(0),
          sender_id: memberId(0),
          body: "Messaggio fittizio",
          created_at: stamp,
        },
      ]);
    if (url.pathname.endsWith("/user_preferences"))
      return json({ payload: state.preferences });
    if (url.pathname.endsWith("/notification_preferences")) return json(null);
    if (
      [
        "articles",
        "checklists",
        "article_categories",
        "user_favorites",
        "checklist_progress",
      ].some((n) => url.pathname.endsWith("/" + n))
    )
      return json([]);
    unexpected.push({
      method: request.method(),
      url: url.origin + url.pathname,
    });
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  currentPage = page;
  page.setDefaultTimeout(12000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  if (signed) {
    await page.goto(
      `${origin}/account#access_token=${token(pending ? "aal1" : "aal2")}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`,
    );
    await expect(
      page.getByText(user.email, { exact: true }).first(),
    ).toBeVisible();
  }
  return { context, page, state };
}
async function noOverflow(page, label) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 2,
    ),
    label,
  ).toBe(true);
}
async function noPublicPhone(page, label) {
  await expect(page.locator("body")).not.toContainText(
    /392[\s.-]*793[\s.-]*9566|393927939566|whats\s*app|Gaia Brunetti/i,
  );
  passed(label + ": no personal phone, WhatsApp or doctor surname");
}
async function signUpFlow(width) {
  const { context, page, state } = await fixture({ width });
  await page.goto(origin + "/account");
  await page
    .getByLabel("Email account", { exact: true })
    .fill("new-member@example.invalid");
  await page
    .getByLabel("Password account", { exact: true })
    .fill("Test-only-password-42");
  await page.getByRole("button", { name: "Crea account", exact: true }).click();
  await expect(page.getByLabel("Nickname", { exact: true })).toBeFocused();
  expect(state.calls.filter((c) => c.path.endsWith("/signup"))).toHaveLength(0);
  passed(`${width}: signup requires nickname before requesting registration`);
  await page
    .getByLabel("Nickname", { exact: true })
    .fill("  Caffe\u0301 Gaia  ");
  await page.getByRole("button", { name: "Crea account", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Controlla la tua email", exact: true }),
  ).toBeVisible();
  const signup = state.calls.find((c) => c.path.endsWith("/signup"));
  expect(signup.body.data.nickname).toBe("Caffé Gaia");
  expect(signup.body.data).not.toHaveProperty("role");
  expect(
    state.calls.filter((c) => c.path.includes("/functions/v1/newsletter")),
  ).toHaveLength(0);
  passed(
    `${width}: normalized nickname persists in signup metadata before email confirmation; newsletter stays optional`,
  );
  await page.screenshot({
    path: resolve(artifacts, `registration-confirm-${width}.png`),
  });
  await context.close();
}
async function loginFlow() {
  const { context, page, state } = await fixture();
  await page.goto(origin + "/account?mode=login");
  await expect(page.getByLabel("Nickname", { exact: true })).toHaveCount(0);
  await page.getByLabel("Email account", { exact: true }).fill(user.email);
  await page
    .getByRole("button", { name: "Password dimenticata?", exact: true })
    .click();
  await expect(page.getByLabel("Nickname", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "Invia link di recupero", exact: true })
    .click();
  const recover = state.calls.find((c) => c.path.endsWith("/recover"));
  expect(recover.body).not.toHaveProperty("data");
  await page.goto(origin + "/account?mode=login");
  await page.getByLabel("Email account", { exact: true }).fill(user.email);
  await page
    .getByLabel("Password account", { exact: true })
    .fill("Test-only-password-42");
  await page
    .getByRole("button", { name: "Accedi", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Ciao, Beta Gaia.", exact: true }),
  ).toBeVisible();
  const login = state.calls.find((c) => c.path.endsWith("/token"));
  expect(login.body).not.toHaveProperty("data");
  passed("login and recovery omit nickname and never overwrite it");
  await context.close();
}
async function profileFlow(width) {
  const { context, page, state } = await fixture({ width, signed: true });
  await page.goto(origin + "/profile");
  const nickname = page.getByLabel("Nickname del profilo", { exact: true });
  await expect(nickname).toHaveValue("Beta Gaia");
  await expect(
    page.getByRole("checkbox", {
      name: "Condividi il mio percorso con Gaia",
      exact: true,
    }),
  ).not.toBeChecked();
  await nickname.fill("Nuovo Alias");
  await page
    .getByRole("button", { name: "Salva nickname", exact: true })
    .click();
  await expect(
    page.getByText("Nickname aggiornato.", { exact: true }),
  ).toBeVisible();
  const saved = state.calls
    .filter((c) => c.path.endsWith("/set_my_nickname"))
    .at(-1);
  expect(saved.body).toMatchObject({
    nickname: "Nuovo Alias",
    p_expected_user_id: uid,
  });
  passed(
    `${width}: registered member edits an authoritative nickname without changing account identity`,
  );
  state.failNickname = true;
  await nickname.fill("Bozza conservata");
  await page
    .getByRole("button", { name: "Salva nickname", exact: true })
    .click();
  await expect(page.getByText(/Profili non disponibili/)).toBeVisible();
  await expect(nickname).toHaveValue("Bozza conservata");
  expect(state.member.nickname).toBe("Nuovo Alias");
  state.failNickname = false;
  await nickname.fill("Nuovo Alias");
  passed(
    `${width}: failed nickname save preserves draft and actual saved value`,
  );
  await page
    .getByRole("checkbox", {
      name: "Condividi il mio percorso con Gaia",
      exact: true,
    })
    .click();
  await page
    .getByRole("radio", { name: "Scheda: In gravidanza", exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: "Interesse condiviso: Preparazione al parto",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Salva il percorso condiviso", exact: true })
    .click();
  await expect(
    page.getByText("Percorso condiviso aggiornato.", { exact: true }),
  ).toBeVisible();
  const shared = state.calls
    .filter((c) => c.path.endsWith("/save_my_shared_journey"))
    .at(-1).body;
  expect(shared).toMatchObject({
    p_share: true,
    p_journey: "pregnancy",
    p_interests: ["birth_preparation"],
    p_expected_updated_at: stamp,
    p_expected_user_id: uid,
  });
  expect(shared).not.toHaveProperty("date");
  passed(
    `${width}: optional sharing sends only selected coarse fields, owner UUID and exact version`,
  );
  await page
    .getByRole("button", { name: "Ritira subito la condivisione", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: resolve(artifacts, `shared-profile-${width}.png`),
  });
  await page
    .getByRole("button", { name: "Ritira subito la condivisione", exact: true })
    .click();
  await expect(page.getByText(/Condivisione ritirata/)).toBeVisible();
  expect(state.member.journey_shared).toBe(false);
  expect(state.member.shared_journey).toBeNull();
  expect(state.member.shared_interests).toEqual([]);
  passed(`${width}: immediate withdrawal clears shared journey and interests`);
  await page
    .getByRole("checkbox", {
      name: "Condividi il mio percorso con Gaia",
      exact: true,
    })
    .click();
  state.conflict = true;
  await page
    .getByRole("button", { name: "Salva il percorso condiviso", exact: true })
    .click();
  await expect(
    page.getByText(/Il percorso è cambiato da un altro accesso/),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", {
      name: "Condividi il mio percorso con Gaia",
      exact: true,
    }),
  ).toBeChecked();
  expect(state.member.journey_shared).toBe(false);
  await page
    .getByRole("button", { name: "Ricarica la scheda salvata", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Condividi il mio percorso con Gaia",
      exact: true,
    }),
  ).not.toBeChecked();
  passed(
    `${width}: stale draft cannot restore withdrawn consent and reload recovers the latest version`,
  );
  await noOverflow(page, "profile horizontal overflow");
  await noPublicPhone(page, `${width} profile`);
  await page.screenshot({ path: resolve(artifacts, `profile-${width}.png`) });
  await context.close();
}
async function readFailureFlow() {
  const { context, page, state } = await fixture({
    signed: true,
    failRead: true,
  });
  await page.goto(origin + "/profile");
  await expect(
    page.getByRole("button", {
      name: "Riprova caricamento profilo",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Nickname del profilo", { exact: true }),
  ).toHaveCount(0);
  expect(
    state.calls.filter(
      (c) =>
        c.path.endsWith("/set_my_nickname") ||
        c.path.endsWith("/save_my_shared_journey"),
    ),
  ).toHaveLength(0);
  state.failRead = false;
  await page
    .getByRole("button", { name: "Riprova caricamento profilo", exact: true })
    .click();
  await expect(
    page.getByLabel("Nickname del profilo", { exact: true }),
  ).toHaveValue("Beta Gaia");
  passed(
    "failed member read blocks only profile edits and retry restores actual values",
  );
  await context.close();
}
async function directoryFlow(width) {
  const { context, page, state } = await fixture({
    width,
    signed: true,
    editor: true,
    care: true,
  });
  await page.goto(origin + "/iscritti");
  await expect(
    page.getByText("24 iscritti · Pagina 1 di 2", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Stesso Nome", exact: true }),
  ).toHaveCount(2);
  await expect(
    page.getByText("member-00@example.invalid", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("member-01@example.invalid", { exact: true }),
  ).toBeVisible();
  passed(`${width}: duplicate nicknames retain separate email identities`);
  await page
    .getByRole("button", { name: "Pagina successiva", exact: true })
    .click();
  await expect(
    page.getByText("24 iscritti · Pagina 2 di 2", { exact: true }),
  ).toBeVisible();
  const search = page.getByLabel("Cerca iscritti per nickname o email", {
    exact: true,
  });
  await search.fill("Stesso");
  await expect(
    page.getByText("2 iscritti · Pagina 1 di 1", { exact: true }),
  ).toBeVisible();
  await expect(search).toBeFocused();
  passed(
    `${width}: paged nickname search resets the page and retains typing focus`,
  );
  await page
    .getByRole("button", {
      name: "Apri scheda di Stesso Nome · member-00@example.invalid",
      exact: true,
    })
    .click();
  await expect(page.locator("#member-detail-heading")).toHaveText(
    "Stesso Nome",
  );
  await expect(
    page.getByText("Preparazione al parto", { exact: true }),
  ).toBeVisible();
  passed(
    `${width}: care-authorized detail shows only explicitly shared journey topics`,
  );
  state.members[0] = {
    ...state.members[0],
    journey_shared: false,
    shared_journey: null,
    shared_interests: [],
    sharing_updated_at: null,
  };
  await page
    .getByRole("button", { name: "Aggiorna scheda", exact: true })
    .click();
  await expect(
    page.getByText(/La persona non ha scelto di condividere/),
  ).toBeVisible();
  await expect(
    page.getByText("Preparazione al parto", { exact: true }),
  ).toHaveCount(0);
  passed(`${width}: refreshing a card removes a revoked journey`);
  await page.screenshot({
    path: resolve(artifacts, `member-detail-${width}.png`),
  });
  await page
    .getByRole("button", { name: "Torna agli iscritti", exact: true })
    .click();
  await search.fill("");
  await expect(
    page.getByText("24 iscritti · Pagina 1 di 2", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "In gravidanza", exact: true })
    .click();
  await expect(
    page.getByText("11 iscritti · Pagina 1 di 1", { exact: true }),
  ).toBeVisible();
  await noOverflow(page, "directory horizontal overflow");
  await page.screenshot({ path: resolve(artifacts, `members-${width}.png`) });
  passed(`${width}: role-enabled journey filter and layout work`);
  await context.close();
}
async function directoryAccessFlow() {
  let f = await fixture({ signed: true });
  await f.page.goto(origin + "/iscritti");
  await expect(
    f.page.getByText(/Questa area è riservata agli account autorizzati/),
  ).toBeVisible();
  expect(
    f.state.calls.filter((c) => c.path.endsWith("/member_directory")),
  ).toHaveLength(0);
  passed("ordinary members never fetch the professional directory");
  await f.context.close();
  f = await fixture({ signed: true, editor: true });
  await f.page.goto(origin + "/iscritti");
  await expect(
    f.page.getByText("24 iscritti · Pagina 1 di 2", { exact: true }),
  ).toBeVisible();
  await expect(
    f.page.getByRole("button", { name: "In gravidanza", exact: true }),
  ).toHaveCount(0);
  await expect(
    f.page.getByText(
      /I percorsi condivisi richiedono un’abilitazione dedicata/,
    ),
  ).toBeVisible();
  await f.page
    .getByRole("button", {
      name: "Apri scheda di Stesso Nome · member-00@example.invalid",
      exact: true,
    })
    .click();
  await expect(
    f.page.getByText("Preparazione al parto", { exact: true }),
  ).toHaveCount(0);
  passed(
    "editor-only access shows identity without leaking sharing status or health filters",
  );
  await f.context.close();
  f = await fixture({ signed: true, editor: true, care: true, pending: true });
  await f.page.goto(origin + "/iscritti");
  await expect(
    f.page.getByRole("button", {
      name: "Verifica il codice di sicurezza",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    f.page.getByRole("button", { name: "In gravidanza", exact: true }),
  ).toHaveCount(0);
  passed("care membership with pending MFA keeps journeys protected");
  await f.context.close();
}
async function onboardingFlow(width) {
  const { context, page } = await fixture({ width });
  await page.goto(origin + "/welcome");
  await page
    .getByRole("button", { name: "Iniziamo insieme", exact: true })
    .click();
  await page.getByRole("radio", { name: "Mi informo", exact: true }).click();
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await expect(
    page.getByText(/Il percorso generale non usa date/),
  ).toBeVisible();
  await expect(
    page.getByLabel("Data presunta del parto facoltativa", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await page
    .getByRole("button", { name: "Entra in MAIA", exact: true })
    .click();
  await expect(
    page.getByText("Esplora al tuo ritmo", { exact: true }),
  ).toBeVisible();
  passed(
    `${width}: general path stays neutral without dates or gestational estimates`,
  );
  await page.goto(origin + "/welcome?edit=1");
  await page
    .getByRole("radio", { name: "Sono partner o familiare", exact: true })
    .click();
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await page
    .getByRole("button", { name: "Dopo la nascita", exact: true })
    .click();
  await expect(
    page.getByLabel("Data di nascita facoltativa", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await page
    .getByRole("button", { name: "Entra in MAIA", exact: true })
    .click();
  await expect(
    page.getByText("Accanto alla famiglia", { exact: true }),
  ).toBeVisible();
  passed(
    `${width}: partner can choose post-birth support without another person's date`,
  );
  await context.close();
}
async function contactsAndDocuments() {
  const { context, page, state } = await fixture({
    signed: true,
    editor: true,
    care: true,
  });
  await page.goto(origin + "/messaggi");
  await expect(
    page.getByRole("button", { name: /Stesso Nome/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("member-00@example.invalid", { exact: true }).first(),
  ).toBeVisible();
  passed("private conversations render nickname with email secondary");
  await page.goto(origin + "/documenti-studio");
  await page
    .getByRole("button", {
      name: "Gestisci accessi: Materiale di prova",
      exact: true,
    })
    .click();
  const lookup = page.getByLabel("Cerca destinatari per nickname o email", {
    exact: true,
  });
  await lookup.fill("Stesso");
  await page
    .getByRole("button", { name: "Cerca account confermati", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Condividi con Stesso Nome · member-00@example.invalid",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", {
      name: "Condividi con Stesso Nome · member-00@example.invalid",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Salva destinatari", exact: true })
    .click();
  await expect.poll(() => state.recipients).toEqual([memberId(0)]);
  const acl = state.calls
    .filter((c) => c.path.endsWith("/set_document_recipients"))
    .at(-1).body;
  expect(acl.user_ids).toEqual([memberId(0)]);
  expect(acl.user_ids).not.toContain("Stesso Nome");
  passed(
    "document recipient lookup uses nickname labels while grants remain UUID-based",
  );
  await context.close();
}
try {
  for (const width of (process.env.MAIA_MEMBERS_WIDTHS ?? "390,1440")
    .split(",")
    .map(Number)) {
    await signUpFlow(width);
    await profileFlow(width);
    await directoryFlow(width);
    await onboardingFlow(width);
  }
  await loginFlow();
  await readFailureFlow();
  await directoryAccessFlow();
  await contactsAndDocuments();
  expect(errors).toEqual([]);
  expect(unexpected).toEqual([]);
  await writeFile(
    resolve(artifacts, "results.json"),
    JSON.stringify(
      { passed: checks.length, checks, errors, unexpected, production: false },
      null,
      2,
    ),
  );
  await rm(resolve(artifacts, "failure.png"), { force: true });
  await rm(resolve(artifacts, "failure.txt"), { force: true });
  console.log(
    `PASS ${checks.length} browser checks; all external services intercepted.`,
  );
} catch (error) {
  await writeFile(
    resolve(artifacts, "failure.txt"),
    String(error.stack ?? error),
  );
  if (currentPage && !currentPage.isClosed())
    await currentPage
      .screenshot({ path: resolve(artifacts, "failure.png"), fullPage: false })
      .catch(() => {});
  throw error;
} finally {
  await Promise.allSettled(contexts.map((c) => c.close()));
  await browser.close();
  await new Promise((r) => server.close(r));
}
