import type { SupabaseClient } from "@supabase/supabase-js";

export interface MemberMilestones {
  first_recommendation_selected: boolean;
}

const accountChanged =
  "L’account è cambiato. Riapri i consigli dell’account attuale prima di salvare.";
const unavailable =
  "Traguardi non disponibili. Controlla la connessione e riprova.";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authenticated(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser().catch(() => {
    throw new Error(unavailable);
  });
  if (error || typeof data?.user?.id !== "string" || !uuid.test(data.user.id))
    throw new Error("Accedi al tuo account per leggere i tuoi traguardi.");
  return data.user.id;
}

function milestones(value: unknown): MemberMilestones {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !("first_recommendation_selected" in value) ||
    typeof value.first_recommendation_selected !== "boolean"
  )
    throw new Error("Risposta dei traguardi non valida. Riprova.");
  return { first_recommendation_selected: value.first_recommendation_selected };
}

async function invoke(
  client: SupabaseClient,
  mutation: boolean,
  expectedUserId?: string,
): Promise<MemberMilestones> {
  const owner = await authenticated(client);
  if (
    (mutation && expectedUserId === undefined) ||
    (expectedUserId !== undefined && expectedUserId !== owner)
  )
    throw new Error(accountChanged);
  const { data, error } = await client
    .rpc(
      mutation
        ? "record_first_recommendation_selection"
        : "my_member_milestones",
      mutation ? { p_expected_user_id: owner } : undefined,
    )
    .then(
      (result) => result,
      () => {
        throw new Error(unavailable);
      },
    );
  if ((await authenticated(client)) !== owner) throw new Error(accountChanged);
  if (error) {
    if (["PGRST202", "42883", "42703"].includes(error.code ?? ""))
      throw new Error("I traguardi richiedono l’aggiornamento Supabase 015.");
    if (error.code === "42501")
      throw new Error("Operazione non autorizzata. Verifica il tuo account.");
    throw new Error(unavailable);
  }
  return milestones(data);
}

export function loadMemberMilestones(
  client: SupabaseClient,
  expectedUserId?: string,
): Promise<MemberMilestones> {
  return invoke(client, false, expectedUserId);
}

export function recordFirstRecommendationSelection(
  client: SupabaseClient,
  expectedUserId: string,
): Promise<MemberMilestones> {
  return invoke(client, true, expectedUserId);
}
