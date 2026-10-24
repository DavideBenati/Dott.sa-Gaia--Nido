import { client } from "./state";
export type SessionDocument = {
  id: string;
  owner_id: string | null;
  title: string;
  description: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  state: "uploading" | "ready" | "failed";
  active: boolean;
  created_at: string;
  updated_at: string;
  ready_at: string | null;
};
export type DocumentRecipient = {
  user_id: string;
  email: string;
  granted_at?: string;
};
export type DocumentAccess = {
  membership: boolean;
  documents_mfa_required: boolean;
  can_manage: boolean;
  mfa_satisfied: boolean;
};
export const documentTypes: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
export const maxDocumentBytes = 20 * 1024 * 1024;
const oneDocument = (value: unknown): SessionDocument =>
  (Array.isArray(value) ? value[0] : value) as SessionDocument;
const unavailable =
  "Documenti non disponibili. Verifica la connessione e la configurazione Supabase v7.";
async function identity() {
  if (!client) throw new Error(unavailable);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    throw new Error("Accedi per consultare i documenti.");
  return data.user.id;
}
export async function loadDocumentAccess(): Promise<DocumentAccess> {
  await identity();
  const { data, error } = await client!.rpc("document_access_status");
  if (error || !data || typeof data.can_manage !== "boolean")
    throw new Error(unavailable);
  return data as DocumentAccess;
}
export type DocumentFilter = {
  term?: string;
  state?: "all" | "active" | "archived" | "incomplete";
};
export async function listDocuments(
  page: number,
  manage = false,
  filter: DocumentFilter = {},
) {
  const user = await identity();
  let query = client!
    .from("session_documents")
    .select(
      "id,owner_id,title,description,file_name,mime_type,size_bytes,storage_path,state,active,created_at,updated_at,ready_at" +
        (manage ? "" : ",session_document_access!inner(user_id)"),
    );
  if (!manage)
    query = query
      .eq("session_document_access.user_id", user)
      .eq("state", "ready")
      .eq("active", true);
  if (manage) {
    if (filter.state === "active")
      query = query.eq("state", "ready").eq("active", true);
    else if (filter.state === "archived")
      query = query.eq("state", "ready").eq("active", false);
    else if (filter.state === "incomplete") query = query.neq("state", "ready");
    const term = filter.term?.trim().slice(0, 180);
    if (term) {
      // PostgREST quoted filter values preserve commas and parentheses; escape
      // SQL wildcard characters as literals, keeping the search predictable.
      const pattern = term.replace(/[\\%_]/g, "\\$&").replace(/"/g, '\\"');
      query = query.or(
        `title.ilike."%${pattern}%",file_name.ilike."%${pattern}%"`,
      );
    }
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(page * 20, page * 20 + 19)
    .returns<SessionDocument[]>();
  if (error) throw new Error(unavailable);
  return data ?? [];
}
export async function uploadDocument(
  file: File,
  title: string,
  description: string,
): Promise<SessionDocument> {
  const user = await identity();
  if (!title.trim() || title.trim().length > 180)
    throw new Error("Inserisci un titolo (massimo 180 caratteri).");
  if (description.length > 2000)
    throw new Error("La descrizione può contenere al massimo 2000 caratteri.");
  if (
    file.name.length > 255 ||
    Array.from(file.name).some(
      (character) =>
        character.charCodeAt(0) < 32 ||
        character.charCodeAt(0) === 127 ||
        character === String.fromCharCode(92) ||
        character === "/",
    )
  )
    throw new Error(
      "Rinomina il file: massimo 255 caratteri e nessun separatore di cartelle.",
    );
  const ext = file.name.split(".").at(-1)?.toLowerCase() ?? "",
    mime = documentTypes[ext];
  if (!mime) throw new Error("Usa PDF, Word .docx o PowerPoint .pptx.");
  if (!file.size || file.size > maxDocumentBytes)
    throw new Error("Il file deve essere non vuoto e non superare 20 MB.");
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const recognized =
    ext === "pdf"
      ? String.fromCharCode(...head.slice(0, 5)) === "%PDF-"
      : head[0] === 0x50 && head[1] === 0x4b && head[2] === 3 && head[3] === 4;
  if (!recognized)
    throw new Error(
      "Il formato del file non è riconosciuto. Esporta una copia PDF, DOCX o PPTX valida.",
    );
  const { data: prepared, error: prepareError } = await client!.rpc(
    "prepare_document",
    {
      document_title: title.trim(),
      document_description: description.trim(),
      document_name: file.name,
      document_mime: mime,
      document_size: file.size,
    },
  );
  const created = oneDocument(prepared);
  if (prepareError || !created?.id)
    throw new Error(
      "Preparazione non riuscita. Verifica il permesso documenti e il secondo fattore.",
    );
  try {
    if ((await identity()) !== user)
      throw new Error("Sessione cambiata: ripeti l’accesso.");
    // The SDK builds multipart data for File objects, using the File's MIME
    // rather than its contentType option. Normalize browsers' empty/odd MIME.
    const payload =
      file.type === mime
        ? file
        : new File([file], file.name, {
            type: mime,
            lastModified: file.lastModified,
          });
    const { error } = await client!.storage
      .from("session-documents")
      .upload(created.storage_path, payload, {
        contentType: mime,
        upsert: false,
        cacheControl: "0",
      });
    if (error) throw error;
    const complete = await client!.rpc("complete_document", {
      document_id: created.id,
    });
    const ready = oneDocument(complete.data);
    if (complete.error || !ready?.id) throw new Error();
    return ready;
  } catch {
    await client!.rpc("abort_document", { document_id: created.id });
    throw new Error(
      "Caricamento non completato. Il file non è condiviso; controlla la connessione e riprova come nuovo documento.",
    );
  }
}
export async function documentRecipients(id: string) {
  await identity();
  const { data, error } = await client!.rpc("document_recipients", {
    document_id: id,
  });
  if (error)
    throw new Error(
      "Destinatari non disponibili. I permessi esistenti non sono stati modificati.",
    );
  return (data ?? []) as DocumentRecipient[];
}
export async function searchDocumentUsers(term: string) {
  await identity();
  if (term.trim().length < 3)
    throw new Error("Inserisci almeno 3 caratteri dell’email.");
  const { data, error } = await client!.rpc("search_document_users", {
    search_term: term.trim(),
  });
  if (error)
    throw new Error(
      "Ricerca non riuscita. Verifica permesso e secondo fattore.",
    );
  return (data ?? []) as DocumentRecipient[];
}
export async function saveDocumentRecipients(
  id: string,
  ids: string[],
  expectedIds: string[],
) {
  await identity();
  const { error } = await client!.rpc("set_document_recipients", {
    document_id: id,
    user_ids: ids,
    expected_user_ids: expectedIds,
  });
  if (error?.code === "40001")
    throw new Error(
      "I destinatari sono cambiati da un’altra sessione. Ricarica i destinatari attuali prima di salvare.",
    );
  if (error)
    throw new Error(
      "Destinatari non salvati. Verifica che gli account siano confermati e il documento attivo.",
    );
  // Recipient saves advance updated_at. Read the protected snapshot so a later
  // metadata edit from this session does not conflict with its own ACL change.
  // A read failure must not report that the already committed grants failed.
  try {
    const latest = await client!
      .from("session_documents")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    return latest.error ? null : (latest.data as SessionDocument | null);
  } catch {
    return null;
  }
}
export async function setDocumentActive(
  document: SessionDocument,
  active: boolean,
): Promise<SessionDocument> {
  await identity();
  const { data, error } = await client!.rpc("update_document_state", {
    document_id: document.id,
    document_active: active,
    expected_updated_at: document.updated_at,
  });
  if (error?.code === "40001")
    throw new Error(
      "Il documento è cambiato da un’altra sessione. Torna all’elenco, aggiornalo e riapri il materiale prima di modificarne lo stato.",
    );
  if (error || !data)
    throw new Error(
      "Aggiornamento non riuscito. Verifica connessione, secondo fattore e aggiornamento Supabase v8.",
    );
  return oneDocument(data);
}
export async function saveDocumentDetails(
  document: SessionDocument,
  title: string,
  description: string,
): Promise<SessionDocument> {
  await identity();
  if (!title.trim() || title.trim().length > 180)
    throw new Error("Inserisci un titolo (massimo 180 caratteri).");
  if (description.length > 2000)
    throw new Error("La descrizione può contenere al massimo 2000 caratteri.");
  const { data, error } = await client!.rpc("update_document_details", {
    document_id: document.id,
    document_title: title.trim(),
    document_description: description.trim(),
    expected_updated_at: document.updated_at,
  });
  if (error?.code === "40001")
    throw new Error(
      "Il documento è cambiato da un’altra sessione. Torna all’elenco, aggiornalo e riapri il materiale prima di salvare.",
    );
  if (error || !data)
    throw new Error(
      "Dettagli non salvati. Verifica connessione, secondo fattore e aggiornamento Supabase v8.",
    );
  return oneDocument(data);
}
export async function fetchDocument(id: string): Promise<Blob> {
  const user = await identity();
  const { data, error } = await client!.auth.getSession();
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL,
    key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (error || !data.session?.access_token || !base || !key)
    throw new Error("Accedi nuovamente per scaricare il documento.");
  const response = await fetch(`${base}/functions/v1/document-file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "download", document_id: id }),
    cache: "no-store",
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? "Documento non disponibile o accesso revocato."
        : response.status === 401
          ? "Sessione scaduta. Accedi nuovamente."
          : "Download non riuscito. Verifica la connessione e l’attivazione della funzione document-file.",
    );
  const blob = await response.blob();
  if ((await identity()) !== user)
    throw new Error("Sessione cambiata: download annullato.");
  if (
    !blob.size ||
    blob.size > maxDocumentBytes ||
    !Object.values(documentTypes).includes(blob.type.split(";")[0])
  )
    throw new Error("Il file ricevuto non è valido.");
  return blob;
}
export function documentFormat(mime: string) {
  return mime === documentTypes.pdf
    ? "PDF"
    : mime === documentTypes.docx
      ? "Word"
      : "PowerPoint";
}
export function documentSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toLocaleString("it-IT", { maximumFractionDigits: 1 })} MB`
    : `${Math.ceil(bytes / 1024)} KB`;
}
