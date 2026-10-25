import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { suppliedBirthBagChecklist } from "../packages/core/src/supplied-checklists";

const editor = "e2747dc9-87b6-4abe-a812-aaaf17038a11";
const otherChecklist = "e2747dc9-87b6-4abe-a812-aaaf17038a12";
const otherItem = "e2747dc9-87b6-4abe-a812-aaaf17038a13";
let db: PGlite;
let migration: string;
let preservedRows: unknown[];

async function checklistTriggers() {
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
  await db.query("insert into auth.users values($1)", [editor]);
  await db.query(
    "insert into private.editor_memberships(user_id,professional_name,professional_role) values($1,'Professionista precedente','Ostetrica')",
    [editor],
  );
  await db.query("select set_config('test.uid',$1,false)", [editor]);
  await db.query(
    `insert into public.checklists(id,status,approved,is_demo,payload)
      values($1,'draft',false,false,$2)`,
    [
      otherChecklist,
      {
        id: otherChecklist,
        title: "Lista precedente",
        stage: "all",
        items: [],
      },
    ],
  );
  await db.query(
    "insert into public.checklist_items(id,checklist_id,label) values($1,$2,'Attività precedente')",
    [otherItem, otherChecklist],
  );
  preservedRows = (
    await db.query(`select to_jsonb(c) as checklist,to_jsonb(i) as item
      from public.checklists c join public.checklist_items i on i.checklist_id=c.id
      where c.id='${otherChecklist}'`)
  ).rows;
  await db.exec("set test.uid=''");
  migration = await readFile(
    new URL(
      "../supabase/migrations/202610250014_borsa_parto.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(migration);
});

beforeEach(async () => {
  await db.exec("reset role; set test.uid=''");
});

afterAll(async () => {
  await db.close();
});

test("publishes exactly the supplied content without fabricating a clinical review", async () => {
  await db.exec("set role anon");
  const publicRows = await db.query<{ payload: unknown }>(
    "select payload from public.checklists",
  );
  expect(publicRows.rows).toEqual([{ payload: suppliedBirthBagChecklist }]);
  expect(
    (await db.query("select * from public.checklist_items")).rows,
  ).toHaveLength(18);
  expect(
    (await db.query("select * from public.editorial_reviews")).rows,
  ).toEqual([]);
});

test("rerunning preserves other checklists, their items and saved progress", async () => {
  const firstItem = suppliedBirthBagChecklist.items[0].id;
  await db.query(
    "insert into public.checklist_progress(user_id,item_id,completed) values($1,$2,true)",
    [editor, firstItem],
  );
  await db.exec(migration);
  expect(
    (
      await db.query(`select to_jsonb(c) as checklist,to_jsonb(i) as item
        from public.checklists c join public.checklist_items i on i.checklist_id=c.id
        where c.id='${otherChecklist}'`)
    ).rows,
  ).toEqual(preservedRows);
  expect(
    (await db.query("select * from public.editorial_reviews")).rows,
  ).toEqual([]);
  expect(
    (
      await db.query(
        "select completed from public.checklist_progress where item_id=$1",
        [firstItem],
      )
    ).rows,
  ).toEqual([{ completed: true }]);
  expect(
    (await db.query("select id from public.checklists")).rows,
  ).toHaveLength(2);
  expect(
    (await db.query("select id from public.checklist_items")).rows,
  ).toHaveLength(19);
});

test("restores both editorial triggers and preserves ordinary authorization and review invalidation", async () => {
  expect(await checklistTriggers()).toEqual([
    { tgname: "checklists_review", tgenabled: "O" },
    { tgname: "checklists_validate", tgenabled: "O" },
  ]);
  await expect(
    db.query(
      'update public.checklists set payload=payload||\'{"title":"Non autorizzato"}\' where id=$1',
      [suppliedBirthBagChecklist.id],
    ),
  ).rejects.toThrow("Editor authorization required");
  await db.query("select set_config('test.uid',$1,false)", [editor]);
  await db.exec("begin");
  const changed = await db.query<{ status: string; approved: boolean }>(
    'update public.checklists set payload=payload||\'{"title":"Edizione modificata"}\' where id=$1 returning status,approved',
    [suppliedBirthBagChecklist.id],
  );
  expect(changed.rows).toEqual([{ status: "in_review", approved: false }]);
  await db.exec("rollback");
});

test("a conflicting item ID aborts atomically and restores the original triggers", async () => {
  const firstItem = suppliedBirthBagChecklist.items[0].id;
  await db.query(
    "update public.checklist_items set checklist_id=$1 where id=$2",
    [otherChecklist, firstItem],
  );
  await expect(db.exec(migration)).rejects.toThrow(
    "Supplied checklist item ID belongs to another checklist",
  );
  await db.exec("rollback");
  expect(await checklistTriggers()).toEqual([
    { tgname: "checklists_review", tgenabled: "O" },
    { tgname: "checklists_validate", tgenabled: "O" },
  ]);
  expect(
    (
      await db.query(
        "select checklist_id from public.checklist_items where id=$1",
        [firstItem],
      )
    ).rows,
  ).toEqual([{ checklist_id: otherChecklist }]);
  await db.query(
    "update public.checklist_items set checklist_id=$1 where id=$2",
    [suppliedBirthBagChecklist.id, firstItem],
  );
});
