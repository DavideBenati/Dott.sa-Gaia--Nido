import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const owner = "11111111-1111-4111-8111-111111111111";
const family = "22222222-2222-4222-8222-222222222222";
const stranger = "33333333-3333-4333-8333-333333333333";
const duplicate = "44444444-4444-4444-8444-444444444444";
const staff = "55555555-5555-4555-8555-555555555555";
const unconfirmed = "66666666-6666-4666-8666-666666666666";
const checklist = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const item = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const article = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
let db: PGlite;
async function asUser(id: string | null) {
  await db.exec("reset role; set role authenticated");
  await db.query("select set_config('test.uid',$1,false)", [id ?? ""]);
}
async function invite(id = owner) {
  await asUser(id);
  return (
    await db.query<{ value: { code: string; expires_at: string } }>(
      "select create_family_invite($1) as value",
      [id],
    )
  ).rows[0].value;
}
async function request(code: string, reader = family, nickname = "Sole") {
  await asUser(reader);
  return (
    await db.query<{ id: string }>(
      "select request_family_share($1,$2,$3) as id",
      [nickname, code, reader],
    )
  ).rows[0].id;
}
async function approve(id: string, approve = true) {
  await asUser(owner);
  await db.query("select decide_family_share_request($1,$2,$3)", [
    id,
    approve,
    owner,
  ]);
}
async function snapshot(id: string, user = family) {
  await asUser(user);
  return (
    await db.query<{ value: Record<string, unknown> }>(
      "select family_shared_snapshot($1,$2) as value",
      [id, user],
    )
  ).rows[0].value;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function public.is_editor() returns boolean language sql stable as $$select auth.uid()='${staff}'::uuid$$;
    create function private.normalized_member_nickname(value text) returns text language sql immutable as $$select pg_catalog.normalize(btrim(value),'NFC')$$;
    create table profiles(user_id uuid primary key references auth.users(id) on delete cascade,display_name text,shared_journey text,shared_interests text[],journey_consent_at timestamptz);
    create table user_preferences(user_id uuid primary key references auth.users(id) on delete cascade,payload jsonb);
    create table checklists(id uuid primary key,status text,approved boolean,is_demo boolean,payload jsonb);
    create table checklist_items(id uuid primary key,checklist_id uuid references checklists(id) on delete cascade,label text,note text,position integer);
    create table checklist_progress(user_id uuid references auth.users(id) on delete cascade,item_id uuid references checklist_items(id) on delete cascade,completed boolean,updated_at timestamptz,primary key(user_id,item_id));
    create table articles(id uuid primary key,status text,approved boolean,is_demo boolean,payload jsonb);
    create table user_favorites(user_id uuid references auth.users(id) on delete cascade,article_id uuid references articles(id) on delete cascade,created_at timestamptz,primary key(user_id,article_id));
    alter table profiles enable row level security;
    alter table user_preferences enable row level security;
    alter table checklist_progress enable row level security;
    alter table user_favorites enable row level security;
    create policy own_profile on profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    create policy own_preferences on user_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    create policy own_progress on checklist_progress for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    create policy own_favorites on user_favorites for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
    grant usage on schema public,auth to authenticated,anon;
    grant select,insert,update,delete on profiles,user_preferences,checklist_progress,user_favorites to authenticated;
  `);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610250012_family_sharing.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
beforeEach(async () => {
  await db.exec("reset role; truncate auth.users,checklists,articles cascade");
  for (const id of [owner, family, stranger, duplicate, staff, unconfirmed]) {
    await db.query(
      "insert into auth.users values($1,$2,case when $3 then now() else null end,null)",
      [id, `${id}@example.invalid`, id !== unconfirmed],
    );
    await db.query(
      "insert into profiles values($1,$2,'pregnancy',array['birth'],now())",
      [id, id === owner || id === duplicate ? "Sole" : "Luna"],
    );
    await db.query("insert into user_preferences values($1,$2::jsonb)", [
      id,
      JSON.stringify({
        date: "2027-04-01",
        pregnancy: "clinical-secret",
        history: "never-share",
      }),
    ]);
  }
  await db.query(
    "insert into checklists values($1,'published',true,false,$2::jsonb)",
    [
      checklist,
      JSON.stringify({
        title: "Prepariamo insieme",
        pregnancy: "never-share",
        date: "2027-04-01",
      }),
    ],
  );
  await db.query(
    "insert into checklist_items values($1,$2,'Prepara la borsa','note non necessarie',0)",
    [item, checklist],
  );
  await db.query("insert into checklist_progress values($1,$2,true,now())", [
    owner,
    item,
  ]);
  await db.query("insert into checklist_progress values($1,$2,false,now())", [
    duplicate,
    item,
  ]);
  await db.query(
    "insert into articles values($1,'published',true,false,$2::jsonb)",
    [
      article,
      JSON.stringify({
        title: "Una lettura insieme",
        sections: ["public body"],
        clinical: "not-part-of-snapshot",
      }),
    ],
  );
  await db.query("insert into user_favorites values($1,$2,now())", [
    owner,
    article,
  ]);
  await asUser(owner);
});
afterAll(async () => {
  await db.close();
});

test("duplicate nicknames resolve only by private code and pending requests require explicit owner approval", async () => {
  const secret = await invite();
  expect(secret.code).toMatch(/^[a-f0-9]{64}$/);
  const id = await request(secret.code, family, " Sole ");
  await expect(snapshot(id)).rejects.toThrow();
  await db.query("select set_config('test.uid',$1,false)", [owner]);
  const incoming = (
    await db.query<{
      value: { incoming: { id: string; nickname: string; status: string }[] };
    }>("select list_family_sharing($1) as value", [owner])
  ).rows[0].value;
  expect(incoming.incoming).toEqual([
    { id, nickname: "Luna", status: "pending" },
  ]);
  await asUser(duplicate);
  await expect(
    db.query("select decide_family_share_request($1,true,$2)", [id, duplicate]),
  ).rejects.toThrow();
  await approve(id);
  expect(await snapshot(id)).toEqual({
    nickname: "Sole",
    checklists: [
      {
        id: checklist,
        title: "Prepariamo insieme",
        items: [{ id: item, label: "Prepara la borsa", completed: true }],
      },
    ],
    articles: [{ id: article, title: "Una lettura insieme" }],
  });
  await expect(snapshot(id, stranger)).rejects.toThrow();
  await expect(snapshot(id, staff)).rejects.toThrow();
  await expect(snapshot(id, owner)).rejects.toThrow();
});

test("snapshot includes only published safe fields and current owner progress; direct clinical and private access stays closed", async () => {
  const id = await request((await invite()).code);
  await approve(id);
  await db.exec("reset role");
  for (const [status, approved, demo] of [
    ["draft", false, false],
    ["archived", true, false],
    ["published", false, false],
    ["published", true, true],
  ] as const) {
    const hidden = (
      await db.query<{ id: string }>("select gen_random_uuid() as id")
    ).rows[0].id;
    await db.query(
      'insert into checklists values($1,$2,$3,$4,\'{"title":"Hidden"}\')',
      [hidden, status, approved, demo],
    );
    await db.query(
      'insert into articles values($1,$2,$3,$4,\'{"title":"Hidden"}\')',
      [hidden, status, approved, demo],
    );
    await db.query("insert into user_favorites values($1,$2,now())", [
      owner,
      hidden,
    ]);
  }
  const value = await snapshot(id);
  expect(Object.keys(value).sort()).toEqual([
    "articles",
    "checklists",
    "nickname",
  ]);
  expect(value.articles).toEqual([
    { id: article, title: "Una lettura insieme" },
  ]);
  expect(value.checklists).toHaveLength(1);
  expect(JSON.stringify(value)).not.toMatch(
    /email|pregnancy|date|history|interests|consent|note|sections|clinical|updated_at|created_at/,
  );
  expect(
    (await db.query("select * from profiles where user_id=$1", [owner])).rows,
  ).toEqual([]);
  expect(
    (await db.query("select * from user_preferences where user_id=$1", [owner]))
      .rows,
  ).toEqual([]);
  expect(
    (
      await db.query("select * from checklist_progress where user_id=$1", [
        owner,
      ])
    ).rows,
  ).toEqual([]);
  expect(
    (await db.query("select * from user_favorites where user_id=$1", [owner]))
      .rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "update checklist_progress set completed=false where user_id=$1 returning *",
        [owner],
      )
    ).rows,
  ).toEqual([]);
  await db.exec("reset role");
  await db.query(
    "update checklist_progress set completed=false where user_id=$1",
    [owner],
  );
  expect(JSON.stringify((await snapshot(id)).checklists)).toContain(
    '"completed":false',
  );
  await expect(
    db.exec("select * from private.family_share_invites"),
  ).rejects.toThrow();
  await expect(
    db.exec("select * from private.family_share_grants"),
  ).rejects.toThrow();
});

test("decline and owner or recipient revocation immediately deny further snapshots", async () => {
  const secret = await invite();
  const declined = await request(secret.code);
  await approve(declined, false);
  await expect(snapshot(declined)).rejects.toThrow();
  const id = await request(secret.code);
  expect(id).not.toBe(declined);
  await approve(id);
  await asUser(stranger);
  await expect(
    db.query("select revoke_family_share($1,$2)", [id, stranger]),
  ).rejects.toThrow();
  await asUser(owner);
  await db.query("select revoke_family_share($1,$2)", [id, owner]);
  await expect(snapshot(id)).rejects.toThrow();
  const next = await request(secret.code);
  await approve(next);
  await asUser(family);
  await db.query("select revoke_family_share($1,$2)", [next, family]);
  await expect(snapshot(next)).rejects.toThrow();
});

test("expired and rotated invitation codes fail generically, while previously approved grants survive code rotation", async () => {
  const secret = await invite();
  const id = await request(secret.code);
  await approve(id);
  const pending = await request(secret.code, stranger);
  const newer = await invite();
  expect(newer.code).not.toBe(secret.code);
  await expect(request(secret.code, duplicate)).rejects.toThrow(
    "Nickname e codice non validi o invito scaduto",
  );
  await expect(request(newer.code, duplicate, "Sconosciuta")).rejects.toThrow(
    "Nickname e codice non validi o invito scaduto",
  );
  await expect(request("0".repeat(64), duplicate)).rejects.toThrow(
    "Nickname e codice non validi o invito scaduto",
  );
  await expect(approve(pending)).rejects.toThrow();
  expect(await snapshot(id)).toHaveProperty("nickname", "Sole");
  await db.exec("reset role");
  await db.exec(
    "update private.family_share_invites set expires_at=now()-interval '1 second'",
  );
  await expect(request(newer.code, duplicate)).rejects.toThrow(
    "Nickname e codice non validi o invito scaduto",
  );
});

test("every RPC rejects a different authenticated target; anonymous and unconfirmed accounts cannot use sharing", async () => {
  const secret = await invite();
  const id = await request(secret.code);
  await asUser(family);
  for (const [sql, args] of [
    ["select create_family_invite($1)", [owner]],
    ["select request_family_share('Sole',$1,$2)", [secret.code, owner]],
    ["select list_family_sharing($1)", [owner]],
    ["select decide_family_share_request($1,true,$2)", [id, owner]],
    ["select revoke_family_share($1,$2)", [id, owner]],
    ["select family_shared_snapshot($1,$2)", [id, owner]],
  ] as const)
    await expect(db.query(sql, [...args])).rejects.toThrow();
  await asUser(unconfirmed);
  await expect(
    db.query("select list_family_sharing($1)", [unconfirmed]),
  ).rejects.toThrow();
  await expect(
    db.query("select request_family_share('Sole',$1,$2)", [
      secret.code,
      unconfirmed,
    ]),
  ).rejects.toThrow();
  await db.exec("reset role; set role anon");
  await expect(
    db.query("select list_family_sharing($1)", [owner]),
  ).rejects.toThrow();
  await expect(
    db.query("select family_shared_snapshot($1,$2)", [id, family]),
  ).rejects.toThrow();
  await expect(
    db.query("select create_family_invite($1)", [owner]),
  ).rejects.toThrow();
});
