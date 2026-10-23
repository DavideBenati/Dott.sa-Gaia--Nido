// Deploy with --no-verify-jwt: confirmation links and guest subscriptions are public.
// All database access uses a server-only key. No client can read subscriber tokens.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
const consentVersion = "2026-10-23-v1";
const site = "https://metimaia.com";
const cors = {
  "Access-Control-Allow-Origin": site,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  Vary: "Origin",
};
const generic = {
  message:
    "Se la richiesta è valida, riceverai un’email per confermare l’iscrizione.",
};
const hash = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
const token = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { headers: cors });
  const secret = Deno.env.get("RESEND_API_KEY");
  const backend = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || !backend || !serviceKey)
    return json({ error: "Newsletter non ancora configurata." }, 503);
  const db = createClient(backend, serviceKey, {
    auth: { persistSession: false },
  });
  try {
    if (request.method !== "POST")
      return json({ error: "Metodo non consentito." }, 405);
    const origin = request.headers.get("Origin");
    if (origin && origin !== site)
      return json({ error: "Origine non consentita." }, 403);
    if (Number(request.headers.get("content-length") ?? 0) > 2048)
      return json({ error: "Richiesta troppo grande." }, 413);
    const raw = await request.text();
    if (raw.length > 2048)
      return json({ error: "Richiesta troppo grande." }, 413);
    const body = JSON.parse(raw);
    if (body.action === "confirm" || body.action === "unsubscribe") {
      const value = typeof body.token === "string" ? body.token : "";
      if (!/^[a-f0-9]{64}$/.test(value))
        return json({ error: "Link non valido." }, 400);
      const digest = await hash(value);
      const query =
        body.action === "confirm"
          ? db
              .from("newsletter_subscribers")
              .update({
                status: "confirmed",
                confirmed_at: new Date().toISOString(),
                confirmation_hash: null,
                confirmation_expires_at: null,
              })
              .eq("confirmation_hash", digest)
              .eq("status", "pending")
              .gt("confirmation_expires_at", new Date().toISOString())
              .select("id")
          : db
              .from("newsletter_subscribers")
              .update({
                status: "unsubscribed",
                unsubscribed_at: new Date().toISOString(),
                confirmation_hash: null,
                confirmation_expires_at: null,
              })
              .eq("unsubscribe_hash", digest)
              .select("id");
      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length)
        return json(
          {
            error:
              "Link scaduto o già utilizzato. Se hai già confermato non occorre ripetere l’operazione.",
          },
          400,
        );
      return json({
        message:
          body.action === "confirm"
            ? "Iscrizione confermata. Grazie!"
            : "Disiscrizione completata. Non riceverai più la newsletter.",
      });
    }
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      body.consent !== true ||
      body.consentVersion !== consentVersion
    )
      return json({ error: "Email e consenso validi sono necessari." }, 400);
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    for (const [key, limit, seconds] of [
      ["email:" + email, 2, 3600],
      ["network:" + ip, 10, 3600],
      ["global", 100, 86400],
    ] as const) {
      const { data, error } = await db.rpc("newsletter_take_slot", {
        bucket_key: await hash(secret + key),
        max_attempts: limit,
        window_seconds: seconds,
      });
      if (error) throw error;
      if (!data) return json(generic); // Do not disclose membership/rate state.
    }
    const { error: cleanupError } = await db
      .from("newsletter_subscribers")
      .delete()
      .eq("status", "pending")
      .lt("confirmation_expires_at", new Date().toISOString());
    if (cleanupError) throw cleanupError;
    const { data: current, error: lookupError } = await db
      .from("newsletter_subscribers")
      .select("status")
      .eq("email", email)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (current?.status === "confirmed") return json(generic);
    const confirmation = token();
    const cancellation = token();
    const { error: writeError } = await db
      .from("newsletter_subscribers")
      .upsert(
        {
          email,
          status: "pending",
          consent_version: consentVersion,
          requested_at: new Date().toISOString(),
          confirmed_at: null,
          unsubscribed_at: null,
          confirmation_hash: await hash(confirmation),
          confirmation_expires_at: new Date(
            Date.now() + 86400000,
          ).toISOString(),
          unsubscribe_hash: await hash(cancellation),
        },
        { onConflict: "email" },
      );
    if (writeError) throw writeError;
    const base = `${site}/newsletter`;
    const confirmURL = `${base}?action=confirm&token=${confirmation}`;
    const unsubscribeURL = `${base}?action=unsubscribe&token=${cancellation}`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "metiMaia <noreply@metimaia.com>",
        to: [email],
        subject: "Conferma la newsletter metiMaia 🌿",
        html: `<div style="background:#FAF7F2;padding:28px;font:16px/1.7 Arial;color:#35453B"><h1>La newsletter di metiMaia</h1><p>Hai richiesto di ricevere contenuti, aggiornamenti e novità sui servizi della Dott.ssa Gaia Brunetti. Per completare l’iscrizione, apri il collegamento e conferma la scelta. Il link scade dopo 24 ore.</p><p><a href="${confirmURL}">Conferma la newsletter</a></p><p>Se non hai effettuato la richiesta, ignora questa email: non sarai iscritto/a.</p><p><a href="${unsubscribeURL}">Cancella l’iscrizione</a> · <a href="${site}/privacy">Privacy</a></p><p>Gaia Brunetti · Via San Godenzo 33, Roma<br>ostetricamaia@gmail.com</p></div>`,
      }),
    });
    if (!response.ok)
      return json({ error: "Invio non riuscito. Riprova più tardi." }, 502);
    return json(generic);
  } catch {
    // Never log raw addresses, tokens, or provider/API secrets.
    return json(
      { error: "Servizio newsletter temporaneamente non disponibile." },
      503,
    );
  }
});
