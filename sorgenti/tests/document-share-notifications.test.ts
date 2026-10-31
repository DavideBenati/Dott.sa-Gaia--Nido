import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const manager = "9401cf16-ed8d-48b5-8a46-6aa353716d11";
const patient = "9401cf16-ed8d-48b5-8a46-6aa353716d12";
const other = "9401cf16-ed8d-48b5-8a46-6aa353716d13";
const unconfirmed = "9401cf16-ed8d-48b5-8a46-6aa353716d14";
let db: PGlite;
let migration: string;
let legacyJobCount = -1;

type Job = {
  job_id: string;
  lease_token: string;
  document_id: string;
  recipient_id: string;
  document_title: string;
  recipient_email: string;
  attempts: number;
};

async function asUser(id: string, aal = "aal2") {
  await db.query("select set_config('test.uid',$1,false)", [id]);
  await db.query("select set_config('test.aal',$1,false)", [aal]);
}
async function document(title = "Materiale scelto da Gaia") {
  const id = randomUUID();
  await db.query(
    `insert into public.session_documents(
      id,owner_id,title,file_name,mime_type,size_bytes,storage_path,state,active,ready_at
    ) values($1,$2,$3,'materiale.pdf','application/pdf',123,$4,'ready',true,now())`,
    [id, manager, title, `${id}/${randomUUID()}.pdf`],
  );
  return id;
}
async function grant(id: string, users = [patient], expected: string[] = []) {
  await asUser(manager);
  await db.query("select public.set_document_recipients($1,$2,$3)", [
    id,
    users,
    expected,
  ]);
}
async function claim(id: string | null, limit = 20) {
  return (
    await db.query<Job>(
      "select * from public.document_notification_claim($1,$2)",
      [id, limit],
    )
  ).rows;
}
async function authorize(job: Job) {
  return (
    await db.query<Job>(
      "select * from public.document_notification_authorized($1,$2)",
      [job.job_id, job.lease_token],
    )
  ).rows;
}
async function finish(job: Job, result: string, error: string | null = null) {
  return (
    await db.query<{ finished: boolean }>(
      "select public.document_notification_finish($1,$2,$3,$4) as finished",
      [job.job_id, job.lease_token, result, error],
    )
  ).rows[0].finished;
}
async function status(id: string) {
  return (
    await db.query<{ status: Record<string, number> }>(
      "select public.document_notification_status($1) as status",
      [id],
    )
  ).rows[0].status;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage;
    create table auth.users(
      id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz
    );
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as
      $$select jsonb_build_object('aal',current_setting('test.aal',true))$$;
    grant usage on schema auth,public to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid,bucket_id text,name text,metadata jsonb);
    create function storage.foldername(text) returns text[] language sql immutable as
      $$select string_to_array($1,'/')$$;
  `);
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/202610210001_nido.sql", import.meta.url),
      "utf8",
    ),
  );
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
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610240007_private_documents.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query(
    `insert into auth.users(id,email,email_confirmed_at) values
      ($1,'gaia@example.invalid',now()),($2,'patient@example.invalid',now()),
      ($3,'other@example.invalid',now()),($4,'pending@example.invalid',null)`,
    [manager, patient, other, unconfirmed],
  );
  await db.query(
    `insert into private.editor_memberships(
      user_id,professional_name,professional_role,require_mfa
    ) values($1,'Dott.sa Gaia','Ostetrica',true)`,
    [manager],
  );
  await db.query(
    "insert into private.document_staff(user_id,require_mfa) values($1,true)",
    [manager],
  );
  const legacy = await document("Materiale condiviso prima dell’aggiornamento");
  await grant(legacy);
  migration = await readFile(
    new URL(
      "../supabase/migrations/202610310017_document_share_notifications.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(migration);
  legacyJobCount = (
    await db.query<{ total: number }>(
      "select count(*)::integer as total from private.document_share_notifications",
    )
  ).rows[0].total;
}, 20000);

beforeEach(async () => {
  await db.exec("reset role; set test.uid=''; set test.aal='';");
  await db.exec("truncate public.session_documents cascade;");
  await db.query(
    "update auth.users set email='patient@example.invalid',email_confirmed_at=now(),deleted_at=null where id=$1",
    [patient],
  );
});
afterAll(async () => {
  await db.close();
});

test("migration does not email legacy grants and no-op recipient saves do not duplicate notifications", async () => {
  expect(legacyJobCount).toBe(0);
  const id = await document();
  await grant(id);
  await grant(id, [patient], [patient]);
  const jobs = await claim(id);
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({
    document_id: id,
    recipient_id: patient,
    document_title: "Materiale scelto da Gaia",
    recipient_email: "patient@example.invalid",
    attempts: 1,
  });
  expect(await claim(id)).toEqual([]);
});

test("only the service can claim email data and only document managers with MFA can inspect status", async () => {
  const id = await document();
  await grant(id);
  await db.exec("set role authenticated");
  await asUser(patient);
  await expect(claim(id)).rejects.toThrow(/permission denied/i);
  await expect(status(id)).rejects.toThrow(/authorization and MFA/i);
  await expect(
    db.query("select * from private.document_share_notifications"),
  ).rejects.toThrow(/permission denied/i);
  await asUser(manager, "aal1");
  await expect(status(id)).rejects.toThrow(/authorization and MFA/i);
  await asUser(manager, "aal2");
  expect(await status(id)).toMatchObject({ pending: 1, accepted: 0 });
  await db.exec("reset role; set role anon");
  await expect(status(id)).rejects.toThrow(/permission denied/i);
  await expect(claim(id)).rejects.toThrow(/permission denied/i);
  await db.exec("reset role; set role service_role");
  expect(await claim(id)).toHaveLength(1);
});

test("provider acceptance is terminal and lease tokens prevent stale or duplicate finishes", async () => {
  const id = await document();
  await grant(id);
  const [job] = await claim(id);
  expect(await authorize(job)).toEqual([job]);
  expect(await finish({ ...job, lease_token: randomUUID() }, "accepted")).toBe(
    false,
  );
  expect(await finish(job, "accepted")).toBe(true);
  expect(await finish(job, "retry", "TIMEOUT")).toBe(false);
  expect(await claim(id)).toEqual([]);
  expect(await authorize(job)).toEqual([]);
  expect(await status(id)).toMatchObject({ accepted: 1, pending: 0 });
});

test("retry leases retain exactly the original recipient and title even if metadata changes", async () => {
  const id = await document("Titolo prima del primo tentativo");
  await grant(id);
  const [first] = await claim(id);
  expect(await finish(first, "uncertain", "NETWORK_TIMEOUT")).toBe(true);
  expect(await claim(id)).toEqual([]);
  await db.query(
    "update public.session_documents set title='Titolo modificato' where id=$1",
    [id],
  );
  await db.query(
    "update private.document_share_notifications set next_attempt_at=now()-interval '1 second' where id=$1",
    [first.job_id],
  );
  const [retry] = await claim(id);
  expect(retry.job_id).toBe(first.job_id);
  expect(retry.lease_token).not.toBe(first.lease_token);
  expect(retry.attempts).toBe(2);
  expect(retry.document_title).toBe(first.document_title);
  expect(retry.recipient_email).toBe(first.recipient_email);
  expect((await authorize(retry))[0]).toEqual(retry);
  expect(await finish(first, "accepted")).toBe(false);
});

test("revoking or archiving cancels queued and claimed emails; regrant gets a new notification identity", async () => {
  const id = await document();
  await grant(id);
  const [first] = await claim(id);
  await grant(id, [], [patient]);
  expect(await authorize(first)).toEqual([]);
  expect(await finish(first, "accepted")).toBe(false);
  expect(await status(id)).toMatchObject({ cancelled: 1 });
  await grant(id);
  const [second] = await claim(id);
  expect(second.job_id).not.toBe(first.job_id);
  await db.query(
    "update public.session_documents set active=false where id=$1",
    [id],
  );
  expect(await authorize(second)).toEqual([]);
  expect(await claim(id)).toEqual([]);
  expect(await status(id)).toMatchObject({ cancelled: 2 });
});

test("changed email, unconfirmed and removed accounts cannot receive frozen notifications", async () => {
  for (const mutation of [
    "email='changed@example.invalid'",
    "email_confirmed_at=null",
    "deleted_at=now()",
  ]) {
    await db.query(
      "update auth.users set email='patient@example.invalid',email_confirmed_at=now(),deleted_at=null where id=$1",
      [patient],
    );
    const id = await document();
    await grant(id);
    const [job] = await claim(id);
    await db.query(`update auth.users set ${mutation} where id=$1`, [patient]);
    expect(await authorize(job)).toEqual([]);
    expect(await claim(id)).toEqual([]);
    expect(await status(id)).toMatchObject({ cancelled: 1, accepted: 0 });
  }
});

test("expired leases are reclaimed with the same job but ambiguous retries stop before the provider idempotency window", async () => {
  const id = await document();
  await grant(id);
  const [first] = await claim(id);
  await db.query(
    "update private.document_share_notifications set lease_until=now()-interval '1 second' where id=$1",
    [first.job_id],
  );
  const [retry] = await claim(id);
  expect(retry.job_id).toBe(first.job_id);
  expect(retry.lease_token).not.toBe(first.lease_token);
  expect(await authorize(first)).toEqual([]);
  await db.query(
    "update private.document_share_notifications set first_attempt_at=now()-interval '23 hours' where id=$1",
    [first.job_id],
  );
  expect(await claim(id)).toEqual([]);
  expect(await status(id)).toMatchObject({ failed: 1, uncertain: 1 });
  expect(await finish(retry, "accepted")).toBe(false);
});

test("batch bounds and document scope prevent accidental broad processing", async () => {
  const first = await document("Primo");
  const second = await document("Secondo");
  await grant(first, [patient, other]);
  await grant(second);
  await expect(claim(first, 0)).rejects.toThrow(/batch size/i);
  await expect(claim(first, 21)).rejects.toThrow(/batch size/i);
  expect(await claim(first, 1)).toHaveLength(1);
  expect(await claim(first, 20)).toHaveLength(1);
  const rest = await claim(null);
  expect(rest).toHaveLength(1);
  expect(rest[0].document_id).toBe(second);
});
