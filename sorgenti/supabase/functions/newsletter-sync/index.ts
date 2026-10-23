import { createClient } from "npm:@supabase/supabase-js@2.118.0";
const site = "https://metimaia.com";
const headers = {
  "Access-Control-Allow-Origin": site,
  "Access-Control-Allow-Headers":
    "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const reply = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function signedWebhook(req: Request, raw: string, secret: string) {
  try {
    const id = req.headers.get("svix-id") ?? "",
      stamp = req.headers.get("svix-timestamp") ?? "",
      signatures = req.headers.get("svix-signature") ?? "";
    if (
      !id ||
      id.length > 200 ||
      !/^\d{10}$/.test(stamp) ||
      Math.abs(Date.now() / 1000 - Number(stamp)) > 300
    )
      return false;
    const bytes = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) =>
      c.charCodeAt(0),
    );
    const key = await crypto.subtle.importKey(
      "raw",
      bytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const body = new TextEncoder().encode(`${id}.${stamp}.${raw}`);
    for (const part of signatures.split(" ")) {
      if (!part.startsWith("v1,")) continue;
      const sig = Uint8Array.from(atob(part.slice(3)), (c) => c.charCodeAt(0));
      if (await crypto.subtle.verify("HMAC", key, sig, body)) return true;
    }
    return false;
  } catch {
    return false;
  }
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST")
    return reply(405, { error: "Metodo non disponibile." });
  try {
    const raw = await req.text();
    if (raw.length > 20000)
      return reply(413, { error: "Richiesta troppo lunga." });
    const backend = Deno.env.get("SUPABASE_URL"),
      serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!backend || !serviceKey)
      return reply(503, { error: "Servizio non configurato." });
    const db = createClient(backend, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if (new URL(req.url).searchParams.get("webhook") === "resend") {
      const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
      if (!secret) return reply(503, { error: "Webhook da configurare." });
      if (!(await signedWebhook(req, raw, secret)))
        return reply(401, { error: "Firma non valida." });
      const event = JSON.parse(raw),
        data = event.data;
      const optout =
        (event.type === "contact.updated" && data?.unsubscribed === true) ||
        event.type === "contact.deleted" ||
        event.type === "suppression.added";
      if (!optout) return reply(200, { received: true });
      if (
        typeof data?.email !== "string" ||
        !/^\S+@\S+\.\S+$/.test(data.email) ||
        !Number.isFinite(Date.parse(event.created_at))
      )
        return reply(400, { error: "Evento non valido." });
      const { error } = await db.rpc("newsletter_provider_optout", {
        event_id: req.headers.get("svix-id"),
        event_email: data.email,
        event_at: event.created_at,
      });
      if (error) return reply(503, { error: "Evento da riprovare." });
      return reply(200, { received: true });
    }
    const origin = req.headers.get("origin");
    if (origin && origin !== site)
      return reply(403, { error: "Origine non consentita." });
    const body = JSON.parse(raw),
      auth = req.headers.get("authorization") ?? "";
    const scheduledToken = Deno.env.get("NEWSLETTER_SYNC_JOB_TOKEN");
    const internal =
      auth === `Bearer ${serviceKey}` ||
      Boolean(
        scheduledToken &&
        req.headers.get("x-newsletter-sync-token") === scheduledToken,
      );
    if (!internal) {
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!token)
        return reply(401, { error: "Accedi con l’account professionale." });
      const { data, error } = await db.auth.getUser(token);
      if (error || !data.user)
        return reply(401, { error: "Sessione non valida." });
      const anon = Deno.env.get("SUPABASE_ANON_KEY");
      if (!anon) return reply(503, { error: "Servizio non configurato." });
      const scoped = createClient(backend, anon, {
        auth: { persistSession: false },
        global: { headers: { Authorization: auth } },
      });
      const access = await scoped.rpc("is_editor");
      if (access.error || access.data !== true)
        return reply(403, {
          error:
            "Permesso professionale e secondo fattore richiesto, se attivo.",
        });
    }
    if (!["retry", "reconcile"].includes(body.action ?? "retry"))
      return reply(400, { error: "Azione non valida." });
    if (body.subscriber_id && (!internal || !uuid.test(body.subscriber_id)))
      return reply(400, { error: "Identificativo non valido." });
    const apiKey = Deno.env.get("RESEND_CONTACTS_API_KEY");
    if (!apiKey)
      return reply(503, {
        error:
          "Configura RESEND_CONTACTS_API_KEY con accesso completo ai contatti Resend.",
      });
    if (body.action === "reconcile") {
      const { error } = await db.rpc("newsletter_queue_reconcile");
      if (error)
        return reply(503, { error: "Configurazione database da completare." });
    }
    const { data: jobs, error: claimError } = await db.rpc(
      "newsletter_claim_jobs",
      { only_subscriber: body.subscriber_id ?? null },
    );
    if (claimError)
      return reply(503, {
        error: "Configurazione sincronizzazione da completare.",
      });
    let lastCall = 0;
    async function provider(path: string, method = "GET", body?: object) {
      const wait = 600 - (Date.now() - lastCall);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastCall = Date.now();
      return fetch(`https://api.resend.com${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(5000),
      });
    }
    for (const job of jobs ?? []) {
      let seen = job.provider_seen === true;
      let code: string | null = null;
      try {
        const { data: subscriber, error } = await db
          .from("newsletter_subscribers")
          .select("id,email,status,confirmed_at")
          .eq("id", job.subscriber_id)
          .maybeSingle();
        if (error) throw new Error("DATABASE");
        if (
          subscriber &&
          ["confirmed", "unsubscribed"].includes(subscriber.status)
        ) {
          const path = `/contacts/${encodeURIComponent(subscriber.email)}`,
            result = await provider(path);
          if (result.status === 404) {
            if (seen && subscriber.status === "confirmed") {
              const removed = await db
                .from("newsletter_subscribers")
                .update({
                  status: "unsubscribed",
                  unsubscribed_at: new Date().toISOString(),
                  confirmation_hash: null,
                  confirmation_expires_at: null,
                })
                .eq("id", subscriber.id)
                .eq("status", "confirmed")
                .eq("confirmed_at", subscriber.confirmed_at);
              if (removed.error) throw new Error("DATABASE");
            } else if (subscriber.status === "confirmed") {
              const created = await provider("/contacts", "POST", {
                email: subscriber.email,
                unsubscribed: false,
              });
              if (!created.ok) throw new Error(`PROVIDER_${created.status}`);
              seen = true;
            }
          } else if (!result.ok) throw new Error(`PROVIDER_${result.status}`);
          else {
            const contact = await result.json();
            seen = true;
            if (typeof contact.unsubscribed !== "boolean")
              throw new Error("PROVIDER_DATA");
            if (
              contact.unsubscribed === true &&
              subscriber.status === "confirmed"
            ) {
              // Provider opt-outs always win. Never silently reactivate a suppressed contact.
              const { error } = await db
                .from("newsletter_subscribers")
                .update({
                  status: "unsubscribed",
                  unsubscribed_at: new Date().toISOString(),
                  confirmation_hash: null,
                  confirmation_expires_at: null,
                })
                .eq("id", subscriber.id)
                .eq("status", "confirmed")
                .eq("confirmed_at", subscriber.confirmed_at);
              if (error) throw new Error("DATABASE");
            } else if (
              subscriber.status === "unsubscribed" &&
              contact.unsubscribed !== true
            ) {
              const updated = await provider(path, "PATCH", {
                unsubscribed: true,
              });
              if (!updated.ok) throw new Error(`PROVIDER_${updated.status}`);
            }
          }
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "NETWORK";
        code = /^(PROVIDER_\d{3}|PROVIDER_DATA|DATABASE)$/.test(message)
          ? message
          : "NETWORK";
      }
      const { error: writeError } = await db
        .from("newsletter_sync_jobs")
        .update({
          state: code ? "error" : "synced",
          provider_seen: seen,
          claim_token: null,
          leased_until: null,
          last_code: code,
          updated_at: new Date().toISOString(),
        })
        .eq("subscriber_id", job.subscriber_id)
        .eq("revision", job.revision)
        .eq("claim_token", job.claim_token);
      if (writeError)
        return reply(503, {
          error: "Esito non registrato: riprova dopo due minuti.",
        });
    }
    const { count: pending, error: pendingError } = await db
      .from("newsletter_sync_jobs")
      .select("subscriber_id", { head: true, count: "exact" })
      .eq("state", "pending");
    const { count: errors, error: errorsError } = await db
      .from("newsletter_sync_jobs")
      .select("subscriber_id", { head: true, count: "exact" })
      .eq("state", "error");
    if (pendingError || errorsError)
      return reply(503, { error: "Stato non disponibile." });
    return reply(200, {
      processed: jobs?.length ?? 0,
      pending: pending ?? 0,
      errors: errors ?? 0,
    });
  } catch {
    return reply(503, {
      error:
        "Sincronizzazione non completata. Nessun invio newsletter è stato eseguito.",
    });
  }
});
