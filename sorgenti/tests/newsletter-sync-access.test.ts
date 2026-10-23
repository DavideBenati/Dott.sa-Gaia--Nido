import { beforeAll, beforeEach, afterAll, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
let db: PGlite;
const id = "11111111-1111-4111-8111-111111111111";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;create schema private;grant usage on schema public to anon,authenticated,service_role;create function public.is_editor() returns boolean language sql stable as $$select coalesce(current_setting('test.editor',true),'')='yes'$$;",
  );
  for (const name of [
    "202610230003_newsletter.sql",
    "202610230006_newsletter_sync.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
});
beforeEach(async () => {
  await db.exec(
    "reset role;set test.editor='no';truncate public.newsletter_subscribers cascade;truncate private.newsletter_provider_events;",
  );
  await db.query(
    "insert into newsletter_subscribers(id,email,status,consent_version,requested_at,confirmed_at)values($1,'test@example.invalid','confirmed','test',now()-interval '2 hours',now()-interval '1 hour')",
    [id],
  );
});
afterAll(async () => db.close());
test("only server can read jobs and claim work; an editor cannot export while revocations are pending", async () => {
  await db.exec("set role authenticated");
  await expect(db.query("select * from newsletter_sync_jobs")).rejects.toThrow(
    /permission denied/,
  );
  await expect(
    db.query("select * from newsletter_claim_jobs(null)"),
  ).rejects.toThrow(/permission denied/);
  await expect(db.query("select newsletter_sync_status()")).rejects.toThrow(
    /Editor authorization/,
  );
  await db.exec("set test.editor='yes'");
  await expect(
    db.query("select * from newsletter_editor_list()"),
  ).rejects.toThrow(/synchronization required/);
});
test("leases prevent duplicate claims and stale completion cannot erase a later opt-out", async () => {
  await db.exec("set role service_role");
  const job = (
    await db.query<{
      subscriber_id: string;
      revision: string;
      claim_token: string;
    }>("select * from newsletter_claim_jobs(null)")
  ).rows[0];
  expect(job.subscriber_id).toBe(id);
  expect(
    (await db.query("select * from newsletter_claim_jobs(null)")).rows,
  ).toHaveLength(0);
  await db.query(
    "update newsletter_subscribers set status='unsubscribed' where id=$1",
    [id],
  );
  const result = await db.query(
    "update newsletter_sync_jobs set state='synced' where subscriber_id=$1 and revision=$2 and claim_token=$3 returning subscriber_id",
    [id, job.revision, job.claim_token],
  );
  expect(result.rows).toHaveLength(0);
  expect(
    (await db.query("select state from newsletter_sync_jobs")).rows,
  ).toEqual([{ state: "pending" }]);
});
test("provider opt-out is idempotent; late older events do not overwrite later explicit consent", async () => {
  await db.exec("set role service_role");
  await db.query(
    "select newsletter_provider_optout('evt-new','test@example.invalid',now())",
  );
  await db.query(
    "select newsletter_provider_optout('evt-new','test@example.invalid',now())",
  );
  expect(
    (await db.query("select status from newsletter_subscribers")).rows,
  ).toEqual([{ status: "unsubscribed" }]);
  await db.exec(
    "reset role;select count(*) from private.newsletter_provider_events",
  );
  expect(
    (
      await db.query(
        "select count(*)::integer total from private.newsletter_provider_events",
      )
    ).rows,
  ).toEqual([{ total: 1 }]);
  await db.exec(
    "update newsletter_subscribers set status='confirmed',requested_at=now(),confirmed_at=now();set role service_role;",
  );
  await db.query(
    "select newsletter_provider_optout('evt-old','test@example.invalid',now()-interval '30 minutes')",
  );
  expect(
    (await db.query("select status from newsletter_subscribers")).rows,
  ).toEqual([{ status: "confirmed" }]);
});
test("CSV contains only current confirmed subscribers and is blocked after every new change", async () => {
  await db.exec(
    "update newsletter_sync_jobs set state='synced';set test.editor='yes';set role authenticated",
  );
  expect(
    (await db.query("select email from newsletter_editor_list()")).rows,
  ).toEqual([{ email: "test@example.invalid" }]);
  await db.exec(
    "reset role;update newsletter_subscribers set status='unsubscribed';set role authenticated",
  );
  await expect(
    db.query("select * from newsletter_editor_list()"),
  ).rejects.toThrow(/synchronization required/);
});
