import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; grant usage on schema public to anon,authenticated;
    create function public.is_editor() returns boolean language sql stable as $$ select coalesce(current_setting('test.editor',true),'')='yes' $$;`);
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/202610230004_shop.sql", import.meta.url),
      "utf8",
    ),
  );
});
beforeEach(async () => {
  await db.exec(`reset role; set test.editor='no'; truncate shop_products; update shop_settings set enabled=false,recommendations_enabled=false;
    insert into shop_products(kind,title,description,price_cents,image_url,checkout_url,status) values
      ('amazon','Libro selezionato','Esempio senza prezzo Amazon',0,'','https://www.amazon.it/dp/TEST','published'),
      ('doctor','Prodotto della dottoressa','Descrizione reale',1900,'https://example.invalid/p.png','https://buy.stripe.com/test_link','published'),
      ('doctor','Bozza privata','',0,'','','draft');`);
});
afterAll(async () => {
  await db.close();
});
test("guests cannot see products before activation or write to the store", async () => {
  await db.exec("set role anon");
  expect((await db.query("select * from shop_products")).rows).toEqual([]);
  await expect(
    db.query("update shop_settings set recommendations_enabled=true"),
  ).rejects.toThrow(/permission denied/);
  await db.exec("reset role; set role authenticated");
  await expect(
    db.query("insert into shop_products(title) values('Injected product')"),
  ).rejects.toThrow(/row-level security/);
});
test("Amazon selection is available without opening direct sales; drafts remain private", async () => {
  await db.exec(
    "update shop_settings set recommendations_enabled=true; set role anon;",
  );
  expect((await db.query("select title from shop_products")).rows).toEqual([
    { title: "Libro selezionato" },
  ]);
});
test("direct sales require complete seller information and expose only published products", async () => {
  await expect(
    db.query("update shop_settings set enabled=true"),
  ).rejects.toThrow(/check constraint/);
  await db.exec(
    "update shop_settings set seller_name='Venditore reale',seller_address='Indirizzo verificato',seller_contact='support@example.invalid',tax_details='Dati fiscali reali',shipping_terms='Condizioni reali di spedizione',returns_terms='Condizioni reali di recesso',terms_url='https://example.invalid/terms',enabled=true; set role anon;",
  );
  expect((await db.query("select title from shop_products")).rows).toEqual([
    { title: "Prodotto della dottoressa" },
  ]);
});
test("only an authorized editor sees and edits unpublished products", async () => {
  await db.exec("set test.editor='yes'; set role authenticated;");
  expect((await db.query("select title from shop_products")).rows).toHaveLength(
    3,
  );
  expect(
    (
      await db.query(
        "update shop_products set title='Bozza aggiornata' where status='draft' returning title",
      )
    ).rows,
  ).toEqual([{ title: "Bozza aggiornata" }]);
});
test("database rejects malicious external links and incomplete published direct-sale products", async () => {
  for (const url of [
    "https://buy.stripe.com.evil.test/x",
    "https://www.amazon.it.evil.test/x",
    "javascript:alert(1)",
  ]) {
    await expect(
      db.query(
        "insert into shop_products(kind,title,checkout_url) values('doctor','Invalid URL',$1)",
        [url],
      ),
    ).rejects.toThrow(/check constraint/);
  }
  await expect(
    db.query(
      "insert into shop_products(kind,title,status) values('doctor','Incomplete','published')",
    ),
  ).rejects.toThrow(/check constraint/);
});
