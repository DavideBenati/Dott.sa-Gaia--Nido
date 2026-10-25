import { nicknameIssue, normalizeNickname } from "@nido/core";
import { client } from "./state";

export type FamilyLink = {
  id: string;
  nickname: string;
  status: "pending" | "approved" | "declined" | "revoked" | "expired";
};
export type FamilySharing = { incoming: FamilyLink[]; outgoing: FamilyLink[] };
export type FamilyInvite = { code: string; expires_at: string };
export type FamilySnapshot = {
  nickname: string;
  checklists: {
    id: string;
    title: string;
    items: { id: string; label: string; completed: boolean }[];
  }[];
  articles: { id: string; title: string }[];
};
const unavailable =
  "Condivisioni non disponibili. Controlla la connessione o completa l’aggiornamento Supabase 012.";
const accountChanged = "L’account è cambiato. Riapri le condivisioni.";
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const record = (v: unknown): v is Record<string, unknown> =>
  Boolean(v && typeof v === "object" && !Array.isArray(v));
const fields = (v: Record<string, unknown>, names: string[]) =>
  Object.keys(v).length === names.length && names.every((name) => name in v);
function link(v: unknown): v is FamilyLink {
  return (
    record(v) &&
    fields(v, ["id", "nickname", "status"]) &&
    uuid(v.id) &&
    typeof v.nickname === "string" &&
    ["pending", "approved", "declined", "revoked", "expired"].includes(
      v.status as string,
    )
  );
}
async function identity() {
  if (!client) throw new Error(unavailable);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error("Accedi con un account confermato.");
  return data.user.id;
}
async function rpc(name: string, args: Record<string, unknown> = {}) {
  const owner = await identity();
  if (!client) throw new Error(unavailable);
  const { data, error } = await client.rpc(name, {
    ...args,
    p_expected_user_id: owner,
  });
  // Discard responses from a request started by a previous account.
  if ((await identity()) !== owner) throw new Error(accountChanged);
  if (error)
    throw new Error(
      error.code === "PGRST202" || error.code === "42883"
        ? unavailable
        : error.message || unavailable,
    );
  return data as unknown;
}
function grant(id: string) {
  if (!uuid(id)) throw new Error("Scegli un collegamento dall’elenco.");
  return id;
}
export async function loadFamilySharing(): Promise<FamilySharing> {
  const data = await rpc("list_family_sharing");
  if (
    !record(data) ||
    !fields(data, ["incoming", "outgoing"]) ||
    !Array.isArray(data.incoming) ||
    !Array.isArray(data.outgoing) ||
    !data.incoming.every(link) ||
    !data.outgoing.every(link)
  )
    throw new Error(unavailable);
  return { incoming: data.incoming, outgoing: data.outgoing };
}
export async function createFamilyInvite(): Promise<FamilyInvite> {
  const data = await rpc("create_family_invite");
  if (
    !record(data) ||
    !fields(data, ["code", "expires_at"]) ||
    typeof data.code !== "string" ||
    !/^[a-f0-9]{64}$/.test(data.code) ||
    typeof data.expires_at !== "string" ||
    !Number.isFinite(Date.parse(data.expires_at))
  )
    throw new Error(unavailable);
  return { code: data.code, expires_at: data.expires_at };
}
export async function requestFamilyShare(nickname: string, code: string) {
  const issue = nicknameIssue(nickname);
  if (issue) throw new Error(issue);
  const cleanCode = code.trim();
  if (!/^[a-f0-9]{64}$/.test(cleanCode))
    throw new Error(
      "Incolla il codice privato completo ricevuto dalla persona.",
    );
  const data = await rpc("request_family_share", {
    p_nickname: normalizeNickname(nickname),
    p_code: cleanCode,
  });
  if (!uuid(data)) throw new Error(unavailable);
  return data;
}
export async function decideFamilyShareRequest(id: string, approve: boolean) {
  await rpc("decide_family_share_request", {
    p_grant_id: grant(id),
    p_approve: approve,
  });
}
export async function revokeFamilyShare(id: string) {
  await rpc("revoke_family_share", { p_grant_id: grant(id) });
}
export async function loadFamilySnapshot(id: string): Promise<FamilySnapshot> {
  const data = await rpc("family_shared_snapshot", { p_grant_id: grant(id) });
  if (
    !record(data) ||
    !fields(data, ["nickname", "checklists", "articles"]) ||
    typeof data.nickname !== "string" ||
    !Array.isArray(data.checklists) ||
    !data.checklists.every(
      (c: unknown) =>
        record(c) &&
        fields(c, ["id", "title", "items"]) &&
        uuid(c.id) &&
        typeof c.title === "string" &&
        Array.isArray(c.items) &&
        c.items.every(
          (i: unknown) =>
            record(i) &&
            fields(i, ["id", "label", "completed"]) &&
            uuid(i.id) &&
            typeof i.label === "string" &&
            typeof i.completed === "boolean",
        ),
    ) ||
    !Array.isArray(data.articles) ||
    !data.articles.every(
      (a: unknown) =>
        record(a) &&
        fields(a, ["id", "title"]) &&
        uuid(a.id) &&
        typeof a.title === "string",
    )
  )
    throw new Error(unavailable);
  return data as FamilySnapshot;
}
