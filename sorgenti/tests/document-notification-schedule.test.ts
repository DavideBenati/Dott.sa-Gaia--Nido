import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

let db: PGlite;
let setup: string;
const token = "a".repeat(64);

beforeAll(async () => {
  db = new PGlite();
  const source = await readFile(
    new URL("../../release-v11.3/ATTIVA-INVIO-AUTOMATICO.sql", import.meta.url),
    "utf8",
  );
  // Supabase's managed extensions are unavailable in PGlite. Only their
  // installation statements are omitted; all setup and scheduled SQL executes
  // against isolated contract doubles below, with no HTTP requests.
  setup = source.replace(/^create extension if not exists .+;$/gm, "");
  await db.exec(`
    create role anon; create role authenticated;
    create schema vault; create schema cron; create schema net; create schema extensions;
    create table vault.secrets(id uuid primary key default gen_random_uuid(),name text,secret text,description text);
    create view vault.decrypted_secrets as select id,name,secret as decrypted_secret from vault.secrets;
    create function vault.create_secret(new_secret text,new_name text,new_description text)
    returns uuid language sql as $$
      insert into vault.secrets(name,secret,description)
      values(new_name,new_secret,new_description) returning id
    $$;
    create function extensions.gen_random_bytes(length integer) returns bytea
    language sql as $$select decode(repeat('ab',length),'hex')$$;
    create table cron.job(
      jobid bigint generated always as identity primary key,
      jobname text, schedule text, command text,
      database text default current_database(), username text default current_user,
      active boolean default true, unique(jobname,username)
    );
    create function cron.schedule(job_name text,job_schedule text,job_command text)
    returns bigint language sql as $$
      insert into cron.job(jobname,schedule,command)
      values(job_name,job_schedule,job_command)
      on conflict(jobname,username) do update
      set schedule=excluded.schedule,command=excluded.command
      returning jobid
    $$;
    create function cron.alter_job(job_id bigint,active boolean)
    returns void language sql as $$update cron.job set active=$2 where jobid=$1$$;
    create table net.requests(url text,headers jsonb,body jsonb,timeout_milliseconds integer);
    create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer)
    returns bigint language sql as $$
      insert into net.requests values(url,headers,body,timeout_milliseconds)
      returning 1::bigint
    $$;
  `);
}, 20000);

beforeEach(async () => {
  await db.exec(
    "rollback; reset role; truncate vault.secrets,cron.job,net.requests;",
  );
});

afterAll(async () => db.close());

test("creates one minute job and secret without putting the token into cron.job", async () => {
  await db.exec(setup);
  const secrets = await db.query<{ decrypted_secret: string }>(
    "select decrypted_secret from vault.decrypted_secrets",
  );
  expect(secrets.rows).toHaveLength(1);
  expect(secrets.rows[0].decrypted_secret).toMatch(/^[0-9a-f]{64}$/);
  const jobs = await db.query<{
    command: string;
    schedule: string;
    active: boolean;
  }>("select command,schedule,active from cron.job");
  expect(jobs.rows).toHaveLength(1);
  expect(jobs.rows[0]).toMatchObject({ schedule: "* * * * *", active: true });
  expect(jobs.rows[0].command).not.toContain(secrets.rows[0].decrypted_secret);
  expect((await db.query("select * from net.requests")).rows).toEqual([]);

  await db.exec(jobs.rows[0].command);
  expect((await db.query("select * from net.requests")).rows).toEqual([
    {
      url: "https://gwepsvlxwjptbchhlldm.supabase.co/functions/v1/document-notify",
      headers: {
        "Content-Type": "application/json",
        "X-Document-Notify-Token": secrets.rows[0].decrypted_secret,
      },
      body: { action: "retry" },
      timeout_milliseconds: 90000,
    },
  ]);
});

test("reruns retain the token and unrelated jobs, and reactivate only this named job", async () => {
  await db.query(
    "insert into vault.secrets(name,secret) values('document_notify_job_token',$1)",
    [token],
  );
  await db.exec(
    "select cron.schedule('unrelated-job','0 * * * *','select 42');",
  );
  await db.exec(setup);
  await db.exec(
    "update cron.job set active=false where jobname='metimaia-document-notify';",
  );
  await db.exec(setup);
  expect((await db.query("select secret from vault.secrets")).rows).toEqual([
    { secret: token },
  ]);
  expect(
    (
      await db.query(
        "select jobname,schedule,active from cron.job order by jobname",
      )
    ).rows,
  ).toEqual([
    {
      jobname: "metimaia-document-notify",
      schedule: "* * * * *",
      active: true,
    },
    { jobname: "unrelated-job", schedule: "0 * * * *", active: true },
  ]);
});

test("the scheduled request reads rotations from Vault instead of using an old token", async () => {
  await db.exec(setup);
  const command = (
    await db.query<{ command: string }>("select command from cron.job")
  ).rows[0].command;
  await db.query("update vault.secrets set secret=$1", [token]);
  await db.exec(command);
  expect(
    (await db.query<{ headers: object }>("select headers from net.requests"))
      .rows[0].headers,
  ).toMatchObject({ "X-Document-Notify-Token": token });
});

test("duplicate secrets and differently owned jobs abort without changing existing configuration", async () => {
  await db.query(
    "insert into vault.secrets(name,secret) values('document_notify_job_token',$1),('document_notify_job_token',$1)",
    [token],
  );
  await expect(db.exec(setup)).rejects.toThrow(/Piu segreti Vault/);
  await db.exec("rollback");
  expect((await db.query("select * from cron.job")).rows).toEqual([]);
  expect((await db.query("select * from vault.secrets")).rows).toHaveLength(2);
  await db.exec(
    "truncate vault.secrets; select cron.schedule('metimaia-document-notify','0 0 * * *','select 42'); update cron.job set username='another_owner';",
  );
  await expect(db.exec(setup)).rejects.toThrow(/Conflitto sul job/);
  await db.exec("rollback");
  expect((await db.query("select * from vault.secrets")).rows).toEqual([]);
  expect(
    (await db.query("select username,command from cron.job")).rows,
  ).toEqual([{ username: "another_owner", command: "select 42" }]);
});

test("unprivileged roles cannot configure or execute the protected scheduled command", async () => {
  await db.exec(setup);
  const command = (
    await db.query<{ command: string }>("select command from cron.job")
  ).rows[0].command;
  await db.exec("set role authenticated");
  await expect(db.exec(command)).rejects.toThrow(/permission denied/);
  await db.exec("reset role; set role anon");
  await expect(db.exec(command)).rejects.toThrow(/permission denied/);
});

test("missing, duplicated or malformed rotated tokens never produce a scheduled request", async () => {
  await db.exec(setup);
  const command = (
    await db.query<{ command: string }>("select command from cron.job")
  ).rows[0].command;
  await db.exec("delete from vault.secrets");
  await db.exec(command);
  await db.query(
    "insert into vault.secrets(name,secret) values('document_notify_job_token',$1)",
    ["a".repeat(32) + "\r\nX-Injected: invalid"],
  );
  await db.exec(command);
  await db.query("update vault.secrets set secret=$1", [token]);
  await db.query(
    "insert into vault.secrets(name,secret) values('document_notify_job_token',$1)",
    [token],
  );
  await db.exec(command);
  expect((await db.query("select * from net.requests")).rows).toEqual([]);
});
