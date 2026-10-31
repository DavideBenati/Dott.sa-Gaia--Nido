// Bounded regression against the production package. All auth, permissions,
// document metadata and email dispatches are disposable fixtures; no live sends.
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const root = resolve(
  process.argv[2] ?? "/workspace/shared/downloads/maia-v11-3-final",
);
const artifacts = resolve(
  process.env.MAIA_DOCUMENT_NOTIFICATION_ARTIFACTS ??
    "/workspace/shared/downloads/maia-v11-3-document-notification-checks",
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
const stamp = "2026-10-31T10:00:00.000Z";
const manager = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "document-manager@example.invalid",
  manager: true,
};
const patient = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "recipient@example.invalid",
  nickname: "Paziente di prova",
  manager: false,
};
const outsider = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "other-account@example.invalid",
  manager: false,
};
const document = {
  id: "44444444-4444-4444-8444-444444444444",
  owner_id: manager.id,
  title: "Materiale riservato di prova",
  description: "Una descrizione che non deve essere inviata dal browser.",
  file_name: "materiale-di-prova.pdf",
  mime_type: "application/pdf",
  size_bytes: 80,
  storage_path:
    "44444444-4444-4444-8444-444444444444/55555555-5555-4555-8555-555555555555.pdf",
  state: "ready",
  active: true,
  created_at: stamp,
  updated_at: stamp,
  ready_at: stamp,
};
const copy = (value) => JSON.parse(JSON.stringify(value));
const button = (page, name) => page.getByRole("button", { name, exact: true });
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
const dispatches = (state) =>
  state.calls.filter((call) =>
    call.path.endsWith("/functions/v1/document-notify"),
  );
const recipientSaves = (state) =>
  state.calls.filter((call) =>
    call.path.endsWith("/rpc/set_document_recipients"),
  );
async function fixture(width, initialViewer = manager) {
  let viewer = initialViewer;
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    serviceWorkers: "block",
  });
  contexts.push(context);
  const state = {
    doc: copy(document),
    grants: new Set(),
    jobs: [],
    notificationMode: "success",
    calls: [],
    revision: 0,
  };
  function status() {
    const result = {
      pending: 0,
      sending: 0,
      accepted: 0,
      failed: 0,
      cancelled: 0,
      uncertain: 0,
    };
    for (const job of state.jobs) result[job.state]++;
    return result;
  }
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
      "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
    };
    if (request.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    const body = request.headers()["content-type"]?.includes("application/json")
      ? request.postDataJSON()
      : null;
    state.calls.push({ method: request.method(), path: url.pathname, body });
    const json = (value, code = 200) =>
      route.fulfill({
        status: code,
        headers,
        contentType: "application/json",
        body: JSON.stringify(value),
      });
    const rpc = url.pathname.split("/rpc/")[1];
    if (url.pathname.endsWith("/auth/v1/user"))
      return json(
        viewer ? authUser(viewer) : { error: "No session" },
        viewer ? 200 : 401,
      );
    if (url.pathname.endsWith("/auth/v1/token")) {
      if (!viewer)
        viewer = [manager, patient, outsider].find(
          (candidate) => candidate.email === body?.email,
        );
      if (!viewer) return json({ error: "Invalid fixture account" }, 401);
      return json({
        access_token: token(viewer),
        refresh_token: "test-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user: authUser(viewer),
      });
    }
    if (rpc === "is_editor" || rpc === "can_manage_documents")
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
    if (rpc === "document_recipients_v2" || rpc === "document_recipients")
      return json(
        state.grants.has(patient.id)
          ? [
              {
                user_id: patient.id,
                email: patient.email,
                nickname: patient.nickname,
                granted_at: stamp,
              },
            ]
          : [],
      );
    if (rpc === "search_document_users_v2" || rpc === "search_document_users")
      return json([
        {
          user_id: patient.id,
          email: patient.email,
          nickname: patient.nickname,
        },
      ]);
    if (rpc === "set_document_recipients") {
      if (!viewer?.manager) return json({ message: "Forbidden" }, 403);
      if (
        JSON.stringify([...state.grants].sort()) !==
        JSON.stringify([...body.expected_user_ids].sort())
      )
        return json({ code: "40001", message: "Changed" }, 409);
      const next = new Set(body.user_ids);
      for (const id of state.grants)
        if (!next.has(id))
          for (const job of state.jobs)
            if (job.recipient === id && job.state !== "accepted")
              job.state = "cancelled";
      for (const id of next)
        if (!state.grants.has(id))
          state.jobs.push({ recipient: id, state: "pending" });
      state.grants = next;
      state.doc.updated_at = new Date(
        Date.parse(stamp) + ++state.revision,
      ).toISOString();
      return json(null);
    }
    if (rpc === "document_notification_status")
      return viewer?.manager
        ? json(status())
        : json({ message: "Forbidden" }, 403);
    if (url.pathname.endsWith("/functions/v1/document-notify")) {
      if (!viewer?.manager) return json({ message: "Forbidden" }, 403);
      if (state.notificationMode === "failure")
        return json(
          { error: "Servizio temporaneamente non disponibile." },
          503,
        );
      for (const job of state.jobs)
        if (job.state === "pending" && state.grants.has(job.recipient))
          job.state = "accepted";
      return json({
        processed: state.jobs.filter((job) => job.state === "accepted").length,
        accepted: status().accepted,
        retrying: 0,
        cancelled: status().cancelled,
        status: status(),
      });
    }
    if (url.pathname.endsWith("/session_documents")) {
      const allowed =
        viewer?.manager || (viewer && state.grants.has(viewer.id));
      return json(allowed ? [copy(state.doc)] : []);
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
    if (url.pathname.endsWith("/site_profile")) return json(null);
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
    unexpected.push(request.method() + " " + url.pathname);
    return route.abort("blockedbyclient");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  if (viewer) {
    await page.goto(
      `${origin}/documenti-studio#access_token=${token(viewer)}&refresh_token=test-refresh&expires_in=3600&token_type=bearer&type=signup`,
    );
    if (viewer.manager)
      await expect(
        button(page, `Gestisci accessi: ${document.title}`),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("button", { name: "Gestisci account", exact: true }),
      ).toBeVisible();
  }
  return { page, context, state };
}
async function openDocument(page) {
  await button(page, `Gestisci accessi: ${document.title}`).click();
  await expect(
    page.getByRole("heading", {
      name: `Accessi a: ${document.title}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(button(page, "Salva destinatari")).toBeDisabled();
}
async function selectRecipient(page) {
  await page
    .getByLabel("Cerca destinatari per nickname o email", { exact: true })
    .fill("recipient");
  await button(page, "Cerca account confermati").click();
  await page
    .getByRole("checkbox", {
      name: `Condividi con ${patient.nickname} · ${patient.email}`,
      exact: true,
    })
    .check();
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
    const success = await fixture(width);
    const { page, state } = success;
    await openDocument(page);
    await selectRecipient(page);
    await button(page, "Salva destinatari").click();
    await expect.poll(() => dispatches(state).length).toBe(1);
    expect(dispatches(state)[0].body).toEqual({
      action: "dispatch",
      document_id: document.id,
    });
    await expect(
      page.getByText(
        "Accessi salvati per 1 account. Solo questi utenti possono scaricare il file.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect
      .poll(() => state.jobs.filter((job) => job.state === "accepted").length)
      .toBe(1);
    await expect(
      page.getByText("Accettati dal servizio email: 1", { exact: true }),
    ).toBeVisible();
    await noOverflow(page);
    passed(
      `${width}px: assigning a new recipient automatically dispatches only its document ID and keeps provider acceptance distinct from delivery`,
    );

    await button(page, "Torna all’elenco documenti").click();
    await openDocument(page);
    await expect(button(page, "Salva destinatari")).toBeDisabled();
    const accepted = page.getByText("Accettati dal servizio email: 1", {
      exact: true,
    });
    await expect(accepted).toBeVisible();
    await accepted.scrollIntoViewIfNeeded();
    expect(dispatches(state)).toHaveLength(1);
    expect(recipientSaves(state)).toHaveLength(1);
    await page.screenshot({
      path: resolve(artifacts, `email-status-${width}.png`),
    });
    passed(
      `${width}px: reopening a document reads persisted notification state and an unchanged recipient selection cannot resend`,
    );

    await button(
      page,
      `Rimuovi ${patient.nickname} · ${patient.email}`,
    ).click();
    await button(page, "Salva destinatari").click();
    await expect.poll(() => state.grants.size).toBe(0);
    await expect(
      page.getByText(
        "Accessi salvati per 0 account. Solo questi utenti possono scaricare il file.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(dispatches(state)).toHaveLength(1);
    passed(
      `${width}px: revoking a recipient does not dispatch a new sharing email`,
    );
    await success.context.close();

    const failed = await fixture(width);
    failed.state.notificationMode = "failure";
    await openDocument(failed.page);
    await selectRecipient(failed.page);
    await button(failed.page, "Salva destinatari").click();
    await expect.poll(() => dispatches(failed.state).length).toBe(1);
    await expect(
      failed.page.getByText(
        "Accessi salvati per 1 account. Solo questi utenti possono scaricare il file.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(failed.state.grants.has(patient.id)).toBe(true);
    expect(failed.state.jobs).toHaveLength(1);
    expect(failed.state.jobs[0].state).toBe("pending");
    await expect(
      failed.page.getByText("In attesa: 1", { exact: true }),
    ).toBeVisible();
    await expect(
      failed.page.getByText(
        "Gli accessi sono salvati. L’invio email non è ancora confermato: controlla lo stato degli avvisi.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      failed.page.getByText(/Destinatari non salvati/, { exact: false }),
    ).toHaveCount(0);
    failed.state.notificationMode = "success";
    await button(failed.page, "Riprova invio avvisi").click();
    await expect.poll(() => dispatches(failed.state).length).toBe(2);
    expect(dispatches(failed.state)[1].body).toEqual({
      action: "retry",
      document_id: document.id,
    });
    await expect.poll(() => failed.state.jobs[0].state).toBe("accepted");
    await expect(
      failed.page.getByText("Accettati dal servizio email: 1", { exact: true }),
    ).toBeVisible();
    expect(failed.state.jobs).toHaveLength(1);
    await noOverflow(failed.page);
    await failed.page.screenshot({
      path: resolve(artifacts, `email-retry-${width}.png`),
    });
    passed(
      `${width}px: email failure preserves saved grants and pending work; retry processes the existing job`,
    );
    await failed.context.close();
  }
  const guest = await fixture(390, null);
  await guest.page.goto(origin + "/miei-documenti");
  await expect(button(guest.page, "Accedi ai miei documenti")).toBeVisible();
  await expect(
    guest.page.getByText(document.title, { exact: true }),
  ).toHaveCount(0);
  expect(dispatches(guest.state)).toHaveLength(0);
  await button(guest.page, "Accedi ai miei documenti").click();
  await expect
    .poll(() => new URL(guest.page.url()).searchParams.get("returnTo"))
    .toBe("documents");
  await guest.page
    .getByLabel("Email account", { exact: true })
    .fill(outsider.email);
  await guest.page
    .getByLabel("Password account", { exact: true })
    .fill("Password-di-prova-123");
  await button(guest.page, "Accedi").click();
  await expect
    .poll(() => new URL(guest.page.url()).pathname)
    .toBe("/miei-documenti");
  await expect(
    guest.page.getByText(
      "Gaia non ha ancora condiviso materiali con questo account. Quando lo farà, li ritroverai qui.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  passed(
    "390px: the email's private-folder entry requires sign-in and returns a completed account to its own documents",
  );
  await guest.context.close();
  const unrelated = await fixture(390, outsider);
  await unrelated.page.goto(origin + "/miei-documenti");
  await expect(
    unrelated.page.getByText(
      "Gaia non ha ancora condiviso materiali con questo account. Quando lo farà, li ritroverai qui.",
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await expect(
    unrelated.page.getByText(document.title, { exact: true }),
  ).toHaveCount(0);
  expect(dispatches(unrelated.state)).toHaveLength(0);
  passed(
    "390px: an unrelated authenticated patient sees no unassigned document or email controls",
  );
  await unrelated.context.close();
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
