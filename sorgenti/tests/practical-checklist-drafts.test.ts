import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { practicalChecklistDrafts } from "../packages/core/src/practical-checklists";

const editor = "93b54c4b-4364-4dca-9797-c01f9cc4ae01";
const reader = "93b54c4b-4364-4dca-9797-c01f9cc4ae02";
const otherChecklist = "93b54c4b-4364-4dca-9797-c01f9cc4ae03";
let db: PGlite;
let migration: string;

async function triggers() {
  return (
    await db.query<{ tgname: string; tgenabled: string }>(`
      select tgname,tgenabled from pg_trigger
      where tgrelid='public.checklists'::regclass and not tgisinternal
      order by tgname
    `)
  ).rows;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    grant usage on schema auth,public to anon,authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid,bucket_id text,name text);
    create function storage.foldername(text) returns text[] language sql immutable as
      $$select string_to_array($1,'/')$$;
  `);
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/202610210001_nido.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.query("insert into auth.users values($1),($2)", [editor, reader]);
  await db.query(
    "insert into private.editor_memberships(user_id,professional_name,professional_role) values($1,'Redattrice di prova','Ostetrica')",
    [editor],
  );
  migration = await readFile(
    new URL(
      "../supabase/migrations/202610310018_practical_checklist_drafts.sql",
      import.meta.url,
    ),
    "utf8",
  );
}, 20000);

beforeEach(async () => {
  await db.exec(`
    rollback; reset role; set test.uid='';
    alter table public.checklists enable trigger checklists_validate;
    alter table public.checklists enable trigger checklists_review;
    truncate public.checklists cascade;
  `);
});

afterAll(async () => {
  await db.close();
});

test("imports exactly the two selected drafts with seventeen stable tasks and no invented review", async () => {
  await db.exec(migration);
  const rows = await db.query<{ payload: unknown }>(
    "select payload from public.checklists order by id",
  );
  expect(rows.rows).toEqual(
    [...practicalChecklistDrafts]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((payload) => ({ payload })),
  );
  expect(
    practicalChecklistDrafts.map((document) => document.items.length),
  ).toEqual([8, 9]);
  expect(
    (await db.query("select * from public.checklist_items")).rows,
  ).toHaveLength(17);
  for (const document of practicalChecklistDrafts) {
    const items = await db.query(
      "select id,label,note,position from public.checklist_items where checklist_id=$1 order by position",
      [document.id],
    );
    expect(items.rows).toEqual(
      document.items.map((item, position) => ({ ...item, position })),
    );
    expect(document).toMatchObject({
      status: "draft",
      approved: false,
      isDemo: false,
    });
  }
  expect(
    (await db.query("select * from public.editorial_reviews")).rows,
  ).toEqual([]);
  expect((await db.query("select * from public.authors")).rows).toEqual([]);
});

test("anonymous and ordinary members cannot see drafts but an authorized editor can", async () => {
  await db.exec(migration);
  await db.exec("set role anon");
  expect((await db.query("select * from public.checklists")).rows).toEqual([]);
  expect((await db.query("select * from public.checklist_items")).rows).toEqual(
    [],
  );
  await db.exec("reset role; set role authenticated");
  await db.query("select set_config('test.uid',$1,false)", [reader]);
  expect((await db.query("select * from public.checklists")).rows).toEqual([]);
  await db.query("select set_config('test.uid',$1,false)", [editor]);
  expect((await db.query("select * from public.checklists")).rows).toHaveLength(
    2,
  );
});

test("reruns preserve edited documents, task labels and saved progress", async () => {
  await db.exec(migration);
  const first = practicalChecklistDrafts[0];
  await db.query("select set_config('test.uid',$1,false)", [editor]);
  await db.query(
    `update public.checklists set status='archived',
      payload=payload||'{"title":"Titolo modificato in Studio"}'::jsonb where id=$1`,
    [first.id],
  );
  await db.query("update public.checklist_items set label=$1 where id=$2", [
    "Attività personalizzata",
    first.items[0].id,
  ]);
  await db.query(
    "insert into public.checklist_progress(user_id,item_id,completed) values($1,$2,true)",
    [reader, first.items[0].id],
  );
  const snapshot = `select jsonb_build_object(
    'documents',(select jsonb_agg(to_jsonb(c) order by id) from public.checklists c),
    'items',(select jsonb_agg(to_jsonb(i) order by id) from public.checklist_items i),
    'progress',(select jsonb_agg(to_jsonb(p) order by item_id) from public.checklist_progress p)
  ) as snapshot`;
  const before = (await db.query(snapshot)).rows;
  await db.exec("set test.uid=''");
  await db.exec(migration);
  expect((await db.query(snapshot)).rows).toEqual(before);
  expect(
    (await db.query("select * from public.editorial_reviews")).rows,
  ).toEqual([]);
});

test("an existing checklist ID is kept without inserting its new tasks", async () => {
  const first = practicalChecklistDrafts[0];
  await db.query("select set_config('test.uid',$1,false)", [editor]);
  const payload = {
    id: first.id,
    title: "Checklist precedente da conservare",
    stage: "all",
    items: [],
  };
  await db.query(
    "insert into public.checklists(id,status,approved,is_demo,payload) values($1,'draft',false,false,$2)",
    [first.id, payload],
  );
  const before = (
    await db.query("select * from public.checklists where id=$1", [first.id])
  ).rows;
  await db.exec("set test.uid=''");
  await db.exec(migration);
  expect(
    (await db.query("select * from public.checklists where id=$1", [first.id]))
      .rows,
  ).toEqual(before);
  expect(
    (await db.query("select * from public.checklist_items")).rows,
  ).toHaveLength(9);
});

test("a conflicting task ID rolls back both drafts and restores validation", async () => {
  await db.query("select set_config('test.uid',$1,false)", [editor]);
  await db.query(
    "insert into public.checklists(id,status,approved,is_demo,payload) values($1,'draft',false,false,$2)",
    [otherChecklist, { title: "Lista precedente", stage: "all", items: [] }],
  );
  await db.query(
    "insert into public.checklist_items(id,checklist_id,label) values($1,$2,'Attività precedente')",
    [practicalChecklistDrafts[1].items[0].id, otherChecklist],
  );
  await db.exec("set test.uid=''");
  await expect(db.exec(migration)).rejects.toThrow();
  await db.exec("rollback");
  expect((await db.query("select id from public.checklists")).rows).toEqual([
    { id: otherChecklist },
  ]);
  expect(
    (await db.query("select id from public.checklist_items")).rows,
  ).toEqual([{ id: practicalChecklistDrafts[1].items[0].id }]);
  expect(await triggers()).toEqual([
    { tgname: "checklists_review", tgenabled: "O" },
    { tgname: "checklists_validate", tgenabled: "O" },
  ]);
});

test("unexpected disabled editorial triggers abort without changing their state", async () => {
  await db.exec(
    "alter table public.checklists disable trigger checklists_validate",
  );
  await expect(db.exec(migration)).rejects.toThrow(
    "Le checklist richiedono i normali trigger editoriali attivi",
  );
  await db.exec("rollback");
  expect((await db.query("select * from public.checklists")).rows).toEqual([]);
  expect(await triggers()).toEqual([
    { tgname: "checklists_review", tgenabled: "O" },
    { tgname: "checklists_validate", tgenabled: "D" },
  ]);
});

test("ordinary authorization and approval rules remain active after import", async () => {
  await db.exec(migration);
  const first = practicalChecklistDrafts[0];
  await expect(
    db.query(
      'update public.checklists set payload=payload||\'{"title":"Aggiornamento non autorizzato"}\'::jsonb where id=$1',
      [first.id],
    ),
  ).rejects.toThrow("Editor authorization required");
  await db.query("select set_config('test.uid',$1,false)", [editor]);
  await expect(
    db.query("select public.save_checklist($1::jsonb)", [
      { ...first, status: "published", approved: true },
    ]),
  ).rejects.toThrow("A verified clinical reviewer must approve content");
  expect(await triggers()).toEqual([
    { tgname: "checklists_review", tgenabled: "O" },
    { tgname: "checklists_validate", tgenabled: "O" },
  ]);
});
