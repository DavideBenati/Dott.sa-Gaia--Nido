// Static-build UI regression. All Supabase APIs and storage are simulated;
// unknown external requests fail closed. No account, file or real data is sent.
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const root = resolve(process.argv[2] ?? "apps/mobile/dist-web");
const origin = "http://127.0.0.1:8097";
const artifacts = process.env.MAIA_DOCUMENT_ARTIFACTS
  ? resolve(process.env.MAIA_DOCUMENT_ARTIFACTS)
  : null;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};
const server = createServer(async (request, response) => {
  try {
    let path = resolve(
      root,
      "." + decodeURIComponent(new URL(request.url, origin).pathname),
    );
    if (path !== root && !path.startsWith(root + "/")) {
      response.writeHead(403).end();
      return;
    }
    if (path === root) path += "/index.html";
    try {
      if (!(await stat(path)).isFile()) throw new Error("Not a file");
    } catch {
      path += ".html";
    }
    response.setHeader(
      "Content-Type",
      types[extname(path)] ?? "application/octet-stream",
    );
    response.end(await readFile(path));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((ready) => server.listen(8097, "127.0.0.1", ready));
if (artifacts) await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const pdf = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type /Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);
const mime = "application/pdf";
const manager = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "manager-beta@example.invalid",
  editor: true,
  membership: true,
  can_manage: true,
  aal: "aal2",
};
const alice = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "alice-beta@example.invalid",
  editor: false,
  membership: false,
  can_manage: false,
  aal: "aal1",
};
const bob = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "bob-beta@example.invalid",
  editor: false,
  membership: false,
  can_manage: false,
  aal: "aal1",
};
const noDocumentsEditor = {
  id: "44444444-4444-4444-8444-444444444444",
  email: "editor-beta@example.invalid",
  editor: true,
  membership: false,
  can_manage: false,
  aal: "aal1",
};
const pendingMfa = {
  ...manager,
  id: "55555555-5555-4555-8555-555555555555",
  email: "mfa-beta@example.invalid",
  can_manage: false,
  aal: "aal1",
};
const now = Math.floor(Date.now() / 1000);
const calls = [];
const unexpected = [];
const results = [];
const contexts = [];
let currentPage;
let serial = 0;
const at = new Date().toISOString();
const other = {
  id: "77777777-7777-4777-8777-777777777777",
  owner_id: manager.id,
  title: "Documento di un altro account",
  description: "Materiale fittizio non assegnato ai due utenti di prova",
  file_name: "altro-materiale.pdf",
  mime_type: mime,
  size_bytes: pdf.length,
  storage_path: "77777777-7777-4777-8777-777777777777/altro.pdf",
  state: "ready",
  active: true,
  created_at: at,
  updated_at: at,
  ready_at: at,
};
const documents = new Map([[other.id, other]]);
const grants = new Map([
  [other.id, new Set(["88888888-8888-4888-8888-888888888888"])],
]);
const uploaded = new Set([other.id]);
function token(viewer) {
  return (
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(
      JSON.stringify({
        sub: viewer.id,
        aud: "authenticated",
        role: "authenticated",
        aal: viewer.aal,
        exp: now + 3600,
        iat: now,
      }),
    ).toString("base64url") +
    ".test-only-not-a-valid-signature"
  );
}
function authUser(viewer) {
  return {
    id: viewer.id,
    aud: "authenticated",
    role: "authenticated",
    email: viewer.email,
    email_confirmed_at: at,
    created_at: at,
    app_metadata: {},
    user_metadata: {},
    identities: [],
  };
}
const copy = (value) => JSON.parse(JSON.stringify(value));
async function newPage(viewer = null, width = 390) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    serviceWorkers: "block",
    acceptDownloads: true,
  });
  contexts.push(context);
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === origin) {
      await route.continue();
      return;
    }
    if (!url.hostname.endsWith(".supabase.co")) {
      unexpected.push({
        method: request.method(),
        url: url.origin + url.pathname,
      });
      await route.abort("blockedbyclient");
      return;
    }
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,PATCH,PUT,DELETE,OPTIONS",
      "Access-Control-Expose-Headers": "Content-Disposition",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    let body = null;
    if (request.headers()["content-type"]?.includes("application/json"))
      body = request.postDataJSON();
    calls.push({
      actor: viewer?.id ?? "guest",
      method: request.method(),
      path: url.pathname,
      query: url.search,
      body,
    });
    const json = async (data, status = 200) =>
      route.fulfill({
        status,
        headers,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    const canManage = Boolean(viewer?.can_manage);
    if (url.pathname.endsWith("/auth/v1/user")) {
      await json(
        viewer ? authUser(viewer) : { error: "No user" },
        viewer ? 200 : 401,
      );
      return;
    }
    if (url.pathname.endsWith("/rpc/is_editor")) {
      await json(Boolean(viewer?.editor));
      return;
    }
    if (url.pathname.endsWith("/rpc/professional_access_status")) {
      await json({
        editor: Boolean(viewer?.editor),
        chat: false,
        mfa_required: false,
        mfa_satisfied: viewer?.aal === "aal2",
      });
      return;
    }
    if (url.pathname.endsWith("/rpc/document_access_status")) {
      await json({
        membership: Boolean(viewer?.membership),
        documents_mfa_required: Boolean(viewer?.membership),
        can_manage: canManage,
        mfa_satisfied: viewer?.aal === "aal2",
      });
      return;
    }
    if (url.pathname.endsWith("/session_documents")) {
      if (request.method() !== "GET") {
        unexpected.push({ path: url.pathname, method: request.method() });
        await json({ error: "Unexpected write" }, 405);
        return;
      }
      const offset = Number(url.searchParams.get("offset") ?? 0),
        limit = Number(url.searchParams.get("limit") ?? 20);
      const list = [...documents.values()]
        .filter(
          (doc) =>
            canManage ||
            (viewer &&
              doc.state === "ready" &&
              doc.active &&
              grants.get(doc.id)?.has(viewer.id)),
        )
        .slice(offset, offset + limit);
      await json(copy(list));
      return;
    }
    if (url.pathname.endsWith("/functions/v1/document-file")) {
      const doc = documents.get(body?.document_id);
      const validAuth =
        viewer && request.headers().authorization === `Bearer ${token(viewer)}`;
      const allowed =
        validAuth &&
        body?.action === "download" &&
        doc?.state === "ready" &&
        (canManage || (doc.active && grants.get(doc.id)?.has(viewer.id)));
      if (!allowed) {
        await json({ error: "Document not found" }, 404);
        return;
      }
      await route.fulfill({
        status: 200,
        headers: {
          ...headers,
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="${doc.file_name}"`,
        },
        contentType: doc.mime_type,
        body: pdf,
      });
      return;
    }
    if (url.pathname.endsWith("/rpc/prepare_document")) {
      if (!canManage) {
        await json({ error: "Forbidden" }, 403);
        return;
      }
      const id = `66666666-6666-4666-8666-${String(++serial).padStart(12, "0")}`;
      const doc = {
        id,
        owner_id: viewer.id,
        title: body.document_title,
        description: body.document_description,
        file_name: body.document_name,
        mime_type: body.document_mime,
        size_bytes: body.document_size,
        storage_path: `${id}/materiale.pdf`,
        state: "uploading",
        active: false,
        created_at: at,
        updated_at: at,
        ready_at: null,
      };
      documents.set(id, doc);
      grants.set(id, new Set());
      await json(copy(doc));
      return;
    }
    if (url.pathname.includes("/storage/v1/object/session-documents/")) {
      const doc = [...documents.values()].find((d) =>
        url.pathname.endsWith("/" + d.storage_path),
      );
      if (!canManage || !doc || doc.state !== "uploading") {
        await json({ error: "Forbidden" }, 403);
        return;
      }
      uploaded.add(doc.id);
      await json({ Key: `session-documents/${doc.storage_path}`, Id: doc.id });
      return;
    }
    if (url.pathname.endsWith("/rpc/complete_document")) {
      const doc = documents.get(body.document_id);
      if (!canManage || !doc || !uploaded.has(doc.id)) {
        await json({ error: "Not ready" }, 403);
        return;
      }
      Object.assign(doc, { state: "ready", active: true, ready_at: at });
      await json([copy(doc)]);
      return;
    }
    if (url.pathname.endsWith("/rpc/abort_document")) {
      if (!canManage) {
        await json({ error: "Forbidden" }, 403);
        return;
      }
      const doc = documents.get(body.document_id);
      if (doc) Object.assign(doc, { state: "failed", active: false });
      await json(null);
      return;
    }
    if (url.pathname.endsWith("/rpc/document_recipients")) {
      if (!canManage) {
        await json({ error: "Forbidden" }, 403);
        return;
      }
      await json(
        [alice, bob]
          .filter((user) => grants.get(body.document_id)?.has(user.id))
          .map((user) => ({
            user_id: user.id,
            email: user.email,
            granted_at: at,
          })),
      );
      return;
    }
    if (url.pathname.endsWith("/rpc/search_document_users")) {
      if (!canManage) {
        await json({ error: "Forbidden" }, 403);
        return;
      }
      await json(
        body.search_term.trim().length < 3
          ? []
          : [alice, bob]
              .filter((user) =>
                user.email.includes(body.search_term.trim().toLowerCase()),
              )
              .map((user) => ({ user_id: user.id, email: user.email })),
      );
      return;
    }
    if (url.pathname.endsWith("/rpc/set_document_recipients")) {
      const doc = documents.get(body.document_id);
      if (!canManage || !doc?.active) {
        await json({ error: "Forbidden" }, 403);
        return;
      }
      grants.set(doc.id, new Set(body.user_ids));
      await json(null);
      return;
    }
    if (url.pathname.endsWith("/rpc/update_document")) {
      const doc = documents.get(body.document_id);
      if (!canManage || !doc) {
        await json({ error: "Forbidden" }, 403);
        return;
      }
      Object.assign(doc, {
        title: body.document_title,
        description: body.document_description,
        active: body.document_active,
      });
      if (!doc.active) grants.set(doc.id, new Set());
      await json(doc.active ? copy(doc) : [copy(doc)]);
      return;
    }
    if (
      url.pathname.includes("/functions/v1/") ||
      !["GET", "HEAD"].includes(request.method())
    ) {
      unexpected.push({ method: request.method(), path: url.pathname });
      await json({ error: "Unexpected request blocked" }, 400);
      return;
    }
    if (
      url.pathname.includes("user_preferences") ||
      url.pathname.includes("notification_preferences") ||
      url.pathname.endsWith("/site_profile")
    ) {
      await json(null);
      return;
    }
    if (url.pathname.includes("care_chat_available")) {
      await json(false);
      return;
    }
    await json([]);
  });
  const page = await context.newPage();
  currentPage = page;
  page.on("pageerror", (error) =>
    unexpected.push({ pageerror: error.message, actor: viewer?.id ?? "guest" }),
  );
  if (viewer) {
    await page.goto(
      `${origin}/account#access_token=${token(viewer)}&refresh_token=test-only-refresh&expires_in=3600&token_type=bearer&type=signup`,
    );
    await expect(page.getByText(viewer.email, { exact: true })).toBeVisible();
  }
  return page;
}
async function screenshot(page, name) {
  if (artifacts)
    await page.screenshot({ path: resolve(artifacts, name + ".png") });
}
const callCount = (viewer, suffix) =>
  calls.filter((c) => c.actor === viewer.id && c.path.endsWith(suffix)).length;
async function chooseFile(page, name, buffer) {
  const chosen = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Scegli PDF, Word o PowerPoint", exact: true })
    .click();
  const chooser = await chosen;
  expect(await chooser.element().getAttribute("accept")).toBe(
    ".pdf,.docx,.pptx",
  );
  await chooser.setFiles({ name, mimeType: "application/pdf", buffer });
}
async function search(page, term) {
  await page
    .getByLabel("Cerca destinatari per email", { exact: true })
    .fill(term);
  await page
    .getByRole("button", { name: "Cerca account confermati", exact: true })
    .click();
}
async function save(page, count) {
  await page
    .getByRole("button", { name: "Salva destinatari", exact: true })
    .click();
  await expect(
    page.getByText(
      `Accessi salvati per ${count} account. Solo questi utenti possono scaricare il file.`,
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByText(`Destinatari selezionati: ${count}`, { exact: true }),
  ).toBeVisible();
}

try {
  const guest = await newPage();
  await guest.goto(origin + "/documenti-studio");
  await expect(
    guest.getByText("Accedi con l’account professionale autorizzato.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    guest.getByLabel("Titolo del documento", { exact: true }),
  ).toHaveCount(0);
  await guest.goto(origin + "/miei-documenti");
  await expect(
    guest.getByRole("button", {
      name: "Accedi ai miei documenti",
      exact: true,
    }),
  ).toBeVisible();
  results.push("Guest denied; no upload/search controls.");
  for (const viewer of [alice, noDocumentsEditor]) {
    const page = await newPage(viewer);
    await page.goto(origin + "/documenti-studio");
    await expect(
      page.getByText(
        /Questo account non è abilitato alla gestione dei documenti riservati/,
      ),
    ).toBeVisible();
    await expect(
      page.getByLabel("Titolo del documento", { exact: true }),
    ).toHaveCount(0);
    expect(callCount(viewer, "/rpc/search_document_users")).toBe(0);
    expect(callCount(viewer, "/rpc/prepare_document")).toBe(0);
  }
  results.push(
    "Normal account and editor without document membership denied without user search/upload.",
  );
  const mfa = await newPage(pendingMfa);
  await mfa.goto(origin + "/documenti-studio");
  await expect(
    mfa.getByRole("button", {
      name: "Verifica il codice a due fattori",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    mfa.getByLabel("Titolo del documento", { exact: true }),
  ).toHaveCount(0);
  results.push("Document member at AAL1 receives MFA CTA; upload unavailable.");
  const manage = await newPage(manager);
  await manage.goto(origin + "/documenti-studio");
  await manage
    .getByLabel("Titolo del documento", { exact: true })
    .fill("Materiale riservato beta");
  await manage
    .getByLabel("Descrizione del documento", { exact: true })
    .fill("Documento fittizio per una prova senza dati reali.");
  await chooseFile(manage, "non-valido.pdf", Buffer.from("Not a PDF"));
  await manage
    .getByRole("button", { name: "Carica in area privata", exact: true })
    .click();
  await expect(
    manage.getByText(/Il formato del file non è riconosciuto/),
  ).toBeVisible();
  expect(callCount(manager, "/rpc/prepare_document")).toBe(0);
  await chooseFile(manage, "allegato-beta.pdf", pdf);
  await manage
    .getByRole("button", { name: "Carica in area privata", exact: true })
    .click();
  await expect(
    manage.getByText(
      "File caricato in area privata. Seleziona i destinatari e salva per condividerlo.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    manage.getByText("Nessun destinatario selezionato.", { exact: true }),
  ).toBeVisible();
  const uploadedDoc = [...documents.values()].find(
    (d) => d.title === "Materiale riservato beta",
  );
  expect(uploadedDoc?.state).toBe("ready");
  expect(grants.get(uploadedDoc.id).size).toBe(0);
  expect(callCount(manager, "/rpc/set_document_recipients")).toBe(0);
  results.push(
    "Invalid PDF rejected before preparation; valid PDF upload has no automatic grants. Object/array RPC normalization exercised.",
  );
  await manage
    .getByLabel("Cerca destinatari per email", { exact: true })
    .fill("al");
  await expect(
    manage.getByRole("button", {
      name: "Cerca account confermati",
      exact: true,
    }),
  ).toBeDisabled();
  expect(callCount(manager, "/rpc/search_document_users")).toBe(0);
  await search(manage, "beta");
  await expect(
    manage.getByRole("checkbox", {
      name: `Condividi con ${alice.email}`,
      exact: true,
    }),
  ).toBeVisible();
  await manage
    .getByRole("checkbox", {
      name: `Condividi con ${alice.email}`,
      exact: true,
    })
    .click();
  await manage
    .getByRole("checkbox", { name: `Condividi con ${bob.email}`, exact: true })
    .click();
  expect(grants.get(uploadedDoc.id).size).toBe(0);
  await save(manage, 2);
  expect([...grants.get(uploadedDoc.id)].sort()).toEqual(
    [alice.id, bob.id].sort(),
  );
  await manage
    .getByRole("button", { name: `Rimuovi ${bob.email}`, exact: true })
    .click();
  await save(manage, 1);
  expect([...grants.get(uploadedDoc.id)]).toEqual([alice.id]);
  results.push(
    "Minimum search length, explicit selection/save for two accounts and persistence of a subsequent single-recipient change.",
  );
  const patient = await newPage(alice);
  await patient
    .getByRole("button", { name: "I miei documenti", exact: true })
    .click();
  await expect(
    patient.getByRole("heading", { name: "I miei documenti", exact: true }),
  ).toBeVisible();
  await expect(
    patient.getByText(uploadedDoc.title, { exact: true }),
  ).toBeVisible();
  await expect(patient.getByText(other.title, { exact: true })).toHaveCount(0);
  await patient.goto(origin + "/profile");
  await patient
    .getByRole("button", { name: "I miei documenti", exact: true })
    .click();
  await expect(
    patient.getByText(uploadedDoc.title, { exact: true }),
  ).toBeVisible();
  const noAccess = await newPage(bob);
  await noAccess.goto(origin + "/miei-documenti");
  await expect(
    noAccess.getByText("Nessun documento condiviso in questa pagina.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    noAccess.getByText(uploadedDoc.title, { exact: true }),
  ).toHaveCount(0);
  const downloadEvent = patient.waitForEvent("download");
  await patient
    .getByRole("button", { name: "Scarica PDF", exact: true })
    .click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("allegato-beta.pdf");
  expect(download.url().startsWith("blob:")).toBe(true);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks)).toEqual(pdf);
  await download.delete();
  expect(
    calls.some(
      (c) =>
        c.path.includes("/object/sign/") ||
        c.path.includes("/object/public/session-documents"),
    ),
  ).toBe(false);
  results.push(
    "Patient A sees only assigned file via Account/Profile links and downloads authenticated binary to a blob; B sees none; no signed/public URL.",
  );
  await manage
    .getByRole("button", { name: "Deseleziona tutti", exact: true })
    .click();
  await save(manage, 0);
  expect(grants.get(uploadedDoc.id).size).toBe(0);
  let deniedDownload = false;
  patient.on("download", () => {
    deniedDownload = true;
  });
  const previousDownloads = callCount(alice, "/functions/v1/document-file");
  await patient
    .getByRole("button", { name: "Scarica PDF", exact: true })
    .click();
  await expect(
    patient.getByText("Documento non disponibile o accesso revocato.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(callCount(alice, "/functions/v1/document-file")).toBe(
    previousDownloads + 1,
  );
  expect(deniedDownload).toBe(false);
  await patient
    .getByRole("button", { name: "Aggiorna documenti", exact: true })
    .click();
  await expect(
    patient.getByText("Nessun documento condiviso in questa pagina.", {
      exact: true,
    }),
  ).toBeVisible();
  results.push(
    "Revocation denies the very next download from an already-open patient card; refresh removes the file.",
  );
  await search(manage, "alice");
  await manage
    .getByRole("checkbox", {
      name: `Condividi con ${alice.email}`,
      exact: true,
    })
    .click();
  await save(manage, 1);
  await manage
    .getByRole("button", {
      name: "Archivia e revoca tutti gli accessi",
      exact: true,
    })
    .click();
  await manage
    .getByRole("button", {
      name: "Conferma archiviazione e revoca",
      exact: true,
    })
    .click();
  await expect(
    manage.getByRole("button", { name: "Riattiva documento", exact: true }),
  ).toBeVisible();
  expect(documents.get(uploadedDoc.id).active).toBe(false);
  expect(grants.get(uploadedDoc.id).size).toBe(0);
  await manage
    .getByRole("button", { name: "Riattiva documento", exact: true })
    .click();
  await expect(
    manage.getByText(
      "Documento riattivato. Scegli e salva nuovamente i destinatari prima di condividerlo.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    manage.getByText("Nessun destinatario selezionato.", { exact: true }),
  ).toBeVisible();
  expect(documents.get(uploadedDoc.id).active).toBe(true);
  expect(grants.get(uploadedDoc.id).size).toBe(0);
  await patient
    .getByRole("button", { name: "Aggiorna documenti", exact: true })
    .click();
  await expect(
    patient.getByText("Nessun documento condiviso in questa pagina.", {
      exact: true,
    }),
  ).toBeVisible();
  results.push(
    "Archive removes existing grants; reactivation does not restore them.",
  );
  for (const width of [320, 390, 1440]) {
    for (const [page, label] of [
      [manage, "manager"],
      [patient, "patient"],
    ]) {
      currentPage = page;
      await page.setViewportSize({ width, height: 844 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
      await screenshot(page, `${label}-${width}`);
    }
  }
  expect(
    unexpected,
    "All service calls must remain in the explicit simulation",
  ).toEqual([]);
  if (artifacts)
    await writeFile(
      resolve(artifacts, "results.json"),
      JSON.stringify({ results, calls }, null, 2),
    );
  console.log(
    "PASS: guest/normal/editor/MFA document access, private PDF upload without automatic grants, explicit recipient selection, patient isolation, authenticated blob download, next-download revocation, archive/reactivation and 320/390/1440 layouts. All services mocked; no real users, files or emails sent.",
  );
} catch (error) {
  if (artifacts && currentPage) {
    await screenshot(currentPage, "failure");
    await writeFile(
      resolve(artifacts, "partial-results.json"),
      JSON.stringify({ results, calls, unexpected }, null, 2),
    );
  }
  throw error;
} finally {
  for (const context of contexts) await context.close();
  await browser.close();
  await new Promise((done) => server.close(done));
}
