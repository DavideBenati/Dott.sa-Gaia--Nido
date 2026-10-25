import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const manager = "11111111-1111-4111-8111-111111111111";
const alice = "22222222-2222-4222-8222-222222222222";
const bob = "33333333-3333-4333-8333-333333333333";
const editor = "44444444-4444-4444-8444-444444444444";
const literal = "55555555-5555-4555-8555-555555555555";
const pending = "66666666-6666-4666-8666-666666666666";
const stranger = "77777777-7777-4777-8777-777777777777";
let db: PGlite;
let activeId: string | null = null;
let backfill: { user_id: string; display_name: string }[];

interface MemberProfile {
  nickname: string;
  journey_shared: boolean;
  shared_journey: string | null;
  shared_interests: string[];
  journey_consent_at: string | null;
  journey_consent_version: string | null;
  sharing_updated_at: string | null;
}
interface Directory {
  members: {
    user_id: string;
    nickname: string;
    email: string;
    created_at: string;
    email_confirmed: boolean;
    journey_shared: boolean;
    shared_journey: string | null;
    shared_interests: string[];
    sharing_updated_at: string | null;
  }[];
  total: number;
  can_view_journeys: boolean;
  journey_membership: boolean;
  journey_mfa_required: boolean;
  mfa_satisfied: boolean;
}
async function asUser(id: string | null, aal = "aal1") {
  activeId = id;
  await db.exec("reset role; set role authenticated");
  await db.query(
    "select set_config('test.uid',$1,false),set_config('test.aal',$2,false)",
    [id ?? "", aal],
  );
}
async function own() {
  return (
    await db.query<{ value: MemberProfile }>(
      "select my_member_profile() as value",
    )
  ).rows[0].value;
}
async function nickname(value: string, expected: string | null = activeId) {
  return (
    await db.query<{ value: MemberProfile }>(
      "select set_my_nickname($1,$2) as value",
      [value, expected],
    )
  ).rows[0].value;
}
async function share(
  journey: string | null,
  interests: string[] | null,
  selected: boolean | null,
  version: string | null = null,
  expected: string | null = activeId,
) {
  return (
    await db.query<{ value: MemberProfile }>(
      "select save_my_shared_journey($1,$2,$3,$4,$5) as value",
      [journey, interests, selected, version, expected],
    )
  ).rows[0].value;
}
async function directory(term = "", filter = "all", offset = 0, limit = 20) {
  return (
    await db.query<{ value: Directory }>(
      "select member_directory($1,$2,$3,$4) as value",
      [term, filter, offset, limit],
    )
  ).rows[0].value;
}
async function owner() {
  activeId = null;
  await db.exec("reset role");
}
async function audit() {
  await owner();
  return (
    await db.query<{ user_id: string; shared: boolean; version: string }>(
      "select user_id,shared,version from private.member_profile_consent_events order by created_at,id",
    )
  ).rows;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema private; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,
      created_at timestamptz default now(),deleted_at timestamptz,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',coalesce(current_setting('test.aal',true),'aal1'))$$;
    create table private.editor_memberships(user_id uuid primary key references auth.users(id) on delete cascade,active boolean default true,require_mfa boolean default false);
    create table private.chat_staff(user_id uuid primary key references auth.users(id) on delete cascade,active boolean default true,require_mfa boolean default false);
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb default '{}',unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema auth,storage,public to anon,authenticated,service_role;
    grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
    create table public.care_conversations(user_id uuid primary key references auth.users(id)on delete cascade,created_at timestamptz not null default now());
    create table public.care_messages(id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.care_conversations(user_id)on delete cascade,sender_id uuid not null references auth.users(id)on delete cascade,body text not null,created_at timestamptz not null default now());
    create table public.profiles(user_id uuid primary key references auth.users(id)on delete cascade,display_name text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
    alter table public.profiles enable row level security;
    create policy own_profile on public.profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    grant select,insert,update,delete on public.profiles to authenticated;
    create table public.user_preferences(user_id uuid primary key references auth.users(id)on delete cascade,payload jsonb not null default '{}');
    alter table public.user_preferences enable row level security;
    create policy own_preferences on public.user_preferences for all to authenticated using(user_id=auth.uid())with check(user_id=auth.uid());
    grant select,insert,update,delete on public.user_preferences to authenticated;
  `);
  const workspace = await readFile(
    new URL(
      "../supabase/migrations/202610230005_professional_workspace.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const predicates = workspace.match(
    /create or replace function public\.is_(?:editor|chat_staff)\(\)[\s\S]*?\$\$;/g,
  );
  if (predicates?.length !== 2)
    throw new Error("Production role predicates missing");
  await db.exec(predicates.join("\n"));
  await db.exec(`revoke all on function public.is_editor(),public.is_chat_staff() from public,anon,authenticated;
    grant execute on function public.is_editor(),public.is_chat_staff() to authenticated;`);
  for (const name of [
    "202610240007_private_documents.sql",
    "202610240008_studio_usability.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
  await db.exec(`
    insert into auth.users(id,email,raw_user_meta_data) values
      ('88888888-8888-4888-8888-888888888888','backfill@example.invalid','{"nickname":" Backfill 🌿 "}'),
      ('99999999-9999-4999-8999-999999999999','chosen@example.invalid','{"nickname":"Replacement"}'),
      ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','full@example.invalid','{"full_name":"Do not copy this name","role":"admin","journey_shared":true}');
    insert into public.profiles(user_id,display_name)values('88888888-8888-4888-8888-888888888888',''),('99999999-9999-4999-8999-999999999999','Chosen nickname');
  `);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610250009_member_profiles.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  backfill = (
    await db.query<{ user_id: string; display_name: string }>(
      "select user_id,display_name from profiles order by user_id",
    )
  ).rows;
});
beforeEach(async () => {
  await owner();
  await db.exec(
    "truncate auth.users cascade; set test.uid=''; set test.aal='aal1'",
  );
  for (const [id, email, name, confirmed] of [
    [manager, "gaia@example.invalid", "Gaia", true],
    [alice, "alice@example.invalid", "Mamma Sole", true],
    [bob, "bob@example.invalid", "Mamma Sole", true],
    [editor, "editor@example.invalid", "Studio", true],
    [literal, "literal%_\\tag@example.invalid", "Care%_\\Team", true],
    [pending, "pending@example.invalid", "In attesa", false],
  ] as const)
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)values($1,$2,case when $3 then now() else null end,$4)",
      [id, email, confirmed, JSON.stringify({ nickname: name })],
    );
  await db.query(
    "insert into private.editor_memberships(user_id) values($1),($2)",
    [manager, editor],
  );
  await db.query(
    "insert into private.chat_staff(user_id,require_mfa)values($1,true)",
    [manager],
  );
  await db.query("insert into private.document_staff(user_id)values($1)", [
    manager,
  ]);
  await db.query(
    "insert into private.member_profile_staff(user_id)values($1)",
    [manager],
  );
  await db.query(
    "insert into care_conversations(user_id,created_at)values($1,'2026-10-01'),($2,'2026-10-02'),($3,'2026-10-03')",
    [alice, bob, literal],
  );
});
afterAll(async () => db.close());

test("migration backfills only valid explicit nickname metadata and preserves chosen names", () => {
  expect(backfill).toEqual([
    {
      user_id: "88888888-8888-4888-8888-888888888888",
      display_name: "Backfill 🌿",
    },
    {
      user_id: "99999999-9999-4999-8999-999999999999",
      display_name: "Chosen nickname",
    },
    { user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", display_name: "" },
  ]);
});

test("signup stores nickname before email confirmation without accepting role or sharing metadata", async () => {
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data)values($1,'new@example.invalid',$2)",
    [
      stranger,
      JSON.stringify({
        nickname: " \u00a0A\u030Ana\ufeff ",
        role: "admin",
        journey_shared: true,
        shared_journey: "pregnancy",
      }),
    ],
  );
  const row = (
    await db.query<{ display_name: string; journey_shared: boolean }>(
      "select display_name,journey_shared from profiles where user_id=$1",
      [stranger],
    )
  ).rows[0];
  expect(row).toEqual({ display_name: "Åna", journey_shared: false });
  expect(
    (
      await db.query(
        "select * from private.editor_memberships where user_id=$1",
        [stranger],
      )
    ).rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "select * from private.member_profile_staff where user_id=$1",
        [stranger],
      )
    ).rows,
  ).toEqual([]);
});

test("legacy or invalid signup metadata keeps accounts creatable with an empty nickname", async () => {
  for (const nickname of [
    undefined,
    null,
    { role: "admin" },
    "x",
    "x".repeat(41),
    "a@b",
    "A\u200dB",
    "A\nB",
  ])
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data)values(gen_random_uuid(),'legacy@example.invalid',$1)",
      [JSON.stringify({ nickname })],
    );
  expect(
    (
      await db.query<{ display_name: string }>(
        "select display_name from profiles where user_id not in($1,$2,$3,$4,$5,$6)",
        [manager, alice, bob, editor, literal, pending],
      )
    ).rows.every((row) => row.display_name === ""),
  ).toBe(true);
});

test("nickname edits normalize NFC/trim and validate codepoints and forbidden characters", async () => {
  await asUser(alice);
  expect((await nickname(" \nA\u030Ana\ufeff ")).nickname).toBe("Åna");
  expect((await nickname("🌿".repeat(40))).nickname).toBe("🌿".repeat(40));
  for (const invalid of [
    "",
    "x",
    "🌿".repeat(41),
    "a@b",
    "<name>",
    "A\nB",
    "A\u0085B",
    "A\u200bB",
    "A\u202eB",
    "A\u2066B",
  ])
    await expect(nickname(invalid)).rejects.toMatchObject({ code: "22023" });
  await expect(
    db.query("update profiles set display_name='bad@name' where user_id=$1", [
      alice,
    ]),
  ).rejects.toMatchObject({ code: "22023" });
});

test("self writes require the captured owner UUID, preventing cross-account form reuse", async () => {
  await asUser(alice);
  for (const expected of [null, bob]) {
    await expect(nickname("Changed", expected)).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      share("pregnancy", [], true, null, expected),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(share(null, [], false, null, expected)).rejects.toMatchObject({
      code: "42501",
    });
  }
  expect((await own()).nickname).toBe("Mamma Sole");
  await asUser(bob);
  await expect(nickname("Alice old form", alice)).rejects.toMatchObject({
    code: "42501",
  });
  expect((await own()).nickname).toBe("Mamma Sole");
});

test("profile ownership and private grants cannot be bypassed by normal users", async () => {
  await asUser(alice);
  expect((await db.query("select user_id from profiles")).rows).toEqual([
    { user_id: alice },
  ]);
  await db.query(
    "update profiles set display_name='Not owned' where user_id=$1",
    [bob],
  );
  await expect(
    db.query(
      "insert into profiles(user_id,display_name)values($1,'Hijack') on conflict(user_id)do update set display_name=excluded.display_name",
      [bob],
    ),
  ).rejects.toThrow();
  for (const table of [
    "auth.users",
    "private.member_profile_staff",
    "private.member_profile_consent_events",
  ])
    await expect(db.query("select * from " + table)).rejects.toThrow(
      /permission denied/,
    );
  for (const call of [
    "private.normalized_member_nickname('Hidden')",
    "private.create_member_profile()",
    "private.validate_member_profile()",
    "private.record_member_profile_consent()",
  ])
    await expect(db.query("select " + call)).rejects.toThrow(
      /permission denied/,
    );
});

test("anonymous and missing-subject calls cannot read or write profiles or list members", async () => {
  await db.exec("set role anon");
  await expect(own()).rejects.toThrow(/permission denied/);
  await expect(directory()).rejects.toThrow(/permission denied/);
  await asUser(null);
  await expect(own()).rejects.toMatchObject({ code: "42501" });
  await expect(nickname("Missing")).rejects.toMatchObject({ code: "42501" });
  await expect(share(null, [], false)).rejects.toMatchObject({ code: "42501" });
  await expect(directory()).rejects.toMatchObject({ code: "42501" });
});

test("optional sharing snapshots only allowlisted fields and records server-authored consent", async () => {
  await asUser(alice);
  const initial = await own();
  expect(initial.journey_shared).toBe(false);
  expect(initial.sharing_updated_at).toBeNull();
  const saved = await share("pregnancy", ["newborn", "birth", "newborn"], true);
  expect(saved.shared_interests).toEqual(["birth", "newborn"]);
  expect(saved.journey_shared).toBe(true);
  expect(saved.journey_consent_version).toBe("2026-10-25-v1");
  expect(Date.parse(saved.journey_consent_at!)).not.toBeNaN();
  expect(saved.sharing_updated_at).toBe(saved.journey_consent_at);
  expect(await audit()).toEqual([
    { user_id: alice, shared: true, version: "2026-10-25-v1" },
  ]);
});

test("nickname-only changes neither refresh consent nor create consent events", async () => {
  await asUser(alice);
  const saved = await share("partner", ["partner"], true);
  const renamed = await nickname("Nickname nuovo");
  expect(renamed.sharing_updated_at).toBe(saved.sharing_updated_at);
  expect(renamed.journey_consent_at).toBe(saved.journey_consent_at);
  expect(await audit()).toHaveLength(1);
});

test("revocation immediately clears shared fields and forged consent metadata", async () => {
  await asUser(alice);
  const saved = await share("pregnancy", ["birth"], true);
  const revoked = await share(
    "invalid",
    ["not-allowed"],
    false,
    saved.sharing_updated_at,
  );
  expect(revoked).toMatchObject({
    journey_shared: false,
    shared_journey: null,
    shared_interests: [],
    journey_consent_at: null,
    journey_consent_version: null,
  });
  expect(revoked.sharing_updated_at).not.toBe(saved.sharing_updated_at);
  await db.query(
    "update profiles set shared_journey='pregnancy',shared_interests=array['birth'],journey_consent_at='2000-01-01',journey_consent_version='forged',sharing_updated_at='2000-01-01' where user_id=$1",
    [alice],
  );
  expect(await own()).toEqual(revoked);
  expect((await audit()).map((e) => e.shared)).toEqual([true, false]);
});

test("stale tabs cannot restore or overwrite shared data, but revocation always succeeds", async () => {
  await asUser(alice);
  const first = await share("pregnancy", [], true);
  const changed = await share(
    "postpartum",
    ["newborn"],
    true,
    first.sharing_updated_at,
  );
  await expect(
    share("partner", [], true, first.sharing_updated_at),
  ).rejects.toMatchObject({ code: "40001" });
  expect((await own()).shared_journey).toBe("postpartum");
  const revoked = await share(null, null, false, first.sharing_updated_at);
  expect(revoked.journey_shared).toBe(false);
  await expect(
    share("pregnancy", [], true, changed.sharing_updated_at),
  ).rejects.toMatchObject({ code: "40001" });
  expect((await own()).journey_shared).toBe(false);
  const reaffirmed = await share(
    "exploring",
    [],
    true,
    revoked.sharing_updated_at,
  );
  expect(reaffirmed.shared_journey).toBe("exploring");
});

test("unchanged explicit sharing saves get a new server version and timestamps cannot be forged", async () => {
  await asUser(alice);
  const saved = await share("pregnancy", [], true);
  const reaffirmed = await share(
    "pregnancy",
    [],
    true,
    saved.sharing_updated_at,
  );
  expect(reaffirmed.sharing_updated_at).not.toBe(saved.sharing_updated_at);
  await db.query(
    "update profiles set journey_consent_at='2000-01-01',journey_consent_version='forged' where user_id=$1",
    [alice],
  );
  expect(await own()).toEqual(reaffirmed);
  expect((await audit()).map((e) => e.shared)).toEqual([true, true]);
});

test("shared journey and interest validation rejects arbitrary payloads", async () => {
  await asUser(alice);
  for (const [journey, interests, selected] of [
    [null, [], true],
    ["all", [], true],
    ["pregnancy", ["medical-record"], true],
    ["pregnancy", Array(9).fill("birth"), true],
    ["pregnancy", [], null],
  ] as [string | null, string[], boolean | null][])
    await expect(share(journey, interests, selected)).rejects.toMatchObject({
      code: "22023",
    });
  await expect(
    db.query(
      "select save_my_shared_journey('pregnancy',array[null]::text[],true,null,$1)",
      [alice],
    ),
  ).rejects.toMatchObject({ code: "22023" });
  expect((await own()).journey_shared).toBe(false);
});

test("personal preferences and dates are neither copied nor revealed by the directory", async () => {
  await db.query("insert into user_preferences(user_id,payload)values($1,$2)", [
    alice,
    JSON.stringify({
      journey: "pregnancy",
      date: "2027-03-01",
      feedingTopics: ["private-topic"],
      sensitiveConsent: true,
    }),
  ]);
  await asUser(alice);
  await share("partner", ["partner"], true);
  await asUser(manager, "aal2");
  const data = await directory("alice");
  expect(data.members[0].shared_journey).toBe("partner");
  expect(JSON.stringify(data)).not.toMatch(
    /2027-03-01|private-topic|feedingTopics|sensitiveConsent/,
  );
  await expect(
    db.query("select * from user_preferences"),
  ).resolves.toMatchObject({ rows: [] });
});

test("ordinary editors get identities but no sharing state, timestamps, interests or journey filters", async () => {
  await asUser(alice);
  await share("pregnancy", ["birth"], true);
  await asUser(editor);
  const data = await directory("alice");
  expect(data.can_view_journeys).toBe(false);
  expect(data.journey_membership).toBe(false);
  expect(data.members[0]).toMatchObject({
    nickname: "Mamma Sole",
    email: "alice@example.invalid",
    journey_shared: false,
    shared_journey: null,
    shared_interests: [],
    sharing_updated_at: null,
  });
  await expect(directory("", "pregnancy")).rejects.toMatchObject({
    code: "42501",
  });
  await asUser(alice, "aal2");
  await expect(directory()).rejects.toMatchObject({ code: "42501" });
});

test("dedicated active membership, editor role and configured MFA are all required for shared journeys", async () => {
  await asUser(alice);
  await share("pregnancy", ["birth"], true);
  await asUser(manager);
  let data = await directory("alice");
  expect(data).toMatchObject({
    journey_membership: true,
    journey_mfa_required: true,
    mfa_satisfied: false,
    can_view_journeys: false,
  });
  expect(data.members[0].shared_journey).toBeNull();
  await asUser(manager, "aal2");
  data = await directory("", "pregnancy");
  expect(data.can_view_journeys).toBe(true);
  expect(data.members.map((m) => m.user_id)).toEqual([alice]);
  await owner();
  await db.query(
    "update private.member_profile_staff set active=false where user_id=$1",
    [manager],
  );
  await asUser(manager, "aal2");
  expect((await directory()).can_view_journeys).toBe(false);
  await owner();
  await db.query(
    "update private.member_profile_staff set active=true where user_id=$1",
    [manager],
  );
  await db.query(
    "update private.editor_memberships set active=false where user_id=$1",
    [manager],
  );
  await asUser(manager, "aal2");
  await expect(directory()).rejects.toMatchObject({ code: "42501" });
});

test("directory preserves duplicate nicknames, confirmed state and literal paginated search", async () => {
  await asUser(editor);
  let data = await directory("MAMMA SOLE");
  expect(data.total).toBe(2);
  expect(data.members.map((m) => m.email).sort()).toEqual([
    "alice@example.invalid",
    "bob@example.invalid",
  ]);
  for (const term of ["%", "_", "\\", "%_\\"])
    expect((await directory(term)).members.map((m) => m.user_id)).toEqual([
      literal,
    ]);
  expect((await directory("' or true --")).members).toEqual([]);
  expect((await directory("pending")).members[0].email_confirmed).toBe(false);
  data = await directory("", "all", 1, 2);
  expect(data.total).toBe(6);
  expect(data.members).toHaveLength(2);
  expect((await directory("", "all", 50, 2)).total).toBe(6);
  for (const args of [
    ["x".repeat(255), "all", 0, 20],
    ["", "all", -1, 20],
    ["", "all", 0, 0],
    ["", "all", 0, 51],
    ["", "invalid", 0, 20],
  ] as const)
    await expect(directory(...args)).rejects.toMatchObject({ code: "22023" });
});

test("directory omits deleted users and does not grant direct auth access", async () => {
  await db.query("update auth.users set deleted_at=now() where id=$1", [bob]);
  await asUser(editor);
  expect((await directory()).total).toBe(5);
  await expect(db.query("select * from auth.users")).rejects.toThrow(
    /permission denied/,
  );
});

test("nickname v2 contact lookups keep existing chat/document scopes and old return types", async () => {
  const document = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  await db.query(
    `insert into session_documents(id,owner_id,title,file_name,mime_type,size_bytes,storage_path,state,active,ready_at)
    values($1,$2,'Documento','materiale.pdf','application/pdf',10,$1::uuid::text||'/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf','ready',true,now())`,
    [document, manager],
  );
  await db.query(
    "insert into session_document_access(document_id,user_id,granted_by)values($1,$2,$3)",
    [document, alice, manager],
  );
  await asUser(manager, "aal2");
  const chat = (
    await db.query<{ user_id: string; nickname: string }>(
      "select * from professional_conversation_contacts_v2('mamma')",
    )
  ).rows;
  expect(chat.map((r) => r.user_id).sort()).toEqual([alice, bob]);
  expect(chat.every((r) => r.nickname === "Mamma Sole")).toBe(true);
  expect(
    (
      await db.query(
        "select * from professional_conversation_contacts_v2('Studio')",
      )
    ).rows,
  ).toEqual([]);
  expect(
    (
      await db.query<{ user_id: string }>(
        "select * from search_document_users_v2('mamma')",
      )
    ).rows
      .map((r) => r.user_id)
      .sort(),
  ).toEqual([alice, bob]);
  expect(
    (await db.query("select * from search_document_users_v2('In attesa')"))
      .rows,
  ).toEqual([]);
  const recipient = (
    await db.query<{ user_id: string; nickname: string }>(
      "select * from document_recipients_v2($1)",
      [document],
    )
  ).rows[0];
  expect(recipient).toMatchObject({ user_id: alice, nickname: "Mamma Sole" });
  expect(
    Object.keys(
      (
        await db.query(
          "select * from professional_conversation_contacts('alice')",
        )
      ).rows[0],
    ).sort(),
  ).toEqual(["email", "last_message_at", "last_message_preview", "user_id"]);
  expect(
    Object.keys(
      (await db.query("select * from search_document_users('alice')")).rows[0],
    ).sort(),
  ).toEqual(["email", "user_id"]);
  expect(
    Object.keys(
      (await db.query("select * from document_recipients($1)", [document]))
        .rows[0],
    ).sort(),
  ).toEqual(["email", "granted_at", "user_id"]);
  await asUser(manager);
  await expect(
    db.query("select * from professional_conversation_contacts_v2()"),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    db.query("select * from search_document_users_v2('mamma')"),
  ).rejects.toMatchObject({ code: "42501" });
  await asUser(editor, "aal2");
  await expect(
    db.query("select * from professional_conversation_contacts_v2()"),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    db.query("select * from document_recipients_v2($1)", [document]),
  ).rejects.toMatchObject({ code: "42501" });
});

test("member-profile authorization grants no chat or document access", async () => {
  await db.query("delete from private.chat_staff where user_id=$1", [manager]);
  await db.query("delete from private.document_staff where user_id=$1", [
    manager,
  ]);
  await asUser(manager, "aal2");
  expect((await directory()).can_view_journeys).toBe(true);
  await expect(
    db.query("select * from professional_conversation_contacts_v2()"),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    db.query("select * from search_document_users_v2('mamma')"),
  ).rejects.toMatchObject({ code: "42501" });
});

test("two-character nicknames are searchable in the new document lookup while the legacy minimum stays unchanged", async () => {
  await asUser(alice);
  await nickname("Lu");
  await asUser(manager, "aal2");
  expect(
    (
      await db.query(
        "select user_id,nickname from search_document_users_v2('Lu')",
      )
    ).rows,
  ).toEqual([{ user_id: alice, nickname: "Lu" }]);
  await expect(
    db.query("select * from search_document_users('Lu')"),
  ).rejects.toMatchObject({ code: "22023" });
  await expect(
    db.query("select * from search_document_users_v2('L')"),
  ).rejects.toMatchObject({ code: "22023" });
});

test("account deletion cascades its profile, sharing audit and dedicated membership", async () => {
  await asUser(alice);
  await share("pregnancy", [], true);
  await owner();
  await db.query("delete from auth.users where id=$1", [alice]);
  for (const table of [
    "public.profiles",
    "private.member_profile_consent_events",
  ])
    expect(
      (await db.query("select * from " + table + " where user_id=$1", [alice]))
        .rows,
    ).toEqual([]);
  await db.query("delete from auth.users where id=$1", [manager]);
  expect(
    (
      await db.query(
        "select * from private.member_profile_staff where user_id=$1",
        [manager],
      )
    ).rows,
  ).toEqual([]);
});

test("Gaia grant script requires a confirmed Studio account and changes only the dedicated protected role", async () => {
  const sql = await readFile(
    new URL("../../release-v9/ABILITA-SCHEDE-GAIA.sql", import.meta.url),
    "utf8",
  );
  await db.query(
    "update auth.users set email='ostetricamaia@gmail.com',email_confirmed_at=null where id=$1",
    [manager],
  );
  await expect(db.exec(sql)).rejects.toThrow(/confermato/);
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [
    manager,
  ]);
  await db.query(
    "update private.editor_memberships set active=false where user_id=$1",
    [manager],
  );
  await expect(db.exec(sql)).rejects.toThrow(/Studio/);
  await db.query(
    "update private.editor_memberships set active=true where user_id=$1",
    [manager],
  );
  await db.query(
    "update private.member_profile_staff set active=false,require_mfa=false where user_id=$1",
    [manager],
  );
  await db.exec(sql);
  expect(
    (
      await db.query(
        "select active,require_mfa from private.member_profile_staff where user_id=$1",
        [manager],
      )
    ).rows[0],
  ).toEqual({ active: true, require_mfa: true });
  expect(
    (await db.query("select user_id from private.chat_staff")).rows,
  ).toEqual([{ user_id: manager }]);
  expect(
    (await db.query("select user_id from private.document_staff")).rows,
  ).toEqual([{ user_id: manager }]);
});
