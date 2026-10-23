import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    grant usage on schema public to anon,authenticated,service_role;
    create function public.is_editor() returns boolean language sql stable as $$ select current_setting('test.editor',true)='yes' $$;`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610230003_newsletter.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(`insert into newsletter_subscribers(email,status,consent_version) values
    ('pending@example.invalid','pending','v1'),('confirmed@example.invalid','confirmed','v1'),('cancelled@example.invalid','unsubscribed','v1');`);
});
afterAll(async () => {
  await db.close();
});
describe("newsletter real PostgreSQL permissions", () => {
  test("anonymous and normal accounts cannot read, enroll directly, or consume server rate slots", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`reset role; set role ${role};`);
      await expect(
        db.query("select * from newsletter_subscribers"),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query(
          "insert into newsletter_subscribers(email,status,consent_version) values('fake@example.invalid','confirmed','v1')",
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("select newsletter_take_slot('fake',1,60)"),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("select * from newsletter_editor_list()"),
      ).rejects.toThrow();
    }
  });
  test("editor export contains only confirmed subscribers and never private tokens", async () => {
    await db.exec("reset role; set test.editor='yes'; set role authenticated;");
    const result = await db.query("select * from newsletter_editor_list()");
    expect(result.rows).toEqual([
      {
        email: "confirmed@example.invalid",
        confirmed_at: null,
        consent_version: "v1",
      },
    ]);
    await db.exec("reset role; set test.editor='no';");
  });
  test("atomic server rate limiter rejects excess attempts and permits a new expired window", async () => {
    await db.exec("reset role; set role service_role;");
    for (const expected of [true, true, false]) {
      const result = await db.query<{ ok: boolean }>(
        "select newsletter_take_slot('network-test',2,60) as ok",
      );
      expect(result.rows[0].ok).toBe(expected);
    }
    await db.exec(
      "reset role; update newsletter_request_limits set expires_at=now()-interval '1 second'; set role service_role;",
    );
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select newsletter_take_slot('network-test',2,60) as ok",
        )
      ).rows[0].ok,
    ).toBe(true);
  });
});
