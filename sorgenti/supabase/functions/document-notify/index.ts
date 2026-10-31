// Deploy with gateway Verify JWT disabled. Browser calls verify the real user
// token and document-manager/MFA permission; scheduled calls use a private token.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const site = "https://metimaia.com";
const documentsURL = `${site}/miei-documenti`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = {
  "Access-Control-Allow-Origin": site,
  "Access-Control-Allow-Headers":
    "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  Vary: "Origin",
};
const reply = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers });

type NotificationJob = {
  job_id: string;
  lease_token: string;
  document_id: string;
  recipient_id: string;
  document_title: string;
  recipient_email: string;
  attempts: number;
};

function materialTitle(value: string) {
  return Array.from(value)
    .map((character) =>
      character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
        ? " "
        : character,
    )
    .join("")
    .trim();
}

function job(value: unknown): NotificationJob | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    ["job_id", "lease_token", "document_id", "recipient_id"].some(
      (key) => typeof row[key] !== "string" || !uuid.test(row[key] as string),
    ) ||
    typeof row.document_title !== "string" ||
    !materialTitle(row.document_title) ||
    Array.from(row.document_title).length > 180 ||
    typeof row.recipient_email !== "string" ||
    row.recipient_email.length > 254 ||
    !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(row.recipient_email) ||
    !Number.isSafeInteger(row.attempts) ||
    (row.attempts as number) < 1
  )
    return null;
  return row as NotificationJob;
}

function email(documentTitle: string) {
  // The frozen title and recipient make the complete provider request stable
  // across retries. No timestamp, nickname, token or document contents are added.
  const title = materialTitle(documentTitle);
  const escape = (text: string) =>
    text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  const text = `Ciao,

ho aggiunto alla tua area riservata su metiMaia il materiale «${title}».

Puoi leggerlo con calma, quando trovi il momento giusto per te. Spero possa esserti utile e accompagnarti, un piccolo passo alla volta.

Apri i miei documenti: ${documentsURL}
Accedi con il tuo account metiMaia.

Se hai una domanda o qualcosa non è chiaro, scrivimi: sarò felice di ascoltarti.

Con affetto,
Dott.sa Gaia
Ostetrica | metiMaia

Con te, dall’attesa alla nascita. 🌿`;
  const html = `<!doctype html><html lang="it"><body style="margin:0;padding:24px;background:#faf7f2;color:#303a35;font-family:Arial,sans-serif;line-height:1.65"><main style="max-width:600px;margin:auto;padding:28px;background:#fff;border-radius:16px"><p>Ciao,</p><p>ho aggiunto alla tua area riservata su <strong>metiMaia</strong> il materiale:</p><p style="font-size:20px;color:#42624b"><strong>${escape(title)}</strong></p><p>Puoi leggerlo con calma, quando trovi il momento giusto per te. Spero possa esserti utile e accompagnarti, un piccolo passo alla volta.</p><p style="margin:28px 0"><a href="${documentsURL}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#42624b;color:#fff;text-decoration:none">Apri i miei documenti</a></p><p style="font-size:14px">Accedi con il tuo account metiMaia.</p><p>Se hai una domanda o qualcosa non è chiaro, scrivimi: sarò felice di ascoltarti.</p><p>Con affetto,<br><strong>Dott.sa Gaia</strong><br>Ostetrica | metiMaia</p><p style="color:#67736c">Con te, dall’attesa alla nascita. 🌿</p></main></body></html>`;
  return {
    from: "Dott.sa Gaia | metiMaia <noreply@metimaia.com>",
    reply_to: "ostetricamaia@gmail.com",
    subject: "Gaia ha condiviso un materiale con te 🌿",
    text,
    html,
  };
}

async function readBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > 2048) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  let bytes = 0;
  let raw = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2048) {
        await reader.cancel();
        return null;
      }
      raw += decoder.decode(value, { stream: true });
    }
    return raw + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");
  if (origin && origin !== site)
    return reply(403, { error: "Origine non consentita." });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return reply(405, { error: "Metodo non disponibile." });
  try {
    const backend = Deno.env.get("SUPABASE_URL");
    const serverKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const publicKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!backend || !serverKey || !publicKey)
      return reply(503, { error: "Servizio notifiche da configurare." });
    const scheduledToken = Deno.env.get("DOCUMENT_NOTIFY_JOB_TOKEN");
    const scheduled = Boolean(
      scheduledToken &&
      scheduledToken.length >= 32 &&
      request.headers.get("x-document-notify-token") === scheduledToken,
    );
    const authorization = request.headers.get("authorization") ?? "";
    const server = createClient(backend, serverKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const scoped = createClient(backend, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    if (!scheduled) {
      const token = authorization.match(/^Bearer ([^\s]+)$/)?.[1];
      if (!token)
        return reply(401, { error: "Accedi con l’account professionale." });
      const identity = await server.auth.getUser(token);
      if (identity.error || !identity.data?.user)
        return reply(401, { error: "Sessione non valida. Accedi di nuovo." });
      const access = await scoped.rpc("can_manage_documents");
      if (access.error || access.data !== true)
        return reply(403, {
          error: "Servono il permesso documenti e la verifica a due fattori.",
        });
    }
    const raw = await readBody(request);
    if (raw === null) return reply(413, { error: "Richiesta troppo lunga." });
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply(400, { error: "Richiesta non valida." });
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some(
        (key) => !["action", "document_id"].includes(key),
      ) ||
      !["dispatch", "retry"].includes(body.action) ||
      (scheduled && body.action !== "retry") ||
      (!scheduled &&
        (typeof body.document_id !== "string" ||
          !uuid.test(body.document_id))) ||
      (body.document_id !== undefined &&
        (typeof body.document_id !== "string" || !uuid.test(body.document_id)))
    )
      return reply(400, { error: "Richiesta non valida." });
    const documentId =
      typeof body.document_id === "string"
        ? body.document_id.toLowerCase()
        : null;
    // Missing provider configuration must leave jobs pending, not leased.
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey)
      return reply(503, {
        error:
          "Gli accessi sono salvati; il servizio email deve essere configurato.",
      });
    const claimed = await server.rpc("document_notification_claim", {
      p_document_id: documentId,
      p_limit: 10,
    });
    if (claimed.error || !Array.isArray(claimed.data))
      return reply(503, {
        error:
          "La condivisione resta salvata. Gli avvisi email sono da riprovare.",
      });
    let accepted = 0,
      retrying = 0,
      cancelled = 0;
    let previousCall = 0;
    let uncertainDatabase = false;
    const started = Date.now();
    for (const value of claimed.data) {
      const candidate = job(value);
      if (!candidate) {
        uncertainDatabase = true;
        continue;
      }
      let result: "accepted" | "retry" | "cancelled" | "uncertain" = "retry";
      let errorCode: string | null = null;
      if (Date.now() - started > 45000) errorCode = "batch_timeout";
      else {
        try {
          const wait = 600 - (Date.now() - previousCall);
          if (wait > 0) await new Promise((done) => setTimeout(done, wait));
          // This RPC rechecks the actual grant, document state, confirmed user,
          // frozen email identity and this lease immediately before the send.
          const authorized = await server.rpc(
            "document_notification_authorized",
            {
              p_job_id: candidate.job_id,
              p_lease_token: candidate.lease_token,
            },
          );
          if (authorized.error) {
            result = "retry";
            errorCode = "access_check";
          } else {
            const current = job(
              Array.isArray(authorized.data)
                ? authorized.data[0]
                : authorized.data,
            );
            if (
              !current ||
              current.job_id !== candidate.job_id ||
              current.lease_token !== candidate.lease_token ||
              current.document_id !== candidate.document_id ||
              current.recipient_id !== candidate.recipient_id ||
              current.document_title !== candidate.document_title ||
              current.recipient_email !== candidate.recipient_email
            ) {
              result = "cancelled";
              errorCode = "access_changed";
            } else {
              previousCall = Date.now();
              result = "uncertain";
              const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${resendKey}`,
                  "Content-Type": "application/json",
                  "Idempotency-Key": `document-share-${current.job_id}`,
                },
                body: JSON.stringify({
                  ...email(current.document_title),
                  to: [current.recipient_email],
                }),
                signal: AbortSignal.timeout(5000),
              });
              if (response.ok) {
                const receipt = await response.json();
                if (
                  typeof receipt?.id === "string" &&
                  receipt.id.length > 0 &&
                  receipt.id.length < 200
                )
                  result = "accepted";
                else errorCode = "provider_receipt";
              } else {
                result = response.status >= 500 ? "uncertain" : "retry";
                errorCode = `provider_${response.status}`;
              }
            }
          }
        } catch {
          errorCode = "provider_or_network";
        }
      }
      const finished = await server.rpc("document_notification_finish", {
        p_job_id: candidate.job_id,
        p_lease_token: candidate.lease_token,
        p_result: result,
        p_error_code: errorCode,
      });
      if (finished.error || finished.data !== true) uncertainDatabase = true;
      if (result === "accepted") accepted++;
      else if (result === "cancelled") cancelled++;
      else retrying++;
    }
    let status: unknown = null;
    if (!scheduled && documentId) {
      const state = await scoped.rpc("document_notification_status", {
        p_document_id: documentId,
      });
      if (!state.error) status = state.data;
    }
    return reply(200, {
      processed: claimed.data.length,
      accepted,
      retrying,
      cancelled,
      status,
      ...(uncertainDatabase
        ? {
            warning:
              "Alcuni esiti email non sono ancora confermati. Aggiorna lo stato prima di riprovare.",
          }
        : {}),
    });
  } catch {
    return reply(503, {
      error:
        "Gli accessi restano salvati. Il servizio email è temporaneamente non disponibile.",
    });
  }
});
