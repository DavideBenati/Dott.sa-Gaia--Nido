import { client } from "./state";
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
  const { data, error } = await client.rpc(name, args);
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
  return rpc("create_video_call_invitation", {
    p_recipient_id: user,
    p_room_url: hostpointRoom(room),
    p_expected_user_id: owner,
  });
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
