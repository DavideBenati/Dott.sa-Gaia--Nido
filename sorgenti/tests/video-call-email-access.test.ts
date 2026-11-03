import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const manager = "11111111-1111-4111-8111-111111111111";
const alice = "22222222-2222-4222-8222-222222222222";
const bob = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
let invitation: string;
async function asUser(id: string | null, mfa = true) {
  await db.exec("reset role; set role authenticated");
  await db.query(
    "select set_config('test.uid',$1,false),set_config('test.mfa',$2,false)",
    [id ?? "", String(mfa)],
  );
}
async function claim(id = invitation, expected = manager) {
  return (
    await db.query<{ job: Record<string, unknown> }>(
      "select video_call_email_claim($1,$2) job",
      [id, expected],
    )
  ).rows[0].job;
}
async function status() {
  return (
    await db.query<{ status: string; accepted_at: string | null }>(
      "select * from list_video_call_email_status($1::uuid[])",
      [[invitation]],
    )
  ).rows[0];
}
async function finish(job: Record<string, unknown>, result: string) {
  await db.exec("reset role; set role service_role");
  const answer = (
    await db.query<{ done: boolean }>(
      "select video_call_email_finish($1,$2,$3,null) done",
      [job.job_id, job.lease_token, result],
    )
  ).rows[0].done;
  await asUser(manager);
  return answer;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function public.is_editor() returns boolean language sql stable as $$select auth.uid()='${manager}'::uuid and current_setting('test.mfa',true)='true'$$;
    create table profiles(user_id uuid primary key references auth.users(id) on delete cascade,display_name text);
    grant usage on schema auth,public to authenticated,anon,service_role;`);
  for (const file of [
    "202610250010_video_calls.sql",
    "202611030019_video_call_email_invitations.sql",
  ])
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
}, 20000);
beforeEach(async () => {
  await db.exec("reset role; truncate auth.users cascade");
  for (const [id, email] of [
    [manager, "gaia@example.invalid"],
    [alice, "alice@example.invalid"],
    [bob, "bob@example.invalid"],
  ])
    await db.query("insert into auth.users values($1,$2,now(),null)", [
      id,
      email,
    ]);
  await asUser(manager);
  invitation = (
    await db.query<{ id: string }>(
      "select create_video_call_invitation($1,$2,$3) id",
      [alice, "https://meet.hostpoint.ch/random-room-123456", manager],
    )
  ).rows[0].id;
});
afterAll(async () => {
  await db.close();
});

test("saving creates no email; first manual claim freezes identity and concurrent claim is locked", async () => {
  expect((await status()).status).toBe("not_sent");
  const job = await claim();
  expect(job.status).toBe("sending");
  expect(job.recipient_email).toBe("alice@example.invalid");
  expect(job.invitation_id).toBe(invitation);
  expect((await claim()).job_id).toBeUndefined();
  await expect(
    db.exec("select * from private.video_call_emails"),
  ).rejects.toThrow();
});

test("only editor with configured MFA and matching identity may claim or inspect email status", async () => {
  await expect(claim(invitation, alice)).rejects.toThrow();
  await asUser(manager, false);
  await expect(claim()).rejects.toThrow();
  await expect(status()).rejects.toThrow();
  await asUser(alice);
  await expect(claim(invitation, alice)).rejects.toThrow();
  await expect(status()).rejects.toThrow();
  await db.exec("reset role; set role anon");
  await expect(claim()).rejects.toThrow();
});

test("only service finishes a lease; accepted sends remain accepted without another payload", async () => {
  const job = await claim();
  await expect(
    db.query("select video_call_email_finish($1,$2,'accepted',null)", [
      job.job_id,
      job.lease_token,
    ]),
  ).rejects.toThrow();
  expect(await finish(job, "accepted")).toBe(true);
  expect((await status()).status).toBe("accepted");
  expect((await status()).accepted_at).not.toBeNull();
  expect(await claim()).toMatchObject({ status: "accepted" });
  expect((await claim()).job_id).toBeUndefined();
  expect(await finish(job, "retry")).toBe(false);
});

test("uncertain retries reuse frozen payload and job id while rotating the lease", async () => {
  const first = await claim();
  expect(await finish(first, "uncertain")).toBe(true);
  expect((await status()).status).toBe("uncertain");
  const second = await claim();
  expect(second.job_id).toBe(first.job_id);
  expect(second.recipient_email).toBe(first.recipient_email);
  expect(second.expires_at).toBe(first.expires_at);
  expect(second.lease_token).not.toBe(first.lease_token);
  expect(await finish(first, "accepted")).toBe(false);
});

test("expired lease can retry but old ambiguity stops before the provider idempotency window ends", async () => {
  const first = await claim();
  await db.exec("reset role");
  await db.query(
    "update private.video_call_emails set lease_until=now()-interval '1 second' where id=$1",
    [first.job_id],
  );
  await asUser(manager);
  expect((await status()).status).toBe("uncertain");
  expect((await claim()).job_id).toBe(first.job_id);
  await db.exec("reset role");
  await db.query(
    "update private.video_call_emails set first_attempt_at=now()-interval '23 hours' where id=$1",
    [first.job_id],
  );
  await asUser(manager);
  expect((await status()).status).toBe("failed");
  expect(await claim()).toEqual({ status: "failed", accepted_at: null });
});

test("revoke, expiry, deleted account and changed email prevent later sends", async () => {
  const job = await claim();
  const authorized = async () =>
    (
      await db.query<{ ok: boolean }>(
        "select video_call_email_authorized($1,$2,$3) ok",
        [job.job_id, job.lease_token, manager],
      )
    ).rows[0].ok;
  expect(await authorized()).toBe(true);
  await db.query("select revoke_video_call_invitation($1,$2)", [
    invitation,
    manager,
  ]);
  expect(await authorized()).toBe(false);
  await expect(claim()).rejects.toThrow();
  await db.exec("reset role");
  await db.query(
    "update private.video_call_invitations set revoked_at=null,expires_at=now()-interval '1 second' where id=$1",
    [invitation],
  );
  await asUser(manager);
  expect(await authorized()).toBe(false);
  await expect(claim()).rejects.toThrow();
  await db.exec("reset role");
  await db.query(
    "update private.video_call_invitations set expires_at=now()+interval '1 day' where id=$1",
    [invitation],
  );
  await db.query("update auth.users set deleted_at=now() where id=$1", [alice]);
  await asUser(manager);
  await expect(claim()).rejects.toThrow();
  await db.exec("reset role");
  await db.query(
    "update auth.users set deleted_at=null,email='changed@example.invalid' where id=$1",
    [alice],
  );
  await asUser(manager);
  expect(await authorized()).toBe(false);
  expect(await claim()).toEqual({ status: "failed", accepted_at: null });
});

test("unconfirmed recipients cannot be emailed and status queries are bounded", async () => {
  await db.exec("reset role");
  await db.query("update auth.users set email_confirmed_at=null where id=$1", [
    alice,
  ]);
  await asUser(manager);
  await expect(claim()).rejects.toThrow();
  await expect(
    db.query("select * from list_video_call_email_status($1::uuid[])", [
      Array(51).fill(invitation),
    ]),
  ).rejects.toThrow();
});
