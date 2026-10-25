import {
  emptyPregnancyProfile,
  type PregnancyProfile,
  type PregnancyProfileInput,
} from "@nido/core";
import type { SupabaseClient } from "@nido/data";

/** No clinical data is copied to auth metadata, preferences or device storage. */
export async function pregnancyProfileOwner(
  client: SupabaseClient,
): Promise<string> {
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.user.id)
    throw new Error("Accedi per usare la scheda gravidanza.");
  return data.session.user.id;
}

async function assertSameOwner(client: SupabaseClient, owner: string) {
  if ((await pregnancyProfileOwner(client)) !== owner)
    throw new Error(
      "L’account è cambiato. Riapri il profilo prima di continuare.",
    );
}

function profileResult(value: unknown): PregnancyProfile | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Scheda gravidanza non disponibile. Riprova.");
  const profile = value as Partial<PregnancyProfile>;
  if (
    typeof profile.storage_consent !== "boolean" ||
    (profile.updated_at !== null && typeof profile.updated_at !== "string")
  )
    throw new Error("Scheda gravidanza non disponibile. Riprova.");
  // A revoked tombstone retains only its exact concurrency token.
  if (!profile.storage_consent)
    return {
      ...emptyPregnancyProfile(),
      updated_at: profile.updated_at ?? null,
      consent_version: profile.consent_version ?? null,
    };
  return { ...emptyPregnancyProfile(), ...profile } as PregnancyProfile;
}

function rpcIssue(error: { code?: string } | null): Error {
  if (error?.code === "40001")
    return new Error(
      "La scheda è cambiata. Ricarica i dati prima di salvare nuovamente.",
    );
  if (error?.code === "42501")
    return new Error(
      "Accesso non disponibile. Verifica l’account e il codice di sicurezza richiesto.",
    );
  if (error?.code === "22023")
    return new Error(
      "Controlla le date, le settimane e i consensi prima di salvare.",
    );
  return new Error("La scheda gravidanza non è disponibile. Riprova.");
}

export async function loadMyPregnancyProfile(
  client: SupabaseClient,
  expectedUserId?: string,
): Promise<PregnancyProfile | null> {
  const owner = await pregnancyProfileOwner(client);
  if (expectedUserId && owner !== expectedUserId)
    throw new Error(
      "L’account è cambiato. Riapri il profilo prima di continuare.",
    );
  const { data, error } = await client.rpc("my_pregnancy_profile");
  await assertSameOwner(client, owner);
  if (error) throw rpcIssue(error);
  return profileResult(data);
}

export async function saveMyPregnancyProfile(
  client: SupabaseClient,
  profile: PregnancyProfileInput,
  expectedUpdatedAt: string | null,
  expectedUserId: string,
): Promise<PregnancyProfile> {
  await assertSameOwner(client, expectedUserId);
  const { data, error } = await client.rpc("save_my_pregnancy_profile", {
    p_profile: profile,
    p_expected_updated_at: expectedUpdatedAt,
    p_expected_user_id: expectedUserId,
  });
  await assertSameOwner(client, expectedUserId);
  if (error) throw rpcIssue(error);
  const result = profileResult(data);
  if (!result)
    throw new Error(
      "Scheda gravidanza non salvata. Ricarica prima di riprovare.",
    );
  return result;
}

export async function revokeMyPregnancyProfile(
  client: SupabaseClient,
  expectedUserId: string,
): Promise<PregnancyProfile> {
  await assertSameOwner(client, expectedUserId);
  const { data, error } = await client.rpc("revoke_my_pregnancy_profile", {
    p_expected_user_id: expectedUserId,
  });
  await assertSameOwner(client, expectedUserId);
  if (error) throw rpcIssue(error);
  const result = profileResult(data);
  if (!result) throw new Error("Revoca non confermata. Ricarica la scheda.");
  return result;
}

export async function loadMemberPregnancyProfile(
  client: SupabaseClient,
  userId: string,
): Promise<PregnancyProfile | null> {
  const owner = await pregnancyProfileOwner(client);
  const { data, error } = await client.rpc("read_member_pregnancy_profile", {
    p_user_id: userId,
  });
  await assertSameOwner(client, owner);
  if (error) throw rpcIssue(error);
  return profileResult(data);
}

async function revokePurpose(
  client: SupabaseClient,
  expectedUserId: string,
  rpc: "revoke_my_pregnancy_sharing" | "revoke_my_pregnancy_personalization",
): Promise<PregnancyProfile> {
  await assertSameOwner(client, expectedUserId);
  const { data, error } = await client.rpc(rpc, {
    p_expected_user_id: expectedUserId,
  });
  await assertSameOwner(client, expectedUserId);
  if (error) throw rpcIssue(error);
  const result = profileResult(data);
  if (!result) throw new Error("Revoca non confermata. Ricarica la scheda.");
  return result;
}

export const revokeMyPregnancySharing = (
  client: SupabaseClient,
  expectedUserId: string,
) => revokePurpose(client, expectedUserId, "revoke_my_pregnancy_sharing");
export const revokeMyPregnancyPersonalization = (
  client: SupabaseClient,
  expectedUserId: string,
) =>
  revokePurpose(client, expectedUserId, "revoke_my_pregnancy_personalization");
