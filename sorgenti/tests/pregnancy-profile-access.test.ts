import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const owner = "11111111-1111-4111-8111-111111111111";
const family = "22222222-2222-4222-8222-222222222222";
const editor = "33333333-3333-4333-8333-333333333333";
const gaia = "44444444-4444-4444-8444-444444444444";
let db: PGlite;
let today: string;
let lastMenstrualDate: string;
type Profile = Record<string, unknown> & { updated_at: string };

async function asUser(id: string | null, aal = "aal1") {
  await db.exec("reset role; set role authenticated");
  await db.query(
    "select set_config('test.uid',$1,false),set_config('test.aal',$2,false)",
    [id ?? "", aal],
  );
}
async function rpc(name: string, expected = owner) {
  return (
    await db.query<{ value: Profile | null }>(`select ${name}($1) as value`, [
      expected,
    ])
  ).rows[0].value;
}
function input(patch: Record<string, unknown> = {}) {
  return {
    storage_consent: true,
    gaia_share_consent: false,
    personalization_consent: false,
    last_menstrual_date: lastMenstrualDate,
    ultrasound_matches: true,
    previous_pregnancies: true,
    previous_outcomes: ["spontaneous", "cesarean"],
    ...patch,
  };
}
async function save(
  value = input(),
  version: string | null = null,
  expected = owner,
) {
  return (
    await db.query<{ value: Profile }>(
      "select save_my_pregnancy_profile($1,$2,$3) as value",
      [JSON.stringify(value), version, expected],
    )
  ).rows[0].value;
}
async function own() {
  return (
    await db.query<{ value: Profile | null }>(
      "select my_pregnancy_profile() as value",
    )
  ).rows[0].value;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',coalesce(current_setting('test.aal',true),'aal1'))$$;
    create table private.editor_memberships(user_id uuid primary key references auth.users(id) on delete cascade,active boolean default true,require_mfa boolean default false);
    create table private.member_profile_staff(user_id uuid primary key references auth.users(id) on delete cascade,active boolean default true,require_mfa boolean default true);
    grant usage on schema public,auth to anon,authenticated;
  `);
  // Execute the production predicates: ordinary editors never substitute for
  // the dedicated member-profile membership or the clinical MFA requirement.
  for (const [file, pattern] of [
    [
      "202610230005_professional_workspace.sql",
      /create or replace function public\.is_editor\(\)[\s\S]*?\$\$;/,
    ],
    [
      "202610250009_member_profiles.sql",
      /create function public\.can_view_member_journeys\(\)[\s\S]*?\$\$;/,
    ],
  ] as const) {
    const source = await readFile(
      new URL("../supabase/migrations/" + file, import.meta.url),
      "utf8",
    );
    const predicate = source.match(pattern)?.[0];
    if (!predicate)
      throw new Error("Production authorization predicate missing");
    await db.exec(predicate);
  }
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610250013_pregnancy_profile.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
beforeEach(async () => {
  await db.exec("reset role; truncate auth.users cascade");
  for (const id of [owner, family, editor, gaia]) {
    await db.query("insert into auth.users values($1)", [id]);
  }
  await db.query(
    "insert into private.editor_memberships(user_id) values($1),($2)",
    [editor, gaia],
  );
  await db.query(
    "insert into private.member_profile_staff(user_id,require_mfa) values($1,false)",
    [gaia],
  );
  const dates = (
    await db.query<{ today: string; lmp: string }>(
      "select (clock_timestamp() at time zone 'Europe/Rome')::date::text as today, ((clock_timestamp() at time zone 'Europe/Rome')::date - 80)::text as lmp",
    )
  ).rows[0];
  today = dates.today;
  lastMenstrualDate = dates.lmp;
  await asUser(owner);
});
afterAll(async () => db.close());

test("clinical values require explicit storage consent, the current owner and exact version", async () => {
  expect(await own()).toBeNull();
  await expect(save(input({ storage_consent: false }))).rejects.toMatchObject({
    code: "22023",
  });
  await expect(save(input(), null, family)).rejects.toMatchObject({
    code: "42501",
  });
  const first = await save();
  await expect(save()).rejects.toMatchObject({ code: "40001" });
  const next = await save(input(), first.updated_at);
  expect(next.updated_at).not.toBe(first.updated_at);
  await asUser(family);
  expect(await own()).toBeNull();
  await expect(save(input(), next.updated_at, owner)).rejects.toMatchObject({
    code: "42501",
  });
  await expect(
    db.query("select * from private.pregnancy_profiles"),
  ).rejects.toMatchObject({ code: "42501" });
  await asUser(null);
  await expect(own()).rejects.toMatchObject({ code: "42501" });
});

test("Gaia sees only consented target data with dedicated membership and MFA; family and editors cannot", async () => {
  const privateProfile = await save();
  await asUser(gaia, "aal2");
  expect(await rpc("read_member_pregnancy_profile")).toBeNull();
  await asUser(owner);
  await save(input({ gaia_share_consent: true }), privateProfile.updated_at);
  for (const [id, aal] of [
    [family, "aal2"],
    [editor, "aal2"],
    [gaia, "aal1"],
  ]) {
    await asUser(id, aal);
    await expect(rpc("read_member_pregnancy_profile")).rejects.toMatchObject({
      code: "42501",
    });
  }
  await asUser(gaia, "aal2");
  expect(await rpc("read_member_pregnancy_profile")).toMatchObject({
    gaia_share_consent: true,
    last_menstrual_date: lastMenstrualDate,
  });
  await db.exec("reset role");
  await db.query(
    "update private.member_profile_staff set active=false where user_id=$1",
    [gaia],
  );
  await asUser(gaia, "aal2");
  await expect(rpc("read_member_pregnancy_profile")).rejects.toMatchObject({
    code: "42501",
  });
});

test("storage withdrawal clears clinical values and blocks stale edits including a never-saved draft", async () => {
  const shared = await save(input({ gaia_share_consent: true }));
  const revoked = await rpc("revoke_my_pregnancy_profile");
  expect(revoked).toMatchObject({
    storage_consent: false,
    gaia_share_consent: false,
    personalization_consent: false,
    last_menstrual_date: null,
    previous_outcomes: [],
  });
  await expect(save(input(), shared.updated_at)).rejects.toMatchObject({
    code: "40001",
  });
  await expect(save()).rejects.toMatchObject({ code: "40001" });
  await asUser(gaia, "aal2");
  expect(await rpc("read_member_pregnancy_profile")).toBeNull();
  await asUser(owner);
  await save(input(), revoked!.updated_at);
  await db.exec("reset role");
  await db.query("delete from auth.users where id=$1", [owner]);
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from private.pregnancy_profiles",
      )
    ).rows[0].count,
  ).toBe(0);
});

test("individual sharing and personalization withdrawal remains immediate after 43 weeks", async () => {
  const saved = await save(
    input({ gaia_share_consent: true, personalization_consent: true }),
  );
  await db.exec("reset role");
  await db.query(
    "update private.pregnancy_profiles set last_menstrual_date=(clock_timestamp() at time zone 'Europe/Rome')::date-310 where user_id=$1",
    [owner],
  );
  await asUser(owner);
  const unshared = await rpc("revoke_my_pregnancy_sharing");
  expect(unshared).toMatchObject({
    storage_consent: true,
    gaia_share_consent: false,
    personalization_consent: true,
  });
  const unpersonalized = await rpc("revoke_my_pregnancy_personalization");
  expect(unpersonalized).toMatchObject({
    storage_consent: true,
    gaia_share_consent: false,
    personalization_consent: false,
  });
  expect(unpersonalized!.updated_at).not.toBe(saved.updated_at);
  await expect(save(input(), saved.updated_at)).rejects.toMatchObject({
    code: "40001",
  });
  await expect(
    rpc("revoke_my_pregnancy_sharing", family),
  ).rejects.toMatchObject({ code: "42501" });
});

test("dating and past-outcome validation rejects impossible values and preserves an unchanged historical ultrasound reference", async () => {
  const manual = input({
    last_menstrual_date: null,
    ultrasound_matches: false,
    ultrasound_weeks: 12,
    ultrasound_days: 4,
    ultrasound_reference_date: today,
  });
  const saved = await save(manual);
  for (const patch of [
    { ultrasound_days: 7 },
    { ultrasound_weeks: 43, ultrasound_days: 1 },
    { last_menstrual_date: "2026-02-30" },
    { last_menstrual_date: "9999-01-01" },
    { ultrasound_matches: "false" },
    { ultrasound_reference_date: "2020-01-01" },
    { previous_pregnancies: false, previous_outcomes: ["cesarean"] },
    { previous_outcomes: ["not_indicated", "spontaneous"] },
  ]) {
    await expect(
      save({ ...manual, ...patch }, saved.updated_at),
    ).rejects.toMatchObject({ code: "22023" });
  }
  await db.exec("reset role");
  const oldReference = (
    await db.query<{ value: string }>(
      "select ((clock_timestamp() at time zone 'Europe/Rome')::date-2)::text as value",
    )
  ).rows[0].value;
  await db.query(
    "update private.pregnancy_profiles set ultrasound_reference_date=$1::date where user_id=$2",
    [oldReference, owner],
  );
  await asUser(owner);
  const unchanged = await save(
    { ...manual, ultrasound_reference_date: oldReference },
    saved.updated_at,
  );
  expect(unchanged.ultrasound_reference_date).toBe(oldReference);
});
