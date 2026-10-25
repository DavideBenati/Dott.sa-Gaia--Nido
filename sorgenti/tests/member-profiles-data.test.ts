import { expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  nicknameIssue,
  normalizeNickname,
  type MemberDirectoryResult,
  type MemberJourney,
  type MemberProfile,
  type SharedJourneyInput,
} from "@nido/core";
import {
  loadMemberDirectory,
  loadMemberProfile,
  saveNickname,
  saveSharedJourney,
} from "../packages/data/src/member-profiles";

const userId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const at = "2026-10-25T09:00:00.000Z";
const unshared: MemberProfile = {
  nickname: "Mamma 🌿",
  journey_shared: false,
  shared_journey: null,
  shared_interests: [],
  journey_consent_at: null,
  journey_consent_version: null,
  sharing_updated_at: null,
};
const shared: MemberProfile = {
  ...unshared,
  journey_shared: true,
  shared_journey: "pregnancy",
  shared_interests: ["birth_preparation", "wellbeing"],
  journey_consent_at: at,
  journey_consent_version: "2026-10-25-studio-v1",
  sharing_updated_at: at,
};
const identityResult: MemberDirectoryResult = {
  members: [
    {
      user_id: userId,
      nickname: "Mamma 🌿",
      email: "member@example.invalid",
      created_at: at,
      email_confirmed: true,
      journey_shared: false,
      shared_journey: null,
      shared_interests: [],
      sharing_updated_at: null,
    },
  ],
  total: 1,
  can_view_journeys: false,
  journey_membership: false,
  journey_mfa_required: false,
  mfa_satisfied: false,
};
function fixture(
  value: unknown = unshared,
  error: { code: string; message?: string } | null = null,
) {
  const getUser = vi.fn(async () => ({
    data: { user: { id: userId } as { id: string } | null },
    error: null as unknown,
  }));
  const rpc = vi.fn(async () => ({ data: value, error }));
  const from = vi.fn();
  const client = { auth: { getUser }, rpc, from } as unknown as SupabaseClient;
  return { client, getUser, rpc, from };
}

test("nickname validation uses canonical Unicode and codepoint lengths, without requiring unique or real names", () => {
  expect(normalizeNickname("  Cafe\u0301 🌿  ")).toBe("Café 🌿");
  expect(nicknameIssue("🌿🌸")).toBeNull();
  expect(nicknameIssue("🌿".repeat(40))).toBeNull();
  expect(nicknameIssue("🌿".repeat(41))).not.toBeNull();
  for (const nickname of [
    "",
    "A",
    "me@example.invalid",
    "<Gaia>",
    "A\nB",
    "A\u202eB",
    "A\u200bB",
    "A\ufeffB",
  ])
    expect(nicknameIssue(nickname), JSON.stringify(nickname)).not.toBeNull();
});

test("nickname saves canonical text with its own captured account guard", async () => {
  const f = fixture({ ...unshared, nickname: "Café 🌿" });
  const result = await saveNickname(f.client, "  Cafe\u0301 🌿  ");
  expect(result.nickname).toBe("Café 🌿");
  expect(f.getUser).toHaveBeenCalledOnce();
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith("set_my_nickname", {
    nickname: "Café 🌿",
    p_expected_user_id: userId,
  });
  expect(f.from).not.toHaveBeenCalled();
  const rejected = fixture();
  await expect(
    saveNickname(rejected.client, "me@example.invalid"),
  ).rejects.toThrow(/nickname/);
  expect(rejected.getUser).not.toHaveBeenCalled();
  expect(rejected.rpc).not.toHaveBeenCalled();
});

test("a changed signed-in account blocks nickname and sharing writes before any mutation RPC", async () => {
  const f = fixture();
  await expect(saveNickname(f.client, "Nickname", otherId)).rejects.toThrow(
    /account è cambiato/,
  );
  await expect(
    saveSharedJourney(
      f.client,
      { journey: "pregnancy", interests: [], share: true },
      otherId,
    ),
  ).rejects.toThrow(/account è cambiato/);
  expect(f.rpc).not.toHaveBeenCalled();
  await saveNickname(f.client, "Nickname", userId);
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith("set_my_nickname", {
    nickname: "Nickname",
    p_expected_user_id: userId,
  });
});

test("a server-detected account change during the RPC is surfaced without a retry or a target-account switch", async () => {
  const f = fixture(null, {
    code: "42501",
    message: "L’account è cambiato. Riapri il profilo prima di salvare.",
  });
  await expect(saveNickname(f.client, "Nickname", userId)).rejects.toThrow(
    /account è cambiato/,
  );
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith("set_my_nickname", {
    nickname: "Nickname",
    p_expected_user_id: userId,
  });
});

test("all profile operations require a real authenticated identity before invoking RPCs", async () => {
  const f = fixture();
  f.getUser.mockResolvedValue({ data: { user: null }, error: null });
  for (const call of [
    () => loadMemberProfile(f.client),
    () => loadMemberDirectory(f.client),
    () => saveNickname(f.client, "Nickname"),
    () =>
      saveSharedJourney(f.client, {
        journey: null,
        interests: [],
        share: false,
      }),
  ])
    await expect(call()).rejects.toThrow(/Accedi/);
  expect(f.rpc).not.toHaveBeenCalled();
});

test("missing configuration, denied access and network failures never masquerade as an empty profile or directory", async () => {
  for (const code of ["PGRST202", "42883", "42703"])
    await expect(
      loadMemberProfile(fixture(null, { code }).client),
    ).rejects.toThrow(/009/);
  for (const code of ["42501", "PGRST301"])
    await expect(
      loadMemberDirectory(fixture(null, { code }).client),
    ).rejects.toThrow(/non autorizzata/);
  await expect(
    loadMemberProfile(
      fixture(null, { code: "XX000", message: "Private server internals" })
        .client,
    ),
  ).rejects.toThrow(/Controlla la connessione/);
  const f = fixture();
  f.rpc.mockRejectedValue(new Error("Private network internals"));
  await expect(loadMemberProfile(f.client)).rejects.toThrow(
    /Controlla la connessione/,
  );
});

test("an empty legacy nickname is readable but malformed and contradictory sharing replies are rejected", async () => {
  expect(
    (await loadMemberProfile(fixture({ ...unshared, nickname: "" }).client))
      .nickname,
  ).toBe("");
  for (const value of [
    null,
    [],
    {},
    { ...unshared, nickname: "Bad@Name" },
    { ...unshared, shared_journey: "pregnancy" },
    { ...unshared, shared_interests: ["birth"] },
    { ...shared, journey_consent_at: null },
    { ...shared, shared_interests: ["diagnosis"] },
  ])
    await expect(loadMemberProfile(fixture(value).client)).rejects.toThrow(
      /correttamente/,
    );
});

test("sharing forwards only consented selections and the original version, not caller-supplied account or date fields", async () => {
  const f = fixture(shared);
  const input = {
    journey: "pregnancy",
    interests: ["wellbeing", "wellbeing", "birth_preparation"],
    share: true,
    expectedUpdatedAt: at,
    user_id: otherId,
    date: "2027-05-15",
  } as SharedJourneyInput;
  const result = await saveSharedJourney(f.client, input);
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith("save_my_shared_journey", {
    p_journey: "pregnancy",
    p_interests: ["wellbeing", "birth_preparation"],
    p_share: true,
    p_expected_updated_at: at,
    p_expected_user_id: userId,
  });
  result.shared_interests.push("newborn");
  expect(shared.shared_interests).toEqual(["birth_preparation", "wellbeing"]);
  const failed = fixture(null, { code: "40001" });
  await expect(
    saveSharedJourney(failed.client, {
      journey: "pregnancy",
      interests: [],
      share: true,
      expectedUpdatedAt: at,
    }),
  ).rejects.toThrow(/altro accesso/);
});

test("unknown selections cannot opt in, but revocation clears them even when the old snapshot is no longer valid", async () => {
  const f = fixture();
  for (const input of [
    { journey: "unknown" as MemberJourney, interests: [], share: true },
    { journey: "pregnancy" as const, interests: ["unknown"], share: true },
    { journey: null, interests: [], share: true },
    {
      journey: "pregnancy" as const,
      interests: [],
      share: true,
      expectedUpdatedAt: "not-a-date",
    },
  ])
    await expect(saveSharedJourney(f.client, input)).rejects.toThrow(
      /Scegli un percorso/,
    );
  expect(f.rpc).not.toHaveBeenCalled();
  f.rpc.mockResolvedValue({
    data: { ...unshared, sharing_updated_at: at },
    error: null,
  });
  await saveSharedJourney(f.client, {
    journey: "outdated" as MemberJourney,
    interests: ["outdated"],
    share: false,
    expectedUpdatedAt: "invalid-old-date",
  });
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith("save_my_shared_journey", {
    p_journey: null,
    p_interests: [],
    p_share: false,
    p_expected_updated_at: null,
    p_expected_user_id: userId,
  });
});

test("directory search remains literal and paginated, and duplicate nicknames remain distinguishable by stable account IDs", async () => {
  const value = {
    ...identityResult,
    members: [
      identityResult.members[0],
      {
        ...identityResult.members[0],
        user_id: otherId,
        email: "other@example.invalid",
      },
    ],
    total: 2,
  };
  const f = fixture(value);
  const result = await loadMemberDirectory(f.client, {
    term: "  %_\\'  ",
    page: 2,
  });
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith("member_directory", {
    search_term: "%_\\'",
    journey_filter: "all",
    page_offset: 40,
    page_limit: 20,
  });
  expect(result.members.map(({ nickname }) => nickname)).toEqual([
    "Mamma 🌿",
    "Mamma 🌿",
  ]);
  expect(new Set(result.members.map(({ user_id }) => user_id)).size).toBe(2);
  expect(f.from).not.toHaveBeenCalled();
});

test("directory parsing fails closed if a response leaks journeys to an editor or claims unsatisfied care permissions", async () => {
  for (const value of [
    {
      ...identityResult,
      members: [{ ...identityResult.members[0], ...shared }],
    },
    { ...identityResult, can_view_journeys: true },
    {
      ...identityResult,
      can_view_journeys: true,
      journey_membership: true,
      journey_mfa_required: true,
      mfa_satisfied: false,
    },
    {
      ...identityResult,
      members: [identityResult.members[0], identityResult.members[0]],
      total: 2,
    },
    { ...identityResult, total: 0 },
    null,
  ])
    await expect(loadMemberDirectory(fixture(value).client)).rejects.toThrow(
      /correttamente/,
    );
  const validCare = {
    ...identityResult,
    can_view_journeys: true,
    journey_membership: true,
    journey_mfa_required: true,
    mfa_satisfied: true,
    members: [
      {
        ...identityResult.members[0],
        journey_shared: true,
        shared_journey: "pregnancy",
        shared_interests: ["birth"],
        sharing_updated_at: at,
      },
    ],
  };
  expect(
    (await loadMemberDirectory(fixture(validCare).client)).members[0]
      .shared_journey,
  ).toBe("pregnancy");
});

test("invalid directory arguments are rejected locally rather than silently truncating searches or changing filters", async () => {
  const f = fixture(identityResult);
  for (const input of [
    { term: "x".repeat(255) },
    { page: -1 },
    { page: 1.5 },
    { page: 1_000_001 },
    { journey: "unknown" as MemberJourney },
  ])
    await expect(loadMemberDirectory(f.client, input)).rejects.toThrow(
      /Controlla ricerca/,
    );
  expect(f.getUser).not.toHaveBeenCalled();
  expect(f.rpc).not.toHaveBeenCalled();
});
