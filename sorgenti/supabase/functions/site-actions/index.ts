import { createClient } from "npm:@supabase/supabase-js@2.118.0";
const origin = "https://metimaia.com";
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const reply = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), { status, headers });
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply(405, "Metodo non disponibile.");
  if (req.headers.get("origin") && req.headers.get("origin") !== origin)
    return reply(403, "Origine non consentita.");
  try {
    const raw = await req.text();
    if (raw.length > 5000) return reply(413, "Richiesta troppo lunga.");
    const b = JSON.parse(raw);
    const r = b.request;
    const topics = [
      "Informazioni sui servizi",
      "Richiesta di un incontro ostetrico",
      "Informazioni su accompagnamento alla nascita",
      "Informazioni sul periodo dopo la nascita",
    ];
    if (
      b.action !== "booking" ||
      !r ||
      !/^([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(
        b.id ?? "",
      )
    )
      return reply(400, "Richiesta non valida.");
    if (
      ["name", "email", "topic", "date", "time", "mode"].some(
        (k) => typeof r[k] !== "string",
      )
    )
      return reply(400, "Dati incompleti.");
    if (
      !r.name.trim() ||
      r.name.length > 100 ||
      r.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email) ||
      !topics.includes(r.topic) ||
      !["Da concordare", "Mattina", "Pomeriggio"].includes(r.time) ||
      ![
        "Da concordare",
        "In presenza, se disponibile",
        "A distanza, se disponibile",
      ].includes(r.mode)
    )
      return reply(400, "Controlla i dati della richiesta.");
    if (r.date) {
      const d = new Date(r.date + "T12:00:00Z");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
        Number.isNaN(d.valueOf()) ||
        d.toISOString().slice(0, 10) !== r.date ||
        r.date <
          new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" })
      )
        return reply(400, "Data non valida.");
    }
    const url = Deno.env.get("SUPABASE_URL"),
      key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return reply(503, "Servizio non configurato.");
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const salt = Deno.env.get("BOOKING_RATE_SALT");
    if (!salt) return reply(503, "Servizio da attivare.");
    // Hashes are rate-limit buckets, never plain email addresses or IPs.
    async function hash(value: string) {
      const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(salt + value),
      );
      return [...new Uint8Array(bytes)]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("");
    }
    for (const [bucket, max] of [
      [`booking-email:${await hash(r.email.trim().toLowerCase())}`, 3],
      [
        `booking-network:${await hash(req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown")}`,
        10,
      ],
      ["booking-global", 100],
    ] as const) {
      const { data, error } = await db.rpc("newsletter_take_slot", {
        bucket_key: bucket,
        max_attempts: max,
        window_seconds: 3600,
      });
      if (error) return reply(503, "Servizio temporaneamente non disponibile.");
      if (data !== true)
        return reply(429, "Troppe richieste. Attendi prima di riprovare.");
    }
    const { error } = await db
      .from("booking_requests")
      .insert({
        id: b.id,
        name: r.name.trim(),
        email: r.email.trim().toLowerCase(),
        topic: r.topic,
        preferred_date: r.date || null,
        preferred_time: r.time,
        preferred_mode: r.mode,
      });
    // A retry reuses its random identifier and never resends notifications.
    if (error) {
      if (error.code === "23505")
        return reply(
          200,
          "Richiesta già acquisita. Attendi il ricontatto di Gaia.",
        );
      return reply(
        503,
        "Salvataggio non confermato. Riprova dalla stessa pagina.",
      );
    }
    const resend = Deno.env.get("RESEND_API_KEY");
    if (resend) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resend}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `booking-${b.id}`,
          },
          body: JSON.stringify({
            from: "metiMaia <noreply@metimaia.com>",
            to: ["ostetricamaia@gmail.com"],
            subject: "Nuova richiesta di incontro — metiMaia",
            text: "È arrivata una richiesta di disponibilità. Accedi al pannello riservato: https://metimaia.com/richieste\nNon rispondere a questa notifica.",
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (response.ok)
          await db
            .from("booking_requests")
            .update({ mail_sent: true })
            .eq("id", b.id);
      } catch {
        /* The saved request remains available in the professional inbox. */
      }
    }
    return reply(
      200,
      "Richiesta acquisita. Gaia potrà ricontattarti: l’appuntamento non è ancora confermato.",
    );
  } catch {
    return reply(400, "Richiesta non valida o servizio non disponibile.");
  }
});
