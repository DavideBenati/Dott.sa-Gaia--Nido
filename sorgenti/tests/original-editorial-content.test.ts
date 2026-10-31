import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Article } from "../packages/core/src/types";

const reviewer = "2cd0493e-4d72-41fb-b842-4086cf8f30a1";
const editor = "2cd0493e-4d72-41fb-b842-4086cf8f30a2";
const reader = "2cd0493e-4d72-41fb-b842-4086cf8f30a3";
let db: PGlite;
let migration: string;
let seed: string;

function article(patch: Partial<Article> = {}): Article {
  const id = randomUUID();
  const date = new Date().toISOString().slice(0, 10);
  return {
    id,
    slug: `originale-${id}`,
    title: "Un testo originale di Gaia",
    subtitle: "Un messaggio educativo originale.",
    categoryId: "home",
    stage: "all",
    weekFrom: null,
    weekTo: null,
    imageUrl: "https://example.invalid/copertina.jpg",
    readingMinutes: 3,
    authorName: "Dott.sa Gaia",
    authorRole: "Ostetrica",
    publishedAt: date,
    reviewedAt: date,
    reviewerName: "Dott.sa Gaia",
    status: "published",
    approved: true,
    isDemo: false,
    sections: [{ heading: "Benvenuti", paragraphs: ["Un testo di prova."] }],
    references: [],
    videoUrl: null,
    ...patch,
  };
}

async function save(document: Article) {
  return (
    await db.query<{ document: Article }>(
      "select public.save_article($1::jsonb) as document",
      [document],
    )
  ).rows[0].document;
}

async function asUser(id: string, aal = "aal2") {
  await db.query("select set_config('test.uid',$1,false)", [id]);
  await db.query("select set_config('test.aal',$1,false)", [aal]);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as
      $$select jsonb_build_object('aal',current_setting('test.aal',true))$$;
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
  // Use the deployed workspace's actual editor/MFA function without adding
  // unrelated newsletter, booking or private-chat fixtures to this test.
  const workspace = await readFile(
    new URL(
      "../supabase/migrations/202610230005_professional_workspace.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(
    "alter table private.editor_memberships add column require_mfa boolean not null default false;" +
      workspace.slice(
        workspace.indexOf("create or replace function public.is_editor()"),
        workspace.indexOf("create or replace function public.is_chat_staff()"),
      ),
  );
  await db.query("insert into auth.users(id) values($1),($2),($3)", [
    reviewer,
    editor,
    reader,
  ]);
  await db.query(
    `insert into private.editor_memberships(
      user_id,professional_name,professional_role,qualification_verified,
      credential_reference,require_mfa
    ) values
      ($1,'Dott.sa Gaia','Ostetrica',true,'isolated reviewer fixture',true),
      ($2,'Redattrice di test','Amministrazione',false,null,false)`,
    [reviewer, editor],
  );
  seed = await readFile(
    new URL("../supabase/seed.sql", import.meta.url),
    "utf8",
  );
  migration = await readFile(
    new URL(
      "../supabase/migrations/202610300016_original_editorial_content.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(migration);
}, 20000);

beforeEach(async () => {
  await db.exec(`
    rollback; reset role; set test.uid=''; set test.aal='aal2';
    truncate public.article_categories,public.authors,public.checklists cascade;
  `);
  await db.exec(seed);
  await asUser(reviewer);
});

afterAll(async () => {
  await db.close();
});

test("a verified reviewer can publish explicitly original material without external links", async () => {
  await db.exec("set role authenticated");
  const saved = await save(article({ originalContent: true }));
  expect(saved.originalContent).toBe(true);
  expect(saved.status).toBe("published");
  expect(saved.approved).toBe(true);
  expect(saved.references).toEqual([]);
  await db.exec("reset role");
  expect(
    (
      await db.query(
        "select reviewer_user_id,reviewer_name,approved from public.editorial_reviews",
      )
    ).rows,
  ).toEqual([
    {
      reviewer_user_id: reviewer,
      reviewer_name: "Dott.sa Gaia",
      approved: true,
    },
  ]);
  await db.exec("set role anon");
  expect((await db.query("select payload from public.articles")).rows).toEqual([
    { payload: saved },
  ]);
});

test("legacy or externally sourced articles still require actual references", async () => {
  for (const originalContent of [undefined, false]) {
    const document = article();
    if (originalContent !== undefined)
      document.originalContent = originalContent;
    await expect(save(document)).rejects.toThrow(
      "Sources or an explicit original-content declaration are required",
    );
    const saved = await save({
      ...document,
      references: [
        { label: "Fonte consultata", url: "https://example.invalid/fonte" },
      ],
    });
    expect(saved.approved).toBe(true);
    expect(saved.originalContent).toBe(originalContent);
  }
});

test("the original-content declaration rejects null, strings, numbers and containers in drafts and publication", async () => {
  for (const value of [null, "true", "false", 0, 1, [], {}]) {
    for (const published of [false, true]) {
      const document = article({
        status: published ? "published" : "draft",
        approved: published,
      });
      await expect(
        save({ ...document, originalContent: value } as Article),
      ).rejects.toThrow("Original-content declaration must be a boolean");
    }
  }
  expect((await db.query("select id from public.articles")).rows).toEqual([]);
});

test("an original declaration does not excuse malformed supplied references", async () => {
  for (const references of [
    [{ label: "", url: "https://example.invalid/fonte" }],
    [{ label: "Fonte", url: "http://example.invalid/fonte" }],
    [{ label: "Fonte" }],
    [null],
    ["una fonte"],
  ]) {
    await expect(
      save({ ...article({ originalContent: true }), references } as Article),
    ).rejects.toThrow("Each source needs a title and a valid HTTPS URL");
  }
});

test("original material keeps reviewer authorization, MFA and identity checks", async () => {
  for (const [id, aal] of [
    [editor, "aal2"],
    [reader, "aal2"],
    [reviewer, "aal1"],
    ["", "aal2"],
  ]) {
    await asUser(id, aal);
    await expect(save(article({ originalContent: true }))).rejects.toThrow(
      /Editor authorization required|verified clinical reviewer/i,
    );
  }
  await asUser(reviewer);
  await expect(
    save(article({ originalContent: true, reviewerName: "Altra persona" })),
  ).rejects.toThrow("Clinical reviewer identity must match");
  expect((await db.query("select id from public.articles")).rows).toEqual([]);
  expect(
    (await db.query("select id from public.editorial_reviews")).rows,
  ).toEqual([]);
});

test("changing an existing original-content declaration revokes its earlier approval", async () => {
  const saved = await save(
    article({
      originalContent: false,
      references: [
        { label: "Fonte consultata", url: "https://example.invalid/fonte" },
      ],
    }),
  );
  const changed = await save({ ...saved, originalContent: true });
  expect(changed.status).toBe("in_review");
  expect(changed.approved).toBe(false);
  expect(changed.reviewedAt).toBeNull();
  expect(changed.reviewerName).toBeNull();
  expect(
    (await db.query("select id from public.editorial_reviews")).rows,
  ).toHaveLength(1);
  await db.exec("set role anon");
  expect((await db.query("select id from public.articles")).rows).toEqual([]);
});

test("the migration does not edit content, attest authorship, create reviews or change privileges", async () => {
  await save(
    article({
      status: "draft",
      approved: false,
      reviewedAt: null,
      reviewerName: null,
    }),
  );
  const snapshot = async () =>
    (
      await db.query(`
        select jsonb_build_object(
          'articles',(select jsonb_agg(to_jsonb(a)) from public.articles a),
          'authors',(select jsonb_agg(to_jsonb(a)) from public.authors a),
          'reviews',(select jsonb_agg(to_jsonb(r)) from public.editorial_reviews r),
          'memberships',(select jsonb_agg(to_jsonb(m) order by m.user_id) from private.editor_memberships m),
          'policies',(select jsonb_agg(to_jsonb(p) order by p.tablename,p.policyname) from pg_policies p where schemaname in ('public','private')),
          'trigger',(
            select jsonb_build_object('acl',p.proacl::text,'security_definer',p.prosecdef,'configuration',p.proconfig)
            from pg_proc p where p.oid='private.validate_editorial()'::regprocedure
          )
        ) as snapshot
      `)
    ).rows;
  const before = await snapshot();
  await db.exec(migration);
  expect(await snapshot()).toEqual(before);
});

test("checklist publication behavior stays unchanged", async () => {
  const id = randomUUID();
  const item = { id: randomUUID(), label: "Preparare una domanda" };
  const document = {
    id,
    title: "Una checklist di prova",
    description: "Una sola attività.",
    stage: "all",
    status: "published",
    approved: true,
    isDemo: false,
    items: [item],
  };
  const saved = (
    await db.query<{ payload: unknown }>(
      "select public.save_checklist($1::jsonb) as payload",
      [document],
    )
  ).rows[0].payload;
  expect(saved).toEqual(document);
  await db.exec("set role anon");
  expect(
    (await db.query("select payload from public.checklists")).rows,
  ).toEqual([{ payload: document }]);
});
