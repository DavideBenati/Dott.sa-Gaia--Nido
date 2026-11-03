// Manual sends only. Verify JWT is disabled at the gateway; verify the real
// user and scoped Studio permission here, including configured MFA requirements.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const site = "https://metimaia.com";
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

async function body(request: Request): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > 1024)
    throw new Error("body");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("body");
  const decoder = new TextDecoder();
  let length = 0,
    text = "";
  try {
    while (true) {
      const value = await reader.read();
      if (value.done) break;
      length += value.value.byteLength;
      if (length > 1024) {
        await reader.cancel();
        throw new Error("body");
      }
      text += decoder.decode(value.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

function email(invitationId: string, expiresAt: string, recipient: string) {
  // All fields are frozen by the claim; retries keep the exact provider body.
  const link = `${site}/videochiamate?invito=${invitationId}`;
  const expiry = new Date(expiresAt).toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return {
    from: "Dott.sa Gaia | metiMaia <noreply@metimaia.com>",
    reply_to: "ostetricamaia@gmail.com",
    to: [recipient],
    subject: "Il tuo invito alla videochiamata con Gaia 🌿",
    text: `Ciao,\n\nho preparato il tuo invito per la videochiamata su metiMaia.\n\nApri il tuo invito: ${link}\nAccedi con l’account che usa questa email, poi scegli «Entra nella videochiamata» all’orario concordato con me. L’incontro si apre su Hostpoint Meet, dove potrai autorizzare microfono e telecamera.\n\nL’invito nell’area riservata è disponibile fino al ${expiry} (ora italiana). Questa è la scadenza del link, non la data dell’appuntamento.\n\nPer concordare o modificare l’orario, rispondi a questa email.\n\nA presto,\nDott.sa Gaia\nOstetrica | metiMaia`,
    html: `<!doctype html><html lang="it"><body style="margin:0;padding:24px;background:#faf7f2;color:#303a35;font-family:Arial,sans-serif;line-height:1.65"><main style="max-width:600px;margin:auto;padding:28px;background:#fff;border-radius:16px"><p>Ciao,</p><p>ho preparato il tuo invito per la videochiamata su <strong>metiMaia</strong>.</p><p style="margin:28px 0"><a href="${link}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#42624b;color:#fff;text-decoration:none">Apri il tuo invito</a></p><p>Accedi con l’account che usa questa email, poi scegli <strong>«Entra nella videochiamata»</strong> all’orario concordato con me.</p><p>L’incontro si apre su Hostpoint Meet, dove potrai autorizzare microfono e telecamera.</p><p style="font-size:14px">L’invito nell’area riservata è disponibile fino al ${expiry} (ora italiana). Questa è la scadenza del link, non la data dell’appuntamento.</p><p>Per concordare o modificare l’orario, rispondi a questa email.</p><p>A presto,<br><strong>Dott.sa Gaia</strong><br>Ostetrica | metiMaia</p></main></body></html>`,
  };
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
    const backend = Deno.env.get("SUPABASE_URL"),
      serverKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      publicKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!backend || !serverKey || !publicKey)
      return reply(503, {
        error: "Servizio email da configurare. L’invito resta salvato.",
      });
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.match(/^Bearer ([^\s]+)$/)?.[1];
    if (!token)
      return reply(401, { error: "Accedi con l’account professionale." });
    const server = createClient(backend, serverKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const scoped = createClient(backend, publicKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const identity = await server.auth.getUser(token);
    if (identity.error || !identity.data?.user)
      return reply(401, { error: "Sessione non valida. Accedi di nuovo." });
    const permission = await scoped.rpc("is_editor");
    if (permission.error || permission.data !== true)
      return reply(403, {
        error: "Accesso Studio e verifica di sicurezza richiesti.",
      });
    let input;
    try {
      input = await body(request);
    } catch {
      return reply(400, { error: "Richiesta non valida." });
    }
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      Object.keys(input).length !== 1 ||
      !("invitation_id" in input) ||
      typeof input.invitation_id !== "string" ||
      !uuid.test(input.invitation_id)
    )
      return reply(400, { error: "Richiesta non valida." });
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey)
      return reply(503, {
        error: "L’invito è salvato. Il servizio email deve essere configurato.",
      });
    const claimed = await scoped.rpc("video_call_email_claim", {
      p_invitation_id: input.invitation_id.toLowerCase(),
      p_expected_user_id: identity.data.user.id,
    });
    if (claimed.error)
      return reply(claimed.error.code === "42501" ? 403 : 503, {
        error:
          claimed.error.code === "42501"
            ? "Invito scaduto, account cambiato o accesso Studio non disponibile."
            : "Invio email non disponibile. L’invito resta salvato.",
      });
    const job = claimed.data;
    if (
      !job ||
      typeof job !== "object" ||
      !["sending", "accepted", "failed"].includes(job.status)
    )
      return reply(503, {
        error:
          "Esito email non disponibile. Aggiorna lo stato prima di riprovare.",
      });
    if (job.status !== "sending" || !job.lease_token)
      return reply(200, {
        status: job.status,
        accepted_at: job.accepted_at ?? null,
      });
    if (
      !uuid.test(job.job_id) ||
      !uuid.test(job.lease_token) ||
      job.invitation_id !== input.invitation_id.toLowerCase() ||
      typeof job.recipient_email !== "string" ||
      job.recipient_email.length > 254 ||
      !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(job.recipient_email) ||
      typeof job.expires_at !== "string" ||
      !Number.isFinite(Date.parse(job.expires_at))
    )
      return reply(503, {
        error:
          "Esito email non disponibile. Aggiorna lo stato prima di riprovare.",
      });
    const allowed = await scoped.rpc("video_call_email_authorized", {
      p_job_id: job.job_id,
      p_lease_token: job.lease_token,
      p_expected_user_id: identity.data.user.id,
    });
    let result: "accepted" | "retry" | "uncertain" | "failed" = "failed";
    let errorCode: string | null = "access_changed";
    if (!allowed.error && allowed.data === true) {
      result = "uncertain";
      errorCode = "provider_or_network";
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `video-invite-${job.job_id}`,
          },
          body: JSON.stringify(
            email(job.invitation_id, job.expires_at, job.recipient_email),
          ),
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const receipt = await response.json();
          if (
            typeof receipt?.id === "string" &&
            receipt.id.length > 0 &&
            receipt.id.length < 200
          ) {
            result = "accepted";
            errorCode = null;
          } else errorCode = "provider_receipt";
        } else {
          result = response.status >= 500 ? "uncertain" : "retry";
          errorCode = `provider_${response.status}`;
        }
      } catch {
        /* The same frozen payload and key are retained for manual retry. */
      }
    } else if (allowed.error) {
      result = "retry";
      errorCode = "access_check";
    }
    const finished = await server.rpc("video_call_email_finish", {
      p_job_id: job.job_id,
      p_lease_token: job.lease_token,
      p_result: result,
      p_error_code: errorCode,
    });
    if (finished.error || finished.data !== true)
      return reply(200, { status: "uncertain", accepted_at: null });
    const state = await scoped.rpc("list_video_call_email_status", {
      p_invitation_ids: [job.invitation_id],
    });
    const acceptedAt =
      !state.error &&
      Array.isArray(state.data) &&
      state.data[0]?.status === "accepted"
        ? state.data[0].accepted_at
        : null;
    return reply(200, { status: result, accepted_at: acceptedAt });
  } catch {
    return reply(503, {
      error:
        "Servizio email temporaneamente non disponibile. L’invito resta salvato; aggiorna lo stato prima di riprovare.",
    });
  }
});
