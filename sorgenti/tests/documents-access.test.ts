import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222",
  manager = "33333333-3333-4333-8333-333333333333",
  editor = "44444444-4444-4444-8444-444444444444",
  documentOnly = "55555555-5555-4555-8555-555555555555",
  unconfirmed = "66666666-6666-4666-8666-666666666666",
  chatOnly = "77777777-7777-4777-8777-777777777777";
let db: PGlite;
type Doc = {
  id: string;
  storage_path: string;
  state: string;
  active: boolean;
  owner_id: string | null;
  title: string;
  mime_type: string;
  size_bytes: number;
  file_name: string;
};
async function asUser(id: string, aal = "aal1") {
  await db.exec("reset role;set role authenticated;");
  await db.query(
    "select set_config('test.uid',$1,false),set_config('test.aal',$2,false)",
    [id, aal],
  );
}
async function prepare(
  title = "Materiale della sessione",
  mime = "application/pdf",
  name = "sessione.pdf",
  size = 128,
): Promise<Doc> {
  const result = await db.query<Doc>(
    "select * from prepare_document($1,'Descrizione del materiale',$2,$3,$4)",
    [title, name, mime, size],
  );
  return result.rows[0];
}
async function upload(doc: Doc, size = doc.size_bytes, mime = doc.mime_type) {
  await db.query(
    "insert into storage.objects(bucket_id,name,metadata)values('session-documents',$1,$2)",
    [doc.storage_path, { size, mimetype: mime }],
  );
}
async function ready(): Promise<Doc> {
  await asUser(manager, "aal2");
  const doc = await prepare();
  await upload(doc);
  return (await db.query<Doc>("select * from complete_document($1)", [doc.id]))
    .rows[0];
}
async function grant(doc: Doc, users: string[]) {
  await asUser(manager, "aal2");
  await db.query("select set_document_recipients($1,$2::uuid[])", [
    doc.id,
    users,
  ]);
}
async function file(id: string) {
  return (
    await db.query<{ file: object | null }>(
      "select authorized_document_file($1) file",
      [id],
    )
  ).rows[0].file;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema private;create schema storage;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.jwt()returns jsonb language sql stable as $$select jsonb_build_object('aal',coalesce(current_setting('test.aal',true),'aal1'))$$;
 create table private.editor_memberships(user_id uuid references auth.users(id)on delete cascade,active boolean default true,require_mfa boolean default false);
 create table private.chat_staff(user_id uuid references auth.users(id)on delete cascade,active boolean default true);
 create function public.is_editor()returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from private.editor_memberships where user_id=auth.uid()and active and(not require_mfa or auth.jwt()->>'aal'='aal2'))$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb default '{}',unique(bucket_id,name));
 alter table storage.objects enable row level security;
 grant usage on schema auth,storage,public to anon,authenticated,service_role;
 grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;
 create policy simulated_broad_existing_policy on storage.objects for all to anon,authenticated using(true)with check(true);
 `);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610240007_private_documents.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
beforeEach(async () => {
  await db.exec(
    "reset role;truncate auth.users cascade;truncate public.session_documents cascade;truncate storage.objects;set test.uid='';set test.aal='aal1';",
  );
  for (const [id, email] of [
    [alice, "alice@example.invalid"],
    [bob, "bob@example.invalid"],
    [manager, "gaia@example.invalid"],
    [editor, "editor@example.invalid"],
    [documentOnly, "document@example.invalid"],
    [unconfirmed, "pending@example.invalid"],
    [chatOnly, "chat@example.invalid"],
  ])
    await db.query("insert into auth.users values($1,$2,$3)", [
      id,
      email,
      id === unconfirmed ? null : new Date().toISOString(),
    ]);
  await db.query(
    "insert into private.editor_memberships(user_id)values($1),($2)",
    [manager, editor],
  );
  await db.query("insert into private.document_staff(user_id)values($1),($2)", [
    manager,
    documentOnly,
  ]);
  await db.query("insert into private.chat_staff(user_id)values($1)", [
    chatOnly,
  ]);
});
afterAll(async () => db.close());
test("document role, editor role and verified MFA are all required; membership status reveals only the current account", async () => {
  await asUser(manager);
  expect(
    (
      await db.query<{ status: Record<string, boolean> }>(
        "select document_access_status() status",
      )
    ).rows[0].status,
  ).toEqual({
    membership: true,
    documents_mfa_required: true,
    can_manage: false,
    mfa_satisfied: false,
  });
  await expect(prepare()).rejects.toThrow(/authorization and MFA/);
  await asUser(manager, "aal2");
  expect(
    (await db.query("select can_manage_documents() allowed")).rows,
  ).toEqual([{ allowed: true }]);
  for (const id of [editor, documentOnly, chatOnly, alice]) {
    await asUser(id, "aal2");
    expect(
      (await db.query("select can_manage_documents() allowed")).rows,
    ).toEqual([{ allowed: false }]);
    await expect(
      db.query("select * from search_document_users('example')"),
    ).rejects.toThrow(/authorization and MFA/);
  }
  await db.exec("reset role;set role anon");
  await expect(db.query("select document_access_status()")).rejects.toThrow(
    /permission denied/,
  );
});
test("preparation fixes owner and random object path; completion requires an existing matching file", async () => {
  await asUser(manager, "aal2");
  const doc = await prepare();
  expect(doc.owner_id).toBe(manager);
  expect(doc.state).toBe("uploading");
  expect(doc.active).toBe(false);
  expect(doc.storage_path).toMatch(
    new RegExp("^" + doc.id + "/[a-f0-9-]+\\.pdf$"),
  );
  await expect(
    db.query("select * from complete_document($1)", [doc.id]),
  ).rejects.toThrow(/Stored file/);
  await upload(doc, 999);
  await expect(
    db.query("select * from complete_document($1)", [doc.id]),
  ).rejects.toThrow(/Stored file/);
  await db.exec("reset role");
  await db.query("update storage.objects set metadata=$1 where name=$2", [
    { size: doc.size_bytes, mimetype: doc.mime_type },
    doc.storage_path,
  ]);
  await asUser(manager, "aal2");
  const completed = (
    await db.query<Doc>("select * from complete_document($1)", [doc.id])
  ).rows[0];
  expect(completed.state).toBe("ready");
  expect(completed.active).toBe(true);
  await expect(upload(doc)).rejects.toThrow(/row-level security|duplicate key/);
});
test("only explicitly selected confirmed recipients can list metadata and obtain proxy download metadata", async () => {
  const doc = await ready();
  await grant(doc, [alice]);
  await asUser(alice);
  expect((await db.query("select id from session_documents")).rows).toEqual([
    { id: doc.id },
  ]);
  expect(
    (await db.query("select user_id from session_document_access")).rows,
  ).toEqual([{ user_id: alice }]);
  expect(await file(doc.id)).toMatchObject({
    id: doc.id,
    storage_path: doc.storage_path,
    file_name: doc.file_name,
    mime_type: doc.mime_type,
    size_bytes: 128,
  });
  await asUser(bob);
  expect((await db.query("select id from session_documents")).rows).toEqual([]);
  expect(
    (await db.query("select * from session_document_access")).rows,
  ).toEqual([]);
  expect(await file(doc.id)).toBeNull();
  expect(await file("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBeNull();
  await db.exec("reset role;set role anon");
  await expect(db.query("select * from session_documents")).rejects.toThrow(
    /permission denied/,
  );
  await expect(file(doc.id)).rejects.toThrow(/permission denied/);
});
test("normal clients cannot self-assign, change metadata, enumerate users or inspect staff/audit tables", async () => {
  const doc = await ready();
  await asUser(alice);
  await expect(
    db.query(
      "insert into session_document_access(document_id,user_id)values($1,$2)",
      [doc.id, alice],
    ),
  ).rejects.toThrow(/permission denied/);
  await expect(
    db.query("update session_documents set active=true where id=$1", [doc.id]),
  ).rejects.toThrow(/permission denied/);
  await expect(
    db.query("select set_document_recipients($1,$2::uuid[])", [
      doc.id,
      [alice],
    ]),
  ).rejects.toThrow(/authorization and MFA/);
  await expect(
    db.query("select * from document_recipients($1)", [doc.id]),
  ).rejects.toThrow(/authorization and MFA/);
  await expect(db.query("select * from auth.users")).rejects.toThrow(
    /permission denied/,
  );
  await expect(
    db.query("select * from private.document_staff"),
  ).rejects.toThrow(/permission denied/);
  await expect(
    db.query("select * from private.document_access_events"),
  ).rejects.toThrow(/permission denied/);
});
test("recipient changes are atomic and search is literal, bounded and excludes unconfirmed users", async () => {
  const doc = await ready();
  await grant(doc, [alice]);
  await expect(
    db.query("select set_document_recipients($1,$2::uuid[])", [
      doc.id,
      [bob, unconfirmed],
    ]),
  ).rejects.toThrow(/unconfirmed/);
  expect(
    (await db.query("select user_id from document_recipients($1)", [doc.id]))
      .rows,
  ).toEqual([{ user_id: alice }]);
  await expect(
    db.query("select * from search_document_users('al')"),
  ).rejects.toThrow(/three characters/);
  expect(
    (await db.query("select * from search_document_users('pending')")).rows,
  ).toEqual([]);
  expect(
    (await db.query("select * from search_document_users('%%%')")).rows,
  ).toEqual([]);
  expect(
    (await db.query("select * from search_document_users('ALICE')")).rows,
  ).toEqual([{ user_id: alice, email: "alice@example.invalid" }]);
  await grant(doc, [bob]);
  await asUser(alice);
  expect(await file(doc.id)).toBeNull();
  await asUser(bob);
  expect(await file(doc.id)).not.toBeNull();
});
test("archiving revokes every grant; reactivation never silently reassigns recipients", async () => {
  const doc = await ready();
  await grant(doc, [alice, bob]);
  await db.query("select update_document($1,'Archivio','Descrizione',false)", [
    doc.id,
  ]);
  expect(
    (await db.query("select * from document_recipients($1)", [doc.id])).rows,
  ).toHaveLength(0);
  await asUser(alice);
  expect((await db.query("select id from session_documents")).rows).toEqual([]);
  expect(await file(doc.id)).toBeNull();
  await asUser(manager, "aal2");
  expect(await file(doc.id)).not.toBeNull();
  await expect(
    db.query("select set_document_recipients($1,$2::uuid[])", [
      doc.id,
      [alice],
    ]),
  ).rejects.toThrow(/Active ready/);
  await db.query("select set_document_recipients($1,$2::uuid[])", [doc.id, []]);
  await db.query("select update_document($1,'Riattivato','Descrizione',true)", [
    doc.id,
  ]);
  await asUser(alice);
  expect(await file(doc.id)).toBeNull();
  await asUser(manager, "aal2");
  await db.query("select set_document_recipients($1,$2::uuid[])", [
    doc.id,
    [alice],
  ]);
  await asUser(alice);
  expect(await file(doc.id)).not.toBeNull();
});
test("Storage reads/signing/listing and client overwrite/delete remain denied even with an unrelated broad policy", async () => {
  const doc = await ready();
  await grant(doc, [alice]);
  for (const user of [alice, bob, manager]) {
    await asUser(user, "aal2");
    expect(
      (
        await db.query(
          "select * from storage.objects where bucket_id='session-documents'",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "delete from storage.objects where bucket_id='session-documents' returning id",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "update storage.objects set metadata='{}' where bucket_id='session-documents' returning id",
        )
      ).rows,
    ).toHaveLength(0);
  }
  await db.exec("reset role;set role anon");
  expect(
    (
      await db.query(
        "select * from storage.objects where bucket_id='session-documents'",
      )
    ).rows,
  ).toHaveLength(0);
  await db.exec("reset role;set role service_role");
  expect(
    (
      await db.query(
        "select * from storage.objects where bucket_id='session-documents'",
      )
    ).rows,
  ).toHaveLength(1);
});
test("upload requires a reserved own pending row and the bucket remains private with exact type/size limits", async () => {
  await asUser(manager, "aal2");
  const doc = await prepare();
  await asUser(editor, "aal2");
  await expect(upload(doc)).rejects.toThrow(/row-level security/);
  await asUser(alice);
  await expect(upload(doc)).rejects.toThrow(/row-level security/);
  await asUser(manager, "aal2");
  await expect(
    db.query(
      "insert into storage.objects(bucket_id,name)values('session-documents','guessed.pdf')",
    ),
  ).rejects.toThrow(/row-level security/);
  await upload(doc);
  await db.exec("reset role");
  const bucket = (
    await db.query<{
      public: boolean;
      file_size_limit: bigint;
      allowed_mime_types: string[];
    }>(
      "select public,file_size_limit,allowed_mime_types from storage.buckets where id=$1",
      ["session-documents"],
    )
  ).rows[0];
  expect(bucket.public).toBe(false);
  expect(Number(bucket.file_size_limit)).toBe(20971520);
  expect(bucket.allowed_mime_types).toHaveLength(3);
});
test("unsupported, oversized and unsafe filenames are rejected; aborted files remain inaccessible", async () => {
  await asUser(manager, "aal2");
  await expect(prepare("Test", "text/html", "page.html")).rejects.toThrow(
    /Unsupported/,
  );
  await expect(
    prepare("Test", "application/pdf", "sessione.pdf", 20971521),
  ).rejects.toThrow(/check constraint/);
  await expect(
    prepare("Test", "application/pdf", "../sessione.pdf"),
  ).rejects.toThrow(/check constraint/);
  const doc = await prepare();
  await upload(doc);
  const failed = (
    await db.query<Doc>("select * from abort_document($1)", [doc.id])
  ).rows[0];
  expect(failed.state).toBe("failed");
  expect(failed.active).toBe(false);
  expect(await file(doc.id)).toBeNull();
  await expect(
    db.query("select * from complete_document($1)", [doc.id]),
  ).rejects.toThrow(/Pending upload/);
});
test("deleting a recipient account cascades grants and recipient audit identifiers", async () => {
  const doc = await ready();
  await grant(doc, [alice, bob]);
  await db.exec("reset role");
  await db.query("delete from auth.users where id=$1", [alice]);
  expect(
    (
      await db.query(
        "select user_id from session_document_access order by user_id",
      )
    ).rows,
  ).toEqual([{ user_id: bob }]);
  expect(
    (
      await db.query(
        "select recipient_id from private.document_access_events where recipient_id=$1",
        [alice],
      )
    ).rows,
  ).toHaveLength(0);
});

test("staff MFA cannot be bypassed by assigning the same account as a recipient", async () => {
  const doc = await ready();
  await grant(doc, [manager, alice]);
  await asUser(manager, "aal1");
  expect(
    (await db.query("select id from session_documents")).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select * from session_document_access")).rows,
  ).toHaveLength(0);
  expect(await file(doc.id)).toBeNull();
  await asUser(manager, "aal2");
  expect(await file(doc.id)).not.toBeNull();
  await asUser(alice, "aal1");
  expect(await file(doc.id)).not.toBeNull();
});

test("recipient search never returns more than twenty confirmed accounts", async () => {
  await db.exec("reset role");
  for (let i = 0; i < 25; i++)
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at)values(gen_random_uuid(),$1,now())",
      [`bounded-${String(i).padStart(2, "0")}@example.invalid`],
    );
  await asUser(manager, "aal2");
  const result = await db.query(
    "select * from search_document_users('bounded-')",
  );
  expect(result.rows).toHaveLength(20);
});

test("a stale editor selection cannot silently restore a revoked recipient", async () => {
  await asUser(manager, "aal2");
  const doc = await prepare();
  await upload(doc);
  await db.query("select complete_document($1)", [doc.id]);
  await db.query("select set_document_recipients($1,$2)", [doc.id, [alice]]);
  await db.query("select set_document_recipients($1,$2,$3)", [
    doc.id,
    [],
    [alice],
  ]);
  await expect(
    db.query("select set_document_recipients($1,$2,$3)", [
      doc.id,
      [alice, bob],
      [alice],
    ]),
  ).rejects.toThrow(/Recipients changed/);
  expect(
    (
      await db.query(
        "select user_id from session_document_access where document_id=$1",
        [doc.id],
      )
    ).rows,
  ).toEqual([]);
  await db.query("select set_document_recipients($1,$2,$3)", [
    doc.id,
    [bob],
    [],
  ]);
  expect(
    (
      await db.query(
        "select user_id from session_document_access where document_id=$1",
        [doc.id],
      )
    ).rows,
  ).toEqual([{ user_id: bob }]);
});
