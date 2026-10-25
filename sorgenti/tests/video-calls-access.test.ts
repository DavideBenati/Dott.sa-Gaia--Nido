import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const manager = "11111111-1111-4111-8111-111111111111";
const alice = "22222222-2222-4222-8222-222222222222";
const bob = "33333333-3333-4333-8333-333333333333";
const pending = "44444444-4444-4444-8444-444444444444";
let db: PGlite;
async function asUser(id: string | null) {
  await db.exec("reset role; set role authenticated");
  await db.query("select set_config('test.uid',$1,false)", [id ?? ""]);
}
async function create(
  id = alice,
  url = "https://meet.hostpoint.ch/random-room-123456",
  owner = manager,
) {
  return (
    await db.query<{ id: string }>(
      "select create_video_call_invitation($1,$2,$3) as id",
      [id, url, owner],
    )
  ).rows[0].id;
}
async function list(manage = false) {
  return (
    await db.query<{ id: string; email: string }>(
      "select * from list_video_call_invitations($1)",
      [manage],
    )
  ).rows;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function public.is_editor() returns boolean language sql stable as $$select auth.uid()='${manager}'::uuid$$;
    create table profiles(user_id uuid primary key references auth.users(id) on delete cascade,display_name text);
    grant usage on schema auth,public to authenticated,anon;`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610250010_video_calls.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
beforeEach(async () => {
  await db.exec("reset role; truncate auth.users cascade");
  for (const [id, email, confirmed] of [
    [manager, "gaia@example.invalid", true],
    [alice, "alice@example.invalid", true],
    [bob, "bob@example.invalid", true],
    [pending, "pending@example.invalid", false],
  ] as const) {
    await db.query(
      "insert into auth.users values($1,$2,case when $3 then now() else null end)",
      [id, email, confirmed],
    );
    await db.query("insert into profiles values($1,'Sole')", [id]);
  }
  await asUser(manager);
});
afterAll(async () => {
  await db.close();
});

test("manager creates a UUID-scoped invitation; other recipients cannot list or open it", async () => {
  const id = await create();
  expect(await list(true)).toHaveLength(1);
  await asUser(alice);
  expect((await list())[0].id).toBe(id);
  expect(
    (
      await db.query<{ url: string }>(
        "select open_video_call_invitation($1,$2) as url",
        [id, alice],
      )
    ).rows[0].url,
  ).toMatch(/^https:\/\/meet.hostpoint.ch\//);
  await expect(list(true)).rejects.toThrow();
  await asUser(bob);
  expect(await list()).toEqual([]);
  await expect(
    db.query("select open_video_call_invitation($1,$2)", [id, bob]),
  ).rejects.toThrow();
  await expect(
    db.query("select open_video_call_invitation($1,$2)", [id, alice]),
  ).rejects.toThrow();
});

test("revoke and expiry close site access, without a public table or anonymous RPC", async () => {
  const id = await create();
  await db.query("select revoke_video_call_invitation($1,$2)", [id, manager]);
  await asUser(alice);
  expect(await list()).toEqual([]);
  await expect(
    db.query("select open_video_call_invitation($1,$2)", [id, alice]),
  ).rejects.toThrow();
  await db.exec("reset role");
  await db.query(
    "update private.video_call_invitations set revoked_at=null,expires_at=now()-interval '1 second' where id=$1",
    [id],
  );
  await asUser(manager);
  expect(await list(true)).toEqual([]);
  await expect(
    db.query("select open_video_call_invitation($1,$2)", [id, manager]),
  ).rejects.toThrow();
  await expect(
    db.exec("select * from private.video_call_invitations"),
  ).rejects.toThrow();
  await db.exec("reset role; set role anon");
  await expect(
    db.exec("select * from list_video_call_invitations(false)"),
  ).rejects.toThrow();
});

test("only managers create; rejects unsafe URLs, reused rooms, unconfirmed accounts and changed sessions", async () => {
  for (const url of [
    "https://evil.invalid/room1234",
    "http://meet.hostpoint.ch/room1234",
    "https://meet.hostpoint.ch.evil.invalid/room1234",
    "https://meet.hostpoint.ch/room1234?token=secret",
    "https://meet.hostpoint.ch/short",
  ])
    await expect(create(alice, url)).rejects.toThrow();
  await expect(create(pending)).rejects.toThrow();
  await expect(create(alice, undefined, alice)).rejects.toThrow();
  await create();
  await expect(create(bob)).rejects.toThrow();
  await asUser(alice);
  await expect(create()).rejects.toThrow();
  await expect(
    db.query("select * from search_video_call_users('Sole')"),
  ).rejects.toThrow();
});

test("search distinguishes duplicate nicknames and returns confirmed identities without profile details", async () => {
  const result = await db.query<{
    user_id: string;
    email: string;
    nickname: string;
  }>("select * from search_video_call_users('Sole')");
  expect(result.rows).toHaveLength(3);
  expect(Object.keys(result.rows[0]).sort()).toEqual([
    "email",
    "nickname",
    "user_id",
  ]);
  expect(result.rows.some((r) => r.user_id === pending)).toBe(false);
  expect(
    (await db.query("select * from search_video_call_users('%_')")).rows,
  ).toEqual([]);
});
