import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { articles, categories } from "../packages/core/src/fixtures";
import {
  articleRecoverySQL,
  recoveredArticles,
} from "../scripts/prepare-article-recovery.mjs";

const editor = "a4da70b3-f524-49d6-8221-ed4aaf4192c1";
const reader = "a4da70b3-f524-49d6-8221-ed4aaf4192c2";
const differentId = "a4da70b3-f524-49d6-8221-ed4aaf4192c3";
let db: PGlite;
let seed: string;

async function editorialTriggers() {
  return (
    await db.query<{ tgname: string; tgenabled: string }>(`
      select tgname,tgenabled from pg_trigger
      where tgrelid='public.articles'::regclass and not tgisinternal
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
  await db.query("insert into auth.users(id) values($1),($2)", [
    editor,
    reader,
  ]);
  await db.query(
    `insert into private.editor_memberships(
      user_id,professional_name,professional_role
    ) values($1,'Redattrice di test','Ostetrica')`,
    [editor],
  );
  seed = await readFile(
    new URL("../supabase/seed.sql", import.meta.url),
    "utf8",
  );
}, 20000);

beforeEach(async () => {
  await db.exec(`
    rollback; reset role; set test.uid='';
    alter table public.articles enable trigger articles_validate;
    truncate public.article_categories,public.authors cascade;
  `);
  await db.exec(seed);
});

afterAll(async () => {
  await db.close();
});

test("the checked-in recovery is deterministic and retains original content and attribution", async () => {
  expect(
    await readFile(
      new URL(
        "../../release-letture/IMPORTA-LETTURE-IN-BOZZA.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ).toBe(articleRecoverySQL);
  expect(recoveredArticles).toHaveLength(14);
  // Independently checked with Python uuid.uuid5(uuid.NAMESPACE_URL, name).
  expect(recoveredArticles[0].id).toBe("c43584cb-9a0d-5126-94a3-b640d9e18f29");
  expect(new Set(recoveredArticles.map((article) => article.id)).size).toBe(14);
  for (const [index, article] of recoveredArticles.entries()) {
    expect(article.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(article).toEqual({
      ...articles[index],
      id: article.id,
      status: "draft",
      approved: false,
      isDemo: true,
      publishedAt: null,
      reviewedAt: null,
      reviewerName: null,
    });
  }
});

test("imports fourteen private drafts and their original references without author or clinical-review fabrication", async () => {
  await db.exec(articleRecoverySQL);
  const rows = await db.query<{
    id: string;
    slug: string;
    category_id: string;
    author_id: null;
    status: string;
    approved: boolean;
    is_demo: boolean;
    payload: unknown;
  }>("select * from public.articles order by slug");
  expect(rows.rows).toHaveLength(14);
  for (const row of rows.rows) {
    const source = recoveredArticles.find((article) => article.id === row.id);
    expect(row).toMatchObject({
      slug: source?.slug,
      category_id: source?.categoryId,
      author_id: null,
      status: "draft",
      approved: false,
      is_demo: true,
      payload: source,
    });
    expect(
      (
        await db.query<{ label: string; url: string }>(
          "select label,url from public.article_references where article_id=$1 order by label,url",
          [row.id],
        )
      ).rows,
    ).toEqual(
      [...(source?.references ?? [])].sort(
        (a, b) => a.label.localeCompare(b.label) || a.url.localeCompare(b.url),
      ),
    );
  }
  expect(
    (await db.query("select * from public.article_categories")).rows,
  ).toHaveLength(categories.length);
  expect((await db.query("select * from public.authors")).rows).toEqual([]);
  expect(
    (await db.query("select * from public.editorial_reviews")).rows,
  ).toEqual([]);
  await db.exec("set role anon");
  expect((await db.query("select * from public.articles")).rows).toEqual([]);
  expect(
    (await db.query("select * from public.article_references")).rows,
  ).toEqual([]);
  expect((await db.query("select * from public.authors")).rows).toEqual([]);
});

test("reruns preserve edited drafts, categories, references and saved links exactly", async () => {
  await db.exec(articleRecoverySQL);
  const first = recoveredArticles[0];
  await db.query("select set_config('test.uid',$1,false)", [editor]);
  await db.query(
    `update public.articles set status='archived',is_demo=false,
      payload=payload || '{"title":"Edizione conservata da Studio"}'::jsonb
      where id=$1`,
    [first.id],
  );
  await db.query("delete from public.article_references where article_id=$1", [
    first.id,
  ]);
  await db.query(
    "insert into public.article_references(article_id,label,url) values($1,'Fonte scelta da Gaia','https://example.invalid/fonte')",
    [first.id],
  );
  await db.query(
    "insert into public.user_favorites(user_id,article_id) values($1,$2)",
    [reader, first.id],
  );
  await db.exec(
    "update public.article_categories set name='Categoria personalizzata' where id='pregnancy'; set test.uid='';",
  );
  const before = (
    await db.query(`
      select jsonb_build_object(
        'articles',(select jsonb_agg(to_jsonb(a) order by a.id) from public.articles a),
        'references',(select jsonb_agg(to_jsonb(r) order by r.id) from public.article_references r),
        'categories',(select jsonb_agg(to_jsonb(c) order by c.id) from public.article_categories c),
        'favorites',(select jsonb_agg(to_jsonb(f) order by f.article_id) from public.user_favorites f)
      ) as snapshot
    `)
  ).rows;
  await db.exec(articleRecoverySQL);
  expect(
    (
      await db.query(`
        select jsonb_build_object(
          'articles',(select jsonb_agg(to_jsonb(a) order by a.id) from public.articles a),
          'references',(select jsonb_agg(to_jsonb(r) order by r.id) from public.article_references r),
          'categories',(select jsonb_agg(to_jsonb(c) order by c.id) from public.article_categories c),
          'favorites',(select jsonb_agg(to_jsonb(f) order by f.article_id) from public.user_favorites f)
        ) as snapshot
      `)
    ).rows,
  ).toEqual(before);
  expect(
    (await db.query("select * from public.editorial_reviews")).rows,
  ).toEqual([]);
});

test("ID and slug collisions keep both pre-existing articles without adding their archived references", async () => {
  await db.query("select set_config('test.uid',$1,false)", [editor]);
  const existing = [
    { ...recoveredArticles[0], id: differentId, title: "Titolo preesistente" },
    {
      ...recoveredArticles[1],
      slug: "indirizzo-preesistente-con-id-riservato",
      title: "Altra lettura preesistente",
    },
  ];
  for (const article of existing)
    await db.query(
      "insert into public.articles(id,slug,category_id,status,approved,is_demo,payload) values($1,$2,$3,'draft',false,false,$4)",
      [
        article.id,
        article.slug,
        article.categoryId,
        { ...article, isDemo: false },
      ],
    );
  const before = (await db.query("select * from public.articles order by id"))
    .rows;
  await db.exec("set test.uid=''");
  await db.exec(articleRecoverySQL);
  expect((await db.query("select id from public.articles")).rows).toHaveLength(
    14,
  );
  expect(
    (
      await db.query(
        "select * from public.articles where id=$1 or id=$2 order by id",
        existing.map((article) => article.id),
      )
    ).rows,
  ).toEqual(before);
  expect(
    (
      await db.query(
        "select * from public.article_references where article_id=$1 or article_id=$2",
        existing.map((article) => article.id),
      )
    ).rows,
  ).toEqual([]);
});

test("restores editorial triggers and leaves RLS, client privileges and authorization effective", async () => {
  await db.exec(articleRecoverySQL);
  expect(await editorialTriggers()).toEqual([
    { tgname: "articles_review", tgenabled: "O" },
    { tgname: "articles_validate", tgenabled: "O" },
  ]);
  expect(
    (
      await db.query<{ relrowsecurity: boolean }>(`
        select relrowsecurity from pg_class
        where oid in ('public.articles'::regclass,'public.authors'::regclass,
          'public.article_references'::regclass,'public.editorial_reviews'::regclass)
      `)
    ).rows.every((row) => row.relrowsecurity),
  ).toBe(true);
  await db.exec("set role authenticated");
  await db.query("select set_config('test.uid',$1,false)", [reader]);
  expect((await db.query("select * from public.articles")).rows).toEqual([]);
  await expect(
    db.query("select public.save_article($1::jsonb)", [recoveredArticles[0]]),
  ).rejects.toThrow("Editor authorization required");
  await expect(
    db.query("delete from public.articles where id=$1", [
      recoveredArticles[0].id,
    ]),
  ).rejects.toThrow("permission denied");
  await db.exec("reset role; set test.uid=''");
  await expect(
    db.query(
      `update public.articles set payload=payload||'{"title":"Modifica non autorizzata"}'
      where id=$1`,
      [recoveredArticles[0].id],
    ),
  ).rejects.toThrow("Editor authorization required");
});

test("a reference constraint failure rolls back every imported row and restores validation", async () => {
  const invalid = articleRecoverySQL.replace(
    '"https://www.nhs.uk/pregnancy/"',
    '"http://example.invalid/fonte-non-https"',
  );
  expect(invalid).not.toBe(articleRecoverySQL);
  await expect(db.exec(invalid)).rejects.toThrow("check constraint");
  await db.exec("rollback");
  expect((await db.query("select * from public.articles")).rows).toEqual([]);
  expect(
    (await db.query("select * from public.article_references")).rows,
  ).toEqual([]);
  expect(
    (await db.query("select * from public.editorial_reviews")).rows,
  ).toEqual([]);
  expect(
    (await db.query("select * from public.article_categories")).rows,
  ).toHaveLength(categories.length);
  expect(await editorialTriggers()).toEqual([
    { tgname: "articles_review", tgenabled: "O" },
    { tgname: "articles_validate", tgenabled: "O" },
  ]);
});

test("refuses recovery when existing editorial triggers are disabled and preserves their original state", async () => {
  await db.exec(
    "alter table public.articles disable trigger articles_validate",
  );
  await expect(db.exec(articleRecoverySQL)).rejects.toThrow(
    "Il recupero richiede i normali trigger editoriali attivi",
  );
  await db.exec("rollback");
  expect((await db.query("select * from public.articles")).rows).toEqual([]);
  expect(await editorialTriggers()).toEqual([
    { tgname: "articles_review", tgenabled: "O" },
    { tgname: "articles_validate", tgenabled: "D" },
  ]);
  await db.exec("alter table public.articles enable trigger articles_validate");
});
