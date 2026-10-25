import type { SupabaseClient } from "@supabase/supabase-js";
import {
  memberInterestOptions,
  memberJourneyOptions,
  nicknameIssue,
  normalizeNickname,
  type MemberDirectoryEntry,
  type MemberDirectoryResult,
  type MemberInterest,
  type MemberJourney,
  type MemberProfile,
  type SharedJourneyInput,
} from "@nido/core";

const invalidResponse =
  "Non riusciamo a leggere correttamente i profili. Riprova prima di modificare i dati.";
const unavailable =
  "Profili non disponibili. Controlla la connessione e riprova.";
const setupRequired =
  "Nickname e schede richiedono l’aggiornamento Supabase 009. Completa la configurazione e riprova.";
const accountChanged =
  "L’account è cambiato. Riapri il profilo dell’account attuale prima di salvare.";
const memberInterests = new Set<string>(
  memberInterestOptions.map(({ id }) => id),
);
const memberJourneys = new Set<string>(
  memberJourneyOptions.map(({ id }) => id),
);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function nullableDate(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" && Number.isFinite(Date.parse(value)))
  );
}
function readNickname(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value === "" ||
      (value === normalizeNickname(value) && nicknameIssue(value) === null))
  );
}
function readJourney(value: unknown): value is MemberJourney | null {
  return (
    value === null || (typeof value === "string" && memberJourneys.has(value))
  );
}
function readInterests(value: unknown): value is MemberInterest[] {
  return (
    Array.isArray(value) &&
    value.length <= memberInterests.size &&
    new Set(value).size === value.length &&
    value.every(
      (interest) =>
        typeof interest === "string" && memberInterests.has(interest),
    )
  );
}
function sharedFieldsValid(value: Record<string, unknown>): boolean {
  return (
    typeof value.journey_shared === "boolean" &&
    readJourney(value.shared_journey) &&
    readInterests(value.shared_interests) &&
    nullableDate(value.sharing_updated_at) &&
    (value.journey_shared
      ? value.shared_journey !== null
      : value.shared_journey === null && value.shared_interests.length === 0)
  );
}

function profile(value: unknown): MemberProfile {
  if (
    !record(value) ||
    !readNickname(value.nickname) ||
    !sharedFieldsValid(value) ||
    !nullableDate(value.journey_consent_at) ||
    !(
      value.journey_consent_version === null ||
      (typeof value.journey_consent_version === "string" &&
        value.journey_consent_version.length > 0 &&
        value.journey_consent_version.length <= 100)
    ) ||
    (value.journey_shared
      ? value.journey_consent_at === null ||
        value.journey_consent_version === null
      : value.journey_consent_at !== null ||
        value.journey_consent_version !== null)
  )
    throw new Error(invalidResponse);
  return {
    nickname: value.nickname,
    journey_shared: value.journey_shared as boolean,
    shared_journey: value.shared_journey as MemberJourney | null,
    shared_interests: [...(value.shared_interests as MemberInterest[])],
    journey_consent_at: value.journey_consent_at,
    journey_consent_version: value.journey_consent_version,
    sharing_updated_at: value.sharing_updated_at as string | null,
  };
}

function directory(value: unknown): MemberDirectoryResult {
  if (
    !record(value) ||
    !Array.isArray(value.members) ||
    value.members.length > 20 ||
    !Number.isSafeInteger(value.total) ||
    (value.total as number) < value.members.length ||
    ![
      "can_view_journeys",
      "journey_membership",
      "journey_mfa_required",
      "mfa_satisfied",
    ].every((key) => typeof value[key] === "boolean") ||
    (value.can_view_journeys &&
      (!value.journey_membership ||
        (value.journey_mfa_required && !value.mfa_satisfied)))
  )
    throw new Error(invalidResponse);
  const members = value.members.map((entry): MemberDirectoryEntry => {
    if (
      !record(entry) ||
      typeof entry.user_id !== "string" ||
      !uuid.test(entry.user_id) ||
      !readNickname(entry.nickname) ||
      typeof entry.email !== "string" ||
      entry.email.length > 320 ||
      typeof entry.created_at !== "string" ||
      !Number.isFinite(Date.parse(entry.created_at)) ||
      typeof entry.email_confirmed !== "boolean" ||
      !sharedFieldsValid(entry) ||
      (!value.can_view_journeys &&
        (entry.journey_shared || entry.sharing_updated_at !== null))
    )
      throw new Error(invalidResponse);
    return {
      user_id: entry.user_id,
      nickname: entry.nickname,
      email: entry.email,
      created_at: entry.created_at,
      email_confirmed: entry.email_confirmed,
      journey_shared: entry.journey_shared as boolean,
      shared_journey: entry.shared_journey as MemberJourney | null,
      shared_interests: [...(entry.shared_interests as MemberInterest[])],
      sharing_updated_at: entry.sharing_updated_at as string | null,
    };
  });
  if (new Set(members.map(({ user_id }) => user_id)).size !== members.length)
    throw new Error(invalidResponse);
  return {
    members,
    total: value.total as number,
    can_view_journeys: value.can_view_journeys as boolean,
    journey_membership: value.journey_membership as boolean,
    journey_mfa_required: value.journey_mfa_required as boolean,
    mfa_satisfied: value.mfa_satisfied as boolean,
  };
}

async function authenticated(client: SupabaseClient) {
  const { data, error } = await client.auth.getUser().catch(() => {
    throw new Error(unavailable);
  });
  if (error || typeof data?.user?.id !== "string" || !uuid.test(data.user.id))
    throw new Error("Accedi al tuo account per usare nickname e schede.");
  return data.user.id;
}
type ServiceError = { code?: string; message?: string } | null;
function check(error: ServiceError) {
  if (!error) return;
  if (["PGRST202", "42883", "42703"].includes(error.code ?? ""))
    throw new Error(setupRequired);
  if (error.code === "42501" && error.message?.includes("account è cambiato"))
    throw new Error(accountChanged);
  if (["42501", "PGRST301", "PGRST302"].includes(error.code ?? ""))
    throw new Error(
      "Operazione non autorizzata. Verifica l’account, i permessi e il codice a due fattori quando richiesto.",
    );
  if (error.code === "22023")
    throw new Error(
      "Controlla nickname, percorso e interessi selezionati e riprova.",
    );
  if (error.code === "40001")
    throw new Error(
      "Il percorso è cambiato da un altro accesso. Aggiorna i dati e rivedi la condivisione prima di salvare.",
    );
  throw new Error(unavailable);
}
async function invoke(
  client: SupabaseClient,
  name: string,
  params?: Record<string, unknown>,
  expectedUserId?: string,
  selfMutation = false,
) {
  const actualUserId = await authenticated(client);
  if (expectedUserId !== undefined && expectedUserId !== actualUserId)
    throw new Error(accountChanged);
  const safeParams = selfMutation
    ? { ...params, p_expected_user_id: actualUserId }
    : params;
  const { data, error } = await client.rpc(name, safeParams).then(
    (result) => result,
    () => {
      throw new Error(unavailable);
    },
  );
  check(error);
  return data as unknown;
}

export async function loadMemberProfile(
  client: SupabaseClient,
): Promise<MemberProfile> {
  return profile(await invoke(client, "my_member_profile"));
}

export async function saveNickname(
  client: SupabaseClient,
  nickname: string,
  expectedUserId?: string,
): Promise<MemberProfile> {
  if (typeof nickname !== "string")
    throw new Error("Scrivi un nickname valido.");
  const issue = nicknameIssue(nickname);
  if (issue) throw new Error(issue);
  return profile(
    await invoke(
      client,
      "set_my_nickname",
      { nickname: normalizeNickname(nickname) },
      expectedUserId,
      true,
    ),
  );
}

export async function saveSharedJourney(
  client: SupabaseClient,
  { journey, interests, share, expectedUpdatedAt = null }: SharedJourneyInput,
  expectedUserId?: string,
): Promise<MemberProfile> {
  if (typeof share !== "boolean")
    throw new Error("Scegli se condividere il percorso con Gaia.");
  if (
    share &&
    (!readJourney(journey) ||
      journey === null ||
      !Array.isArray(interests) ||
      interests.some((interest) => !memberInterests.has(interest)) ||
      !nullableDate(expectedUpdatedAt))
  )
    throw new Error(
      "Scegli un percorso e gli interessi fra quelli disponibili.",
    );
  // Revocation never depends on old selections being valid or still available.
  return profile(
    await invoke(
      client,
      "save_my_shared_journey",
      {
        p_journey: share ? journey : null,
        p_interests: share ? [...new Set(interests)] : [],
        p_share: share,
        p_expected_updated_at: nullableDate(expectedUpdatedAt)
          ? expectedUpdatedAt
          : null,
      },
      expectedUserId,
      true,
    ),
  );
}

export async function loadMemberDirectory(
  client: SupabaseClient,
  {
    term = "",
    journey = "all",
    page = 0,
  }: { term?: string; journey?: MemberJourney | "all"; page?: number } = {},
): Promise<MemberDirectoryResult> {
  if (
    typeof term !== "string" ||
    term.trim().length > 254 ||
    (journey !== "all" && !memberJourneys.has(journey)) ||
    !Number.isSafeInteger(page) ||
    page < 0 ||
    page > 1_000_000
  )
    throw new Error("Controlla ricerca, percorso e pagina selezionati.");
  return directory(
    await invoke(client, "member_directory", {
      search_term: term.trim(),
      journey_filter: journey,
      page_offset: page * 20,
      page_limit: 20,
    }),
  );
}
