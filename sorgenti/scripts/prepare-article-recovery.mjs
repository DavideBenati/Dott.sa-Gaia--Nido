// Recover the archived library as private editorial drafts. This script only
// writes a reviewable SQL file; it never connects to a database or publishes.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { articles, categories } from "../packages/core/src/fixtures.ts";

// RFC 4122 URL namespace. The fixed name preserves identity across rebuilds;
// existing database rows are never overwritten, even on ID or slug collision.
const namespace = Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex");
function recoveredId(slug) {
  const bytes = createHash("sha1")
    .update(namespace)
    .update(`https://metimaia.com/recovery/article/${slug}`, "utf8")
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const recoveredArticles = articles.map((article) => ({
  ...article,
  id: recoveredId(article.slug),
  status: "draft",
  approved: false,
  isDemo: true,
  publishedAt: null,
  reviewedAt: null,
  reviewerName: null,
}));

const documents = JSON.stringify(recoveredArticles, null, 2);
const categoryRows = categories
  .map(
    (category) =>
      `(${[category.id, category.name, category.icon].map((value) => `'${value.replaceAll("'", "''")}'`).join(",")})`,
  )
  .join(",\n");
if (documents.includes("$maia_recovery_documents$"))
  throw new Error("Unexpected SQL delimiter in archived article content.");
if (
  recoveredArticles.length !== 14 ||
  new Set(recoveredArticles.map((article) => article.id)).size !== 14 ||
  new Set(recoveredArticles.map((article) => article.slug)).size !== 14 ||
  recoveredArticles.some(
    (article) =>
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug) ||
      !categories.some((category) => category.id === article.categoryId),
  )
)
  throw new Error("The archived library no longer matches this recovery.");

export const articleRecoverySQL = `-- MetiMaia: recupero delle 14 letture dell'archivio, SOLO IN BOZZA.
-- I testi restano dimostrativi e NON approvati: non compaiono al pubblico.
-- Nessuna revisione clinica o abilitazione professionale viene attribuita.
-- Eseguire nel SQL Editor con il ruolo amministrativo fidato del progetto.
-- Non eseguire dall'app. Il file non contiene chiavi o account da impersonare.
-- Le righe gia presenti con lo stesso ID o indirizzo (slug) sono conservate.
-- L'identita dell'autore originale resta nel payload; author_id rimane NULL.
-- Il normale salvataggio da Studio creera l'autore dopo la verifica di Gaia.
begin;

-- Non alterare lo stato di un progetto che ha gia trigger disabilitati.
do $maia_recovery_preflight$
begin
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid='public.articles'::regclass
      and tgname='articles_validate' and tgenabled='O' and not tgisinternal
  ) or not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid='public.articles'::regclass
      and tgname='articles_review' and tgenabled='O' and not tgisinternal
  ) then
    raise exception 'Il recupero richiede i normali trigger editoriali attivi';
  end if;
end;
$maia_recovery_preflight$;

-- Solo categorie mancanti; nomi e modifiche esistenti restano invariati.
insert into public.article_categories(id,name,icon) values
${categoryRows}
on conflict(id) do nothing;

-- DDL transazionale: il lock dura fino a COMMIT o ROLLBACK.
-- La validazione richiede un account redazionale, assente nel SQL Editor.
-- Viene sospeso SOLO questo trigger per le bozze fisse qui sotto.
-- articles_review rimane attivo: approved=false non produce revisioni.
alter table public.articles disable trigger articles_validate;

do $maia_recovery$
declare
  documents jsonb := $maia_recovery_documents$${documents}$maia_recovery_documents$::jsonb;
  document jsonb;
  inserted_article_id uuid;
  ref jsonb;
begin
  for document in select value from jsonb_array_elements(documents)
  loop
    inserted_article_id := null;
    insert into public.articles(
      id,slug,category_id,author_id,status,approved,is_demo,payload
    ) values (
      (document->>'id')::uuid, document->>'slug', document->>'categoryId',
      null, 'draft', false, true, document
    )
    on conflict do nothing
    returning id into inserted_article_id;

    -- Nessun aggiornamento o sostituzione di fonti per letture gia esistenti.
    if inserted_article_id is null then continue; end if;
    for ref in select value from jsonb_array_elements(document->'references')
    loop
      insert into public.article_references(article_id,label,url)
      values(inserted_article_id,ref->>'label',ref->>'url');
    end loop;
  end loop;
end;
$maia_recovery$;

alter table public.articles enable trigger articles_validate;
commit;

-- Verifica finale: l'importazione non rende visibili le bozze agli iscritti.
select
  count(*) as articoli_totali,
  count(*) filter (where status='draft') as bozze,
  count(*) filter (
    where status='published' and approved and not is_demo
  ) as visibili_sul_sito
from public.articles;
`;

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const output = resolve(
    process.argv[2] ??
      fileURLToPath(
        new URL(
          "../../release-letture/IMPORTA-LETTURE-IN-BOZZA.sql",
          import.meta.url,
        ),
      ),
  );
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, articleRecoverySQL);
  console.log(
    `Preparato recupero di ${recoveredArticles.length} bozze: ${output}`,
  );
}
