// Deploy with gateway Verify JWT disabled: this function validates the user's
// token and the current document permission itself before using server storage.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const origin = "https://metimaia.com";
const bucket = "session-documents";
const maxFileBytes = 20 * 1024 * 1024;
const maxRequestBytes = 2048;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const types: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Disposition, Content-Type",
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  Vary: "Origin",
};
const reply = (status: number, message: string) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });

// Enforce the limit while reading, including requests without Content-Length.
async function readBody(request: Request): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > maxRequestBytes)
    return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxRequestBytes) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function disposition(name: string): string {
  const clean = Array.from(name)
    .filter(
      (character) =>
        character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
    )
    .slice(0, 180)
    .join("")
    .replace(/[\\/<>:"|?*]/g, "_");
  const fallback = clean.replace(/[^\x20-\x7e]/g, "_") || "documento";
  const encoded = encodeURIComponent(clean || "documento").replace(
    /['()*]/g,
    (character) => "%" + character.charCodeAt(0).toString(16).toUpperCase(),
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

Deno.serve(async (request: Request) => {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== origin)
    return reply(403, "Origine non consentita.");
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(405, "Metodo non disponibile.");

  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer ([^\s]+)$/);
  if (!match) return reply(401, "Accedi per aprire il documento.");

  try {
    const backend = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!backend || !serviceKey || !anonKey)
      return reply(503, "Servizio documenti non ancora configurato.");

    const server = createClient(backend, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const identity = await server.auth.getUser(match[1]);
    if (identity.error || !identity.data?.user)
      return reply(401, "Sessione non valida. Accedi di nuovo.");

    const raw = await readBody(request);
    if (raw === null) return reply(413, "Richiesta troppo lunga.");
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply(400, "Richiesta non valida.");
    }
    if (
      !body ||
      body.action !== "download" ||
      typeof body.document_id !== "string" ||
      !uuid.test(body.document_id)
    )
      return reply(400, "Richiesta non valida.");

    const documentId = body.document_id.toLowerCase();
    // Authorization is checked with the actual user JWT, including MFA and
    // revocations. Never accept a storage path or recipient identity from input.
    const scoped = createClient(backend, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const access = await scoped.rpc("authorized_document_file", {
      p_document_id: documentId,
    });
    if (access.error)
      return reply(503, "Verifica del documento non disponibile. Riprova.");
    const document = access.data;
    // Missing and unauthorized documents deliberately share the same response.
    if (!document) return reply(404, "Documento non disponibile.");

    const path =
      typeof document.storage_path === "string" ? document.storage_path : "";
    const parts = path.split("/");
    const file = parts[1]?.match(/^([0-9a-f-]+)\.(pdf|docx|pptx)$/i);
    const extension = file?.[2]?.toLowerCase() ?? "";
    if (
      document.id !== documentId ||
      parts.length !== 2 ||
      parts[0] !== documentId ||
      !file ||
      !uuid.test(file[1]) ||
      document.mime_type !== types[extension] ||
      typeof document.file_name !== "string" ||
      !document.file_name.toLowerCase().endsWith(`.${extension}`) ||
      !Number.isInteger(document.size_bytes) ||
      document.size_bytes <= 0 ||
      document.size_bytes > maxFileBytes
    )
      return reply(503, "Documento temporaneamente non disponibile.");

    // Client Storage SELECT is denied. Only this server request reads the file;
    // it never returns a public URL or a signed capability that outlives access.
    const result = await server.storage.from(bucket).download(path);
    if (
      result.error ||
      !result.data ||
      result.data.size !== document.size_bytes ||
      result.data.size > maxFileBytes
    )
      return reply(503, "Documento temporaneamente non disponibile.");

    // Recheck after storage retrieval: a grant may have been revoked while the
    // file was being read. Copies downloaded before revocation cannot be erased.
    const current = await scoped.rpc("authorized_document_file", {
      p_document_id: documentId,
    });
    if (current.error)
      return reply(503, "Verifica del documento non disponibile. Riprova.");
    if (
      !current.data ||
      current.data.id !== document.id ||
      current.data.storage_path !== path ||
      current.data.mime_type !== document.mime_type ||
      current.data.size_bytes !== document.size_bytes
    )
      return reply(404, "Documento non disponibile.");

    return new Response(result.data, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": document.mime_type,
        "Content-Disposition": disposition(document.file_name),
        "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      },
    });
  } catch {
    // Do not log tokens, file paths, titles, user identifiers or document data.
    return reply(503, "Documento temporaneamente non disponibile. Riprova.");
  }
});
