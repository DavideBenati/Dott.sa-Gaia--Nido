import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

let db: PGlite;
let migratedProfile: Record<string, unknown>;
let migratedSalesEnabled: boolean;
const preservedProfileFields = {
  portrait_url: "https://example.invalid/portrait-chosen.jpg",
  contact_email: "gaia-chosen@example.invalid",
  privacy_providers: "Fornitori già verificati",
  privacy_retention: "Tempi già verificati",
  privacy_transfers: "Trasferimenti già verificati",
  privacy_reviewed: true,
};
const validLegacySeller = `seller_name='Venditore precedente',
  seller_address='Indirizzo precedente',seller_contact='seller@example.invalid',
  tax_details='Dati fiscali precedenti',shipping_terms='Condizioni precedenti',
  returns_terms='Resi precedenti',terms_url='https://example.invalid/terms'`;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    grant usage on schema public to anon,authenticated;
    create function public.is_editor() returns boolean language sql stable
      as $$ select coalesce(current_setting('test.editor',true),'')='yes' $$;
    create table public.site_profile (
      id integer primary key, bio text, qualifications text, service_area text,
      services jsonb, portrait_url text, contact_email text,
      privacy_providers text, privacy_retention text, privacy_transfers text,
      privacy_reviewed boolean
    );
  `);
  await db.query(
    `insert into public.site_profile values
      (1,'Vecchia biografia personale','Vecchi titoli personali','Vecchia zona',
        '[{"title":"Vecchio servizio"}]'::jsonb,$1,$2,$3,$4,$5,$6)`,
    Object.values(preservedProfileFields),
  );
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/202610230004_shop.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec(
    `update public.shop_settings set ${validLegacySeller}, enabled=true`,
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610250011_project_presentation_amazon.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  migratedProfile = (await db.query("select * from public.site_profile"))
    .rows[0];
  migratedSalesEnabled = (
    await db.query<{ enabled: boolean }>(
      "select enabled from public.shop_settings",
    )
  ).rows[0].enabled;
});

beforeEach(async () => {
  await db.exec(`reset role; set test.editor='no';
    truncate public.shop_products;
    update public.shop_settings set enabled=false,recommendations_enabled=false;
    insert into public.shop_products
      (kind,title,description,price_cents,image_url,checkout_url,status) values
      ('amazon','Consiglio pubblico','Descrizione Amazon',0,'','https://www.amazon.it/dp/TEST','published'),
      ('amazon','Consiglio in bozza','','0','','','draft'),
      ('doctor','Vecchio prodotto proprio','Descrizione precedente',1900,'https://example.invalid/product.jpg','https://buy.stripe.com/test_link','published'),
      ('doctor','Vecchia bozza propria','',0,'','','draft');`);
});

afterAll(async () => {
  await db.close();
});

test("migration replaces personal presentation while preserving chosen contact, photo and privacy", () => {
  expect(migratedProfile).toMatchObject(preservedProfileFields);
  expect(migratedProfile.bio).toContain(
    "MetiMaia è uno spazio dedicato alle famiglie",
  );
  expect(migratedProfile.qualifications).toContain(
    "Il significato di MetiMaia",
  );
  expect(migratedProfile.qualifications).toContain("Il fiore di loto");
  expect(migratedProfile.service_area).toContain("La nostra filosofia");
  expect(migratedProfile.services).toEqual([
    expect.objectContaining({ title: "La gravidanza" }),
    expect.objectContaining({ title: "La nascita e il post-partum" }),
    expect.objectContaining({ title: "Il primo anno di vita" }),
    expect.objectContaining({ title: "La crescita della famiglia" }),
  ]);
  expect(JSON.stringify(migratedProfile)).not.toContain(
    "Vecchi titoli personali",
  );
  expect(JSON.stringify(migratedProfile)).not.toContain(
    "Vecchia biografia personale",
  );
  expect(migratedSalesEnabled).toBe(false);
});

test.each(["anon", "authenticated"])(
  "%s cannot recover own-product visibility by re-enabling legacy sales",
  async (role) => {
    await db.exec(
      `update public.shop_settings set enabled=true; set role ${role};`,
    );
    expect(
      (await db.query("select title from public.shop_products")).rows,
    ).toEqual([]);
    await db.exec(
      "reset role; update public.shop_settings set recommendations_enabled=true",
    );
    await db.exec(`set role ${role}`);
    expect(
      (await db.query("select title from public.shop_products")).rows,
    ).toEqual([{ title: "Consiglio pubblico" }]);
  },
);

test("authorized editor retains legacy rows and drafts for administration", async () => {
  await db.exec("set test.editor='yes'; set role authenticated");
  expect(
    (await db.query("select title from public.shop_products")).rows,
  ).toHaveLength(4);
  expect(
    (
      await db.query(
        "update public.shop_products set title='Archivio precedente' where title='Vecchio prodotto proprio' returning title",
      )
    ).rows,
  ).toEqual([{ title: "Archivio precedente" }]);
});
