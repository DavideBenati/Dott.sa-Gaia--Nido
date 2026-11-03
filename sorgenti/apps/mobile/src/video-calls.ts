import { client } from "./state";
export type CallEmailState =
  "not_sent" | "sending" | "accepted" | "retry" | "failed" | "uncertain";
export type CallEmailStatus = {
  invitation_id: string;
  status: CallEmailState;
  accepted_at: string | null;
};
export type CallRecipient = {
  user_id: string;
  email: string;
  nickname: string;
};
export type CallInvitation = {
  id: string;
  recipient_id: string;
  nickname: string;
  email: string;
  expires_at: string;
};
const unavailable =
  "Videochiamate non disponibili. Verifica la connessione o completa la configurazione Supabase 010.";
export function hostpointRoom(value: string): string {
  const clean = value.trim();
  if (!/^https:\/\/meet\.hostpoint\.ch\/[A-Za-z0-9_-]{8,200}$/.test(clean))
    throw new Error(
      "Incolla un link meet.hostpoint.ch con un nome stanza di almeno 8 caratteri, senza parametri.",
    );
  return clean;
}
async function identity() {
  if (!client) throw new Error(unavailable);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Accedi per vedere gli inviti.");
  return data.user.id;
}
async function rpc(name: string, args: Record<string, unknown>) {
  if (!client) throw new Error(unavailable);
  const owner = await identity();
  const { data, error } = await client.rpc(name, args);
  if ((await identity()) !== owner)
    throw new Error("Sessione cambiata: ripeti l’accesso.");
  if (error)
    throw new Error(
      error.code === "PGRST202" || error.code === "42883"
        ? unavailable
        : error.message || unavailable,
    );
  return data;
}
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const recipient = (value: unknown): value is CallRecipient => {
  const r = value as CallRecipient;
  return Boolean(
    r &&
    uuid(r.user_id) &&
    typeof r.email === "string" &&
    typeof r.nickname === "string",
  );
};
export async function searchCallRecipients(
  term: string,
): Promise<CallRecipient[]> {
  await identity();
  if (term.trim().length < 2) return [];
  const data = await rpc("search_video_call_users", {
    search_term: term.trim(),
  });
  if (!Array.isArray(data) || data.length > 20 || !data.every(recipient))
    throw new Error(unavailable);
  return data;
}
export async function listCallInvitations(
  manage: boolean,
): Promise<CallInvitation[]> {
  await identity();
  const data = await rpc("list_video_call_invitations", { manage });
  if (
    !Array.isArray(data) ||
    data.length > 50 ||
    !data.every(
      (r: CallInvitation) =>
        r &&
        uuid(r.id) &&
        uuid(r.recipient_id) &&
        typeof r.email === "string" &&
        typeof r.nickname === "string" &&
        Number.isFinite(Date.parse(r.expires_at)),
    )
  )
    throw new Error(unavailable);
  return data;
}
export async function createCallInvitation(user: string, room: string) {
  const owner = await identity();
  if (!uuid(user)) throw new Error("Scegli un account dall’elenco.");
  const id = await rpc("create_video_call_invitation", {
    p_recipient_id: user,
    p_room_url: hostpointRoom(room),
    p_expected_user_id: owner,
  });
  if (!uuid(id)) throw new Error(unavailable);
  return id;
}
export async function revokeCallInvitation(id: string) {
  const owner = await identity();
  await rpc("revoke_video_call_invitation", {
    p_invitation_id: id,
    p_expected_user_id: owner,
  });
}
export async function openCallInvitation(id: string) {
  const owner = await identity();
  const data = await rpc("open_video_call_invitation", {
    p_invitation_id: id,
    p_expected_user_id: owner,
  });
  if (typeof data !== "string") throw new Error(unavailable);
  return hostpointRoom(data);
}

const emailStates: CallEmailState[] = [
  "not_sent",
  "sending",
  "accepted",
  "retry",
  "failed",
  "uncertain",
];
function emailStatus(value: unknown): value is CallEmailStatus {
  if (!value || typeof value !== "object") return false;
  const row = value as CallEmailStatus;
  return (
    uuid(row.invitation_id) &&
    emailStates.includes(row.status) &&
    (row.accepted_at === null ||
      (typeof row.accepted_at === "string" &&
        Number.isFinite(Date.parse(row.accepted_at))))
  );
}
export async function listCallEmailStatus(
  ids: string[],
): Promise<CallEmailStatus[]> {
  if (!ids.length) return [];
  const data = await rpc("list_video_call_email_status", {
    p_invitation_ids: ids,
  });
  if (
    !Array.isArray(data) ||
    data.length !== ids.length ||
    !data.every(emailStatus) ||
    new Set(data.map((row) => row.invitation_id)).size !== ids.length ||
    data.some((row) => !ids.includes(row.invitation_id))
  )
    throw new Error(
      "Stato email non disponibile. Aggiorna gli inviti per riprovare.",
    );
  return data;
}
export async function sendCallInvitation(
  id: string,
): Promise<Omit<CallEmailStatus, "invitation_id">> {
  const owner = await identity();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const { data, error } = await client!.functions.invoke(
      "video-call-invite",
      {
        body: { invitation_id: id },
        signal: controller.signal,
      },
    );
    if ((await identity()) !== owner) throw new Error("Sessione cambiata.");
    if (
      error ||
      !emailStatus({ ...data, invitation_id: id }) ||
      data.status === "not_sent"
    )
      throw new Error("Invio non confermato.");
    return data;
  } catch {
    throw new Error(
      "Invio email non confermato. La videochiamata resta salvata: aggiorna gli inviti per controllare l’esito prima di riprovare.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
