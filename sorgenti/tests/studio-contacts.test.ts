import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const manager = "11111111-1111-4111-8111-111111111111";
const alice = "22222222-2222-4222-8222-222222222222";
const bob = "33333333-3333-4333-8333-333333333333";
const editor = "44444444-4444-4444-8444-444444444444";
const literal = "55555555-5555-4555-8555-555555555555";
let db: PGlite;

async function asUser(id: string, aal = "aal1") {
  await db.exec("reset role;set role authenticated;");
  await db.query(
    "select set_config('test.uid',$1,false),set_config('test.aal',$2,false)",
    [id, aal],
  );
}
async function contacts(term = "", offset = 0, limit = 50) {
  return (
    await db.query<{
      user_id: string;
      email: string;
      last_message_at: Date | null;
      last_message_preview: string;
    }>("select * from professional_conversation_contacts($1,$2,$3)", [
      term,
      offset,
      limit,
    ])
  ).rows;
}
async function docVersion(id: string) {
  return (
    await db.query<{ updated_at: string }>(
      "select updated_at::text from session_documents where id=$1",
      [id],
    )
  ).rows[0].updated_at;
}
async function readyDocument() {
  await db.exec("reset role");
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  await db.query(
    `insert into public.session_documents
    (id,owner_id,title,description,file_name,mime_type,size_bytes,storage_path,state,active,ready_at)
    values($1,$2,'Titolo precedente','Descrizione precedente','sessione.pdf','application/pdf',128,
    $1::uuid::text||'/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.pdf','ready',true,now())`,
    [id, manager],
  );
  await db.query(
    "insert into public.session_document_access(document_id,user_id,granted_by)values($1,$2,$3)",
    [id, alice, manager],
  );
  await asUser(manager, "aal2");
  return { id, version: await docVersion(id) };
}
async function edit(
  id: string,
  version: string | null,
  title = "Nuovo titolo",
) {
  return (
    await db.query<{
      title: string;
      description: string;
      active: boolean;
      state: string;
    }>("select * from update_document_details($1,$2,$3,$4)", [
      id,
      title,
      "Nuova descrizione",
      version,
    ])
  ).rows[0];
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema private; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.jwt()returns jsonb language sql stable as $$select jsonb_build_object('aal',coalesce(current_setting('test.aal',true),'aal1'))$$;
    create table private.editor_memberships(user_id uuid references auth.users(id)on delete cascade,active boolean default true,require_mfa boolean default false);
    create table private.chat_staff(user_id uuid references auth.users(id)on delete cascade,active boolean default true,require_mfa boolean default false);
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb default '{}',unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema auth,storage,public to anon,authenticated,service_role;
    grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
    create table public.care_conversations(user_id uuid primary key references auth.users(id)on delete cascade,created_at timestamptz not null default now());
    create table public.care_messages(id uuid primary key default gen_random_uuid(),conversation_id uuid not null references public.care_conversations(user_id)on delete cascade,sender_id uuid not null references auth.users(id)on delete cascade,body text not null,created_at timestamptz not null default now());
  `);
  const workspace = await readFile(
    new URL(
      "../supabase/migrations/202610230005_professional_workspace.sql",
      import.meta.url,
    ),
    "utf8",
  );
  // Exercise the actual production role/MFA predicates, not substitutes.
  const roleFunctions = workspace.match(
    /create or replace function public\.is_(?:editor|chat_staff)\(\)[\s\S]*?\$\$;/g,
  );
  if (roleFunctions?.length !== 2) throw new Error("Role functions missing");
  await db.exec(roleFunctions.join("\n"));
  await db.exec(`
    revoke all on function public.is_editor(),public.is_chat_staff() from public,anon,authenticated;
    grant execute on function public.is_editor(),public.is_chat_staff() to authenticated;
    alter table public.care_conversations enable row level security;
    alter table public.care_messages enable row level security;
    grant select on public.care_conversations,public.care_messages to authenticated;
    create policy conversations_read on public.care_conversations for select to authenticated using(user_id=auth.uid()or public.is_chat_staff());
    create policy messages_read on public.care_messages for select to authenticated using(conversation_id=auth.uid()or public.is_chat_staff());
  `);
  for (const migration of [
    "202610240007_private_documents.sql",
    "202610240008_studio_usability.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + migration, import.meta.url),
        "utf8",
      ),
    );
});
beforeEach(async () => {
  await db.exec(
    "reset role;truncate auth.users cascade;set test.uid='';set test.aal='aal1';",
  );
  for (const [id, email] of [
    [manager, "gaia@example.invalid"],
    [alice, "alice@example.invalid"],
    [bob, "bob@example.invalid"],
    [editor, "editor@example.invalid"],
    [literal, "literal%_\\tag@example.invalid"],
  ])
    await db.query("insert into auth.users values($1,$2,now())", [id, email]);
  await db.query(
    "insert into private.editor_memberships(user_id)values($1),($2)",
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
    "insert into public.care_conversations values($1,'2026-10-01'),($2,'2026-10-02'),($3,'2026-10-03')",
    [alice, bob, literal],
  );
});
afterAll(async () => db.close());

test("contact directory requires active chat membership and its verified MFA", async () => {
  await db.exec("set role anon");
  await expect(contacts()).rejects.toThrow(/permission denied/);
  for (const [id, aal] of [
    ["", "aal2"],
    [alice, "aal2"],
    [editor, "aal2"],
    [manager, "aal1"],
  ]) {
    await asUser(id, aal);
    await expect(contacts()).rejects.toThrow(/Chat authorization/);
  }
  await asUser(manager, "aal2");
  expect(await contacts()).toHaveLength(3);
  await db.exec("reset role");
  await db.query(
    "update private.chat_staff set active=false where user_id=$1",
    [manager],
  );
  await asUser(manager, "aal2");
  await expect(contacts()).rejects.toThrow(/Chat authorization/);
});

test("directory is restricted to existing conversations and does not grant direct auth access", async () => {
  await asUser(manager, "aal2");
  expect((await contacts()).map((row) => row.user_id)).toEqual([
    literal,
    bob,
    alice,
  ]);
  expect(await contacts("editor")).toEqual([]);
  await expect(db.query("select email from auth.users")).rejects.toThrow(
    /permission denied/,
  );
  await asUser(alice);
  expect(
    (await db.query("select user_id from care_conversations")).rows,
  ).toEqual([{ user_id: alice }]);
  await expect(contacts()).rejects.toThrow(/Chat authorization/);
});

test("email search is case insensitive and treats wildcard characters literally", async () => {
  await asUser(manager, "aal2");
  expect((await contacts(" ALICE@ ")).map((r) => r.user_id)).toEqual([alice]);
  for (const term of ["%", "_", "\\", "%_\\"])
    expect((await contacts(term)).map((r) => r.user_id)).toEqual([literal]);
  expect(await contacts("' or true --")).toEqual([]);
});

test("latest activity determines ordering and preview is capped at 120 characters", async () => {
  await db.query(
    "insert into care_messages(id,conversation_id,sender_id,body,created_at)values($1,$2,$3,$4,'2026-10-20'),($5,$2,$3,'Older','2026-10-19')",
    [
      "ffffffff-ffff-4fff-8fff-ffffffffffff",
      alice,
      manager,
      "🌿".repeat(140),
      "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    ],
  );
  await asUser(manager, "aal2");
  const rows = await contacts();
  expect(rows.map((r) => r.user_id)).toEqual([alice, literal, bob]);
  expect(Array.from(rows[0].last_message_preview)).toHaveLength(120);
  expect(rows[0].last_message_at?.toISOString()).toBe(
    "2026-10-20T00:00:00.000Z",
  );
  expect(rows[1].last_message_preview).toBe("");
  expect(rows[1].last_message_at).toBeNull();
  expect((await contacts("", 1, 1)).map((r) => r.user_id)).toEqual([literal]);
});

test("page and search limits reject invalid arguments", async () => {
  await asUser(manager, "aal2");
  for (const args of [
    ["x".repeat(255), 0, 50],
    ["", -1, 50],
    ["", 0, 0],
    ["", 0, 51],
  ] as const)
    await expect(contacts(...args)).rejects.toThrow(/Invalid conversation/);
});

test("metadata editing requires document role and MFA and validates content", async () => {
  const doc = await readyDocument();
  for (const [id, aal] of [
    [alice, "aal2"],
    [editor, "aal2"],
    [manager, "aal1"],
  ]) {
    await asUser(id, aal);
    await expect(edit(doc.id, doc.version)).rejects.toThrow(
      /Document manager authorization/,
    );
  }
  await asUser(manager, "aal2");
  for (const title of ["", "  ", "x".repeat(181)])
    await expect(edit(doc.id, doc.version, title)).rejects.toThrow(
      /Invalid document/,
    );
  await expect(
    db.query("select update_document_details($1,'Titolo',$2,$3)", [
      doc.id,
      "x".repeat(2001),
      doc.version,
    ]),
  ).rejects.toThrow(/Invalid document/);
});

test("renaming preserves active state, file identity, recipients and access audit", async () => {
  const doc = await readyDocument();
  const before = (
    await db.query("select * from session_documents where id=$1", [doc.id])
  ).rows[0];
  const changed = await edit(doc.id, doc.version, "  Titolo corretto  ");
  expect(changed).toMatchObject({
    title: "Titolo corretto",
    description: "Nuova descrizione",
    active: true,
    state: "ready",
  });
  const after = (
    await db.query("select * from session_documents where id=$1", [doc.id])
  ).rows[0];
  for (const key of ["storage_path", "file_name", "mime_type", "ready_at"])
    expect(after[key]).toEqual(before[key]);
  expect(
    (await db.query("select user_id from session_document_access")).rows,
  ).toEqual([{ user_id: alice }]);
  await db.exec("reset role");
  expect(
    (await db.query("select * from private.document_access_events")).rows,
  ).toEqual([]);
});

test("a stale edit cannot overwrite a metadata change, archive, or recipient update", async () => {
  const doc = await readyDocument();
  await edit(doc.id, doc.version);
  await expect(edit(doc.id, doc.version)).rejects.toThrow(/Document changed/);
  await expect(edit(doc.id, null)).rejects.toThrow(/Document changed/);

  const beforeArchive = await docVersion(doc.id);
  await db.query("select update_document($1,'Nuovo titolo','Desc',false)", [
    doc.id,
  ]);
  await expect(edit(doc.id, beforeArchive)).rejects.toMatchObject({
    code: "40001",
  });
  expect(
    (
      await db.query("select active from session_documents where id=$1", [
        doc.id,
      ])
    ).rows,
  ).toEqual([{ active: false }]);
  expect(
    (await db.query("select * from session_document_access")).rows,
  ).toEqual([]);
  // A current rename of an archived document never reactivates or shares it.
  expect(await edit(doc.id, await docVersion(doc.id))).toMatchObject({
    active: false,
  });
  await db.query("select update_document($1,'Titolo','Desc',true)", [doc.id]);
  const beforeGrant = await docVersion(doc.id);
  await db.query("select set_document_recipients($1,$2::uuid[])", [
    doc.id,
    [bob],
  ]);
  await expect(edit(doc.id, beforeGrant)).rejects.toMatchObject({
    code: "40001",
  });
  expect(
    (await db.query("select user_id from session_document_access")).rows,
  ).toEqual([{ user_id: bob }]);
});

test("state changes reject stale versions and never overwrite labels or restore grants", async () => {
  const doc = await readyDocument();
  await edit(doc.id, doc.version, "Titolo corretto da altra sessione");
  await expect(
    db.query("select update_document_state($1,false,$2)", [
      doc.id,
      doc.version,
    ]),
  ).rejects.toMatchObject({ code: "40001" });
  const current = await docVersion(doc.id);
  for (const [id, aal] of [
    [editor, "aal2"],
    [manager, "aal1"],
  ]) {
    await asUser(id, aal);
    await expect(
      db.query("select update_document_state($1,false,$2)", [doc.id, current]),
    ).rejects.toThrow(/authorization and MFA/);
  }
  await asUser(manager, "aal2");
  await db.query("select update_document_state($1,false,$2)", [
    doc.id,
    current,
  ]);
  expect(
    (
      await db.query("select title,active from session_documents where id=$1", [
        doc.id,
      ])
    ).rows,
  ).toEqual([{ title: "Titolo corretto da altra sessione", active: false }]);
  expect(
    (await db.query("select * from session_document_access")).rows,
  ).toEqual([]);
  await expect(
    db.query("select update_document_state($1,true,$2)", [doc.id, current]),
  ).rejects.toMatchObject({ code: "40001" });
  await db.query("select update_document_state($1,true,$2)", [
    doc.id,
    await docVersion(doc.id),
  ]);
  expect(
    (await db.query("select * from session_document_access")).rows,
  ).toEqual([]);
});
