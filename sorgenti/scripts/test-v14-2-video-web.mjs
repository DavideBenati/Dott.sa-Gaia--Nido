// Production-build regression: all Supabase/Hostpoint traffic is simulated.
// No real email, patient record or video meeting is created by this script.
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const root = resolve(process.argv[2] ?? "apps/mobile/dist-web");
const port = Number(process.env.MAIA_VIDEO_PORT ?? 8142);
const origin = `http://127.0.0.1:${port}`;
const artifacts = resolve(
  process.env.MAIA_VIDEO_ARTIFACTS ??
    "/workspace/shared/downloads/maia-v14-2-video-checks",
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
const contexts = [],
  checks = [],
  errors = [],
  unexpected = [];
let currentPage;
const uid = "11111111-1111-4111-8111-111111111111";
const recipientId = "22222222-2222-4222-8222-222222222222";
const invitationId = "33333333-3333-4333-8333-333333333333";
const otherInvitationId = "44444444-4444-4444-8444-444444444444";
const absentInvitationId = "55555555-5555-4555-8555-555555555555";
const room = "https://meet.hostpoint.ch/beta-random-room-938473";
const privateLink = `https://metimaia.com/videochiamate?invito=${invitationId}`;
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
function invitation(id = invitationId) {
  return {
    id,
    recipient_id: recipientId,
    nickname: "Cliente Beta",
    email: "cliente-beta@example.invalid",
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  };
}
function passed(label) {
  checks.push(label);
  console.log("PASS " + label);
}
async function fixture({
  width = 390,
  signed = false,
  admin = false,
  invited = false,
  second = false,
  initialEmailStatus = "not_sent",
} = {}) {
  const context = await browser.newContext({
    viewport: { width, height: width > 900 ? 1000 : 844 },
    serviceWorkers: "block",
  });
  contexts.push(context);
  await context.addInitScript(() => {
    window.__copied = [];
    window.__clipboardFails = false;
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          if (window.__clipboardFails) throw new Error("Clipboard denied");
          window.__copied.push(text);
        },
      },
    });
  });
  const state = {
    signed,
    calls: [],
    meetings: [],
    invitations: invited
      ? [invitation(), ...(second ? [invitation(otherInvitationId)] : [])]
      : [],
    emailStatus: initialEmailStatus,
    emailMode: "accepted",
    gate: null,
  };
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    if (url.hostname === "meet.hostpoint.ch" && request.isNavigationRequest()) {
      state.meetings.push(url.href);
      return route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Meeting mock</title><p>Meeting mock, no external service contacted.</p>",
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
        state.signed ? user : { error: "Not signed in" },
        state.signed ? 200 : 401,
      );
    if (url.pathname.endsWith("/auth/v1/token")) {
      state.signed = true;
      return json({
        access_token: token(),
        refresh_token: "test-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user,
      });
    }
    if (rpc === "is_editor") return json(admin);
    if (rpc === "professional_access_status")
      return json({
        editor: admin,
        chat: false,
        mfa_required: false,
        mfa_satisfied: true,
      });
    if (rpc === "document_access_status")
      return json({
        membership: false,
        documents_mfa_required: false,
        can_manage: false,
        mfa_satisfied: true,
      });
    if (rpc === "care_chat_available" || rpc === "is_chat_staff")
      return json(false);
    if (rpc === "my_member_profile")
      return json({
        nickname: "Beta",
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
    if (rpc === "search_video_call_users")
      return json([
        {
          user_id: recipientId,
          nickname: "Cliente Beta",
          email: "cliente-beta@example.invalid",
        },
      ]);
    if (rpc === "list_video_call_invitations") return json(state.invitations);
    if (rpc === "list_video_call_email_status")
      return json(
        body.p_invitation_ids.map((id) => ({
          invitation_id: id,
          status: state.emailStatus,
          accepted_at: state.emailStatus === "accepted" ? stamp : null,
        })),
      );
    if (rpc === "create_video_call_invitation") {
      state.invitations = [invitation()];
      state.emailStatus = "not_sent";
      return json(invitationId);
    }
    if (rpc === "revoke_video_call_invitation") {
      state.invitations = state.invitations.filter(
        (item) => item.id !== body.p_invitation_id,
      );
      return json(null);
    }
    if (rpc === "open_video_call_invitation") return json(room);
    if (url.pathname.endsWith("/functions/v1/video-call-invite")) {
      if (!admin) return json({ error: "Forbidden" }, 403);
      if (state.gate) await state.gate;
      if (state.emailMode === "network") return route.abort("connectionfailed");
      if (state.emailMode === "unconfigured")
        return json({ error: "Servizio email da configurare." }, 503);
      state.emailStatus = state.emailMode;
      return json({
        status: state.emailMode,
        accepted_at: state.emailMode === "accepted" ? stamp : null,
      });
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
    if (url.pathname.endsWith("/session_document_access"))
      return route.fulfill({
        headers: { ...headers, "Content-Range": "*/0" },
        contentType: "application/json",
        body: "[]",
      });
    if (
      url.pathname.endsWith("/site_profile") ||
      url.pathname.includes("notification_preferences")
    )
      return json(null);
    if (
      [
        "articles",
        "checklists",
        "article_categories",
        "user_favorites",
        "checklist_progress",
        "shop_settings",
        "shop_products",
      ].some((name) => url.pathname.endsWith("/" + name))
    )
      return json([]);
    unexpected.push({ method: request.method(), path: url.pathname });
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  currentPage = page;
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  if (signed) {
    await page.goto(
      `${origin}/profile#access_token=${token()}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`,
    );
    await expect(
      page.getByRole("button", { name: "Gestisci account", exact: true }),
    ).toBeVisible();
  }
  return { page, state };
}
const count = (state, suffix) =>
  state.calls.filter((call) => call.path.endsWith(suffix)).length;
async function noOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}
async function enterWorkspace(page) {
  currentPage = page;
  await page.goto(`${origin}/videochiamate`);
  await expect(
    page.getByLabel("Cerca destinatario videochiamata", { exact: true }),
  ).toBeVisible();
}
try {
  for (const width of [390, 1440]) {
    const { page, state } = await fixture({ width });
    await page.goto(`${origin}/videochiamate?invito=${invitationId}`);
    await expect(
      page.getByRole("button", { name: "Accedi", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Entra nella videochiamata",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(
      "cliente-beta@example.invalid",
    );
    expect(count(state, "/list_video_call_invitations")).toBe(0);
    await noOverflow(page);
    passed(
      `${width}px guest invitation link requires login and exposes no private recipient or room`,
    );
  }

  const { page: login, state: loginState } = await fixture({
    invited: true,
    second: true,
  });
  await login.goto(`${origin}/videochiamate?invito=${invitationId}`);
  await login.getByRole("button", { name: "Accedi", exact: true }).click();
  await login.getByLabel("Email account", { exact: true }).fill(user.email);
  await login
    .getByLabel("Password account", { exact: true })
    .fill("Fixture-password-123");
  await login.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(login).toHaveURL(
    `${origin}/videochiamate?invito=${invitationId}`,
  );
  await expect(
    login.getByRole("button", {
      name: "Entra nella videochiamata",
      exact: true,
    }),
  ).toHaveCount(1);
  expect(count(loginState, "/auth/v1/token")).toBe(1);
  passed(
    "A guest signs in from an email link and returns to the exact requested invitation even with two active meetings",
  );

  const { page: studio, state: studioState } = await fixture({
    signed: true,
    admin: true,
  });
  await enterWorkspace(studio);
  await studio
    .getByLabel("Cerca destinatario videochiamata", { exact: true })
    .fill("Beta");
  await studio
    .getByRole("button", { name: "Scegli questo account", exact: true })
    .click();
  await studio
    .getByRole("button", { name: "Prepara link della stanza", exact: true })
    .click();
  const generated = await studio
    .getByLabel("Link della stanza Hostpoint", { exact: true })
    .inputValue();
  expect(generated).toMatch(
    /^https:\/\/meet\.hostpoint\.ch\/[A-Za-z0-9_-]{8,200}$/,
  );
  expect(generated).not.toMatch(/beta|cliente|example/i);
  await studio
    .getByRole("button", { name: "Salva videochiamata", exact: true })
    .click();
  await expect(
    studio.getByRole("button", { name: "Invia invito", exact: true }),
  ).toBeVisible();
  const created = studioState.calls.find((call) =>
    call.path.endsWith("/create_video_call_invitation"),
  );
  expect(created.body).toEqual({
    p_recipient_id: recipientId,
    p_room_url: generated,
    p_expected_user_id: uid,
  });
  expect(count(studioState, "/video-call-invite")).toBe(0);
  await noOverflow(studio);
  passed(
    "Studio prepares a private random room link and saves UUID-scoped invitation without automatic email",
  );
  await studio.screenshot({
    path: `${artifacts}/videochiamate-studio-prima-invio.png`,
    fullPage: true,
  });

  let releaseSend;
  studioState.gate = new Promise((resolveSend) => {
    releaseSend = resolveSend;
  });
  const send = studio.getByRole("button", {
    name: "Invia invito",
    exact: true,
  });
  await expect(send).toBeEnabled();
  await send.evaluate((element) => {
    element.click();
    element.click();
  });
  await expect.poll(() => count(studioState, "/video-call-invite")).toBe(1);
  releaseSend();
  studioState.gate = null;
  await expect(studio.locator("body")).toContainText(
    /affidato al servizio email/i,
  );
  expect(
    studioState.calls.find((call) => call.path.endsWith("/video-call-invite"))
      .body,
  ).toEqual({ invitation_id: invitationId });
  expect(count(studioState, "/video-call-invite")).toBe(1);
  passed(
    "A deliberate double click dispatches one invitation containing only its ID and reports provider acceptance",
  );
  await studio.reload();
  await expect(studio.locator("body")).toContainText(
    /affidato al servizio email/i,
  );
  await expect(
    studio.getByRole("button", { name: "Invia invito", exact: true }),
  ).toHaveCount(0);
  await expect(
    studio.getByRole("button", {
      name: "Invito già inviato al servizio email",
      exact: true,
    }),
  ).toBeDisabled();
  expect(count(studioState, "/video-call-invite")).toBe(1);
  passed(
    "Accepted email status survives a reload and offers no duplicate send",
  );

  await studio.getByRole("button", { name: "Copia link", exact: true }).click();
  expect(await studio.evaluate(() => window.__copied)).toEqual([privateLink]);
  await studio.evaluate(() => {
    window.__clipboardFails = true;
  });
  await studio.getByRole("button", { name: "Copia link", exact: true }).click();
  await expect(studio.getByText(privateLink, { exact: true })).toBeVisible();
  passed(
    "Copy forwards the protected invitation URL; clipboard denial exposes selectable text",
  );

  await studio
    .getByRole("button", { name: "Revoca questo invito", exact: true })
    .click();
  expect(count(studioState, "/revoke_video_call_invitation")).toBe(0);
  await studio
    .getByRole("button", { name: "Conferma revoca", exact: true })
    .click();
  await expect
    .poll(() => count(studioState, "/revoke_video_call_invitation"))
    .toBe(1);
  await expect(
    studio.getByRole("button", {
      name: "Entra nella videochiamata",
      exact: true,
    }),
  ).toHaveCount(0);
  passed(
    "Revocation requires explicit confirmation before removing the private invitation",
  );

  const { page: failed, state: failedState } = await fixture({
    signed: true,
    admin: true,
    invited: true,
  });
  await enterWorkspace(failed);
  failedState.emailMode = "network";
  await failed
    .getByRole("button", { name: "Invia invito", exact: true })
    .click();
  await expect(failed.locator("body")).toContainText(
    /non.*confermat|non.*verificat|esito.*verific|controlla.*stato/i,
  );
  await expect(failed.locator("body")).not.toContainText(
    /email inviata|email consegnata/i,
  );
  expect(failedState.invitations).toHaveLength(1);
  failedState.emailStatus = "accepted";
  await failed
    .getByRole("button", { name: "Aggiorna inviti", exact: true })
    .click();
  await expect(failed.locator("body")).toContainText(
    /affidato al servizio email/i,
  );
  expect(count(failedState, "/video-call-invite")).toBe(1);
  passed(
    "A network failure preserves the saved call and requires status verification instead of claiming email success",
  );

  const { page: unavailable, state: unavailableState } = await fixture({
    signed: true,
    admin: true,
    invited: true,
  });
  await enterWorkspace(unavailable);
  unavailableState.emailMode = "unconfigured";
  await unavailable
    .getByRole("button", { name: "Invia invito", exact: true })
    .click();
  await expect(unavailable.locator("body")).toContainText(
    /configurar|non.*confermat|non.*verificat|controlla.*stato/i,
  );
  await expect(
    unavailable.getByRole("button", { name: "Copia link", exact: true }),
  ).toBeVisible();
  expect(unavailableState.invitations).toHaveLength(1);
  passed(
    "Missing email configuration leaves the invitation usable and copyable without false delivery confirmation",
  );

  const { page: member, state: memberState } = await fixture({
    signed: true,
    invited: true,
    second: true,
  });
  currentPage = member;
  await member.goto(`${origin}/videochiamate?invito=${invitationId}`);
  await expect(
    member.getByRole("button", {
      name: "Entra nella videochiamata",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    member.getByLabel("Cerca destinatario videochiamata", { exact: true }),
  ).toHaveCount(0);
  await expect(
    member.getByRole("button", { name: "Invia invito", exact: true }),
  ).toHaveCount(0);
  expect(count(memberState, "/list_video_call_email_status")).toBe(0);
  await noOverflow(member);
  await member.screenshot({
    path: `${artifacts}/videochiamata-paziente.png`,
    fullPage: true,
  });
  passed(
    "A patient email link isolates the requested invitation and exposes no staff or email controls",
  );
  await member
    .getByRole("button", { name: "Entra nella videochiamata", exact: true })
    .click();
  await expect.poll(() => memberState.meetings).toEqual([room]);
  expect(
    memberState.calls.find((call) =>
      call.path.endsWith("/open_video_call_invitation"),
    ).body,
  ).toEqual({ p_invitation_id: invitationId, p_expected_user_id: uid });
  passed(
    "Entering a call reauthorizes the exact invitation before same-tab navigation to the mocked provider",
  );
  await member.goto(`${origin}/videochiamate?invito=${absentInvitationId}`);
  await expect(
    member.getByRole("button", {
      name: "Entra nella videochiamata",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(member.locator("body")).toContainText(
    /invito.*non.*disponibile|invito.*scadut|invito.*non.*trovat/i,
  );
  passed(
    "An unavailable targeted invitation never substitutes another available meeting",
  );

  const { page: desktop } = await fixture({
    width: 1440,
    signed: true,
    admin: true,
    invited: true,
  });
  await enterWorkspace(desktop);
  await noOverflow(desktop);
  await desktop.screenshot({
    path: `${artifacts}/videochiamate-desktop.png`,
    fullPage: true,
  });
  passed("The staff workflow fits desktop without horizontal overflow");
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
