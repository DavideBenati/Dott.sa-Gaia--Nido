import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadMemberMilestones,
  recordFirstRecommendationSelection,
} from "../packages/data/src/member-milestones";

const userId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key, email_confirmed_at timestamptz, deleted_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    grant usage on schema auth, public, private to anon, authenticated;
    create table public.user_preferences(user_id uuid primary key, payload jsonb);
  `);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610300015_member_milestones.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});

beforeEach(async () => {
  await db.exec(
    "reset role; set test.uid=''; truncate auth.users cascade; truncate public.user_preferences;",
  );
  await db.query(
    "insert into auth.users(id,email_confirmed_at) values ($1,now()),($2,now())",
    [userId, otherId],
  );
});

afterAll(async () => {
  await db.close();
});

async function asMember(id = userId) {
  await db.query("select set_config('test.uid',$1,false)", [id]);
  await db.exec("set role authenticated");
}

async function rpc(name: string, args: string[] = []) {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(",");
  return (
    await db.query<{ result: unknown }>(
      `select public.${name}(${placeholders}) as result`,
      args,
    )
  ).rows[0].result;
}

test("selection is atomic, idempotent, isolated from preferences, and contains no product or health values", async () => {
  const preferences = { journey: "pregnancy", sensitiveConsent: false };
  await db.query("insert into public.user_preferences values($1,$2)", [
    userId,
    preferences,
  ]);
  await asMember();
  expect(await rpc("my_member_milestones")).toEqual({
    first_recommendation_selected: false,
  });
  for (let i = 0; i < 2; i++)
    expect(
      await rpc("record_first_recommendation_selection", [userId]),
    ).toEqual({ first_recommendation_selected: true });
  await db.exec("reset role");
  expect(
    (await db.query("select * from private.member_milestones")).rows,
  ).toEqual([{ user_id: userId, first_recommendation_selected: true }]);
  expect(
    (await db.query("select payload from public.user_preferences")).rows,
  ).toEqual([{ payload: preferences }]);
  await db.query(
    "update public.user_preferences set payload='{}' where user_id=$1",
    [userId],
  );
  await asMember();
  expect(await rpc("my_member_milestones")).toEqual({
    first_recommendation_selected: true,
  });
  await db.exec("reset role");
  await asMember(otherId);
  expect(await rpc("my_member_milestones")).toEqual({
    first_recommendation_selected: false,
  });
});

test("wrong, missing, anonymous and unconfirmed owners cannot record; direct table access is denied", async () => {
  await asMember();
  await expect(
    rpc("record_first_recommendation_selection", [otherId]),
  ).rejects.toThrow(/account è cambiato/);
  await expect(
    db.query("select public.record_first_recommendation_selection(null)"),
  ).rejects.toThrow(/account è cambiato/);
  await expect(
    db.query("select * from private.member_milestones"),
  ).rejects.toThrow(/permission denied/);
  await expect(
    db.query("insert into private.member_milestones values($1,true)", [userId]),
  ).rejects.toThrow(/permission denied/);
  await db.exec("reset role; set role anon");
  await expect(rpc("my_member_milestones")).rejects.toThrow(
    /permission denied/,
  );
  await expect(
    rpc("record_first_recommendation_selection", [userId]),
  ).rejects.toThrow(/permission denied/);
  await db.exec("reset role; set test.uid=''; set role authenticated");
  await expect(rpc("my_member_milestones")).rejects.toThrow(
    /account confermato/,
  );
  await db.exec("reset role");
  await db.query("update auth.users set email_confirmed_at=null where id=$1", [
    userId,
  ]);
  await asMember();
  await expect(
    rpc("record_first_recommendation_selection", [userId]),
  ).rejects.toThrow(/account confermato/);
});

test("deleted accounts cannot read or write milestones and hard deletion cascades", async () => {
  await asMember();
  await rpc("record_first_recommendation_selection", [userId]);
  await db.exec("reset role");
  await db.query("update auth.users set deleted_at=now() where id=$1", [
    userId,
  ]);
  await asMember();
  await expect(rpc("my_member_milestones")).rejects.toThrow(
    /account confermato/,
  );
  await expect(
    rpc("record_first_recommendation_selection", [userId]),
  ).rejects.toThrow(/account confermato/);
  await db.exec("reset role");
  await db.query("delete from auth.users where id=$1", [userId]);
  expect(
    (await db.query("select * from private.member_milestones")).rows,
  ).toEqual([]);
});

function fixture(value: unknown = { first_recommendation_selected: false }) {
  const getUser = vi.fn(async () => ({
    data: { user: { id: userId } as { id: string } | null },
    error: null,
  }));
  const rpc = vi.fn(async () => ({
    data: value,
    error: null as { code: string } | null,
  }));
  const from = vi.fn();
  return {
    getUser,
    rpc,
    from,
    client: { auth: { getUser }, rpc, from } as unknown as SupabaseClient,
  };
}

test("helpers validate owner before and after the RPC and send only the expected owner", async () => {
  const f = fixture({ first_recommendation_selected: true });
  expect(await recordFirstRecommendationSelection(f.client, userId)).toEqual({
    first_recommendation_selected: true,
  });
  expect(f.rpc).toHaveBeenCalledExactlyOnceWith(
    "record_first_recommendation_selection",
    { p_expected_user_id: userId },
  );
  expect(f.getUser).toHaveBeenCalledTimes(2);
  expect(f.from).not.toHaveBeenCalled();
  const wrong = fixture();
  await expect(
    recordFirstRecommendationSelection(wrong.client, otherId),
  ).rejects.toThrow(/account è cambiato/);
  await expect(loadMemberMilestones(wrong.client, otherId)).rejects.toThrow(
    /account è cambiato/,
  );
  expect(wrong.rpc).not.toHaveBeenCalled();
  const switched = fixture();
  switched.getUser.mockResolvedValueOnce({
    data: { user: { id: userId } },
    error: null,
  });
  switched.getUser.mockResolvedValueOnce({
    data: { user: { id: otherId } },
    error: null,
  });
  await expect(loadMemberMilestones(switched.client, userId)).rejects.toThrow(
    /account è cambiato/,
  );
});

test("malformed replies, anonymous callers and unavailable migrations fail closed", async () => {
  for (const value of [
    null,
    [],
    {},
    { first_recommendation_selected: "true" },
    { first_recommendation_selected: true, product_id: "secret" },
  ])
    await expect(loadMemberMilestones(fixture(value).client)).rejects.toThrow(
      /non valida/,
    );
  const anonymous = fixture();
  anonymous.getUser.mockResolvedValue({ data: { user: null }, error: null });
  await expect(
    recordFirstRecommendationSelection(anonymous.client, userId),
  ).rejects.toThrow(/Accedi/);
  expect(anonymous.rpc).not.toHaveBeenCalled();
  const missing = fixture();
  missing.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
  await expect(loadMemberMilestones(missing.client)).rejects.toThrow(/015/);
  const unavailable = fixture();
  unavailable.rpc.mockRejectedValue(new Error("private internals"));
  await expect(loadMemberMilestones(unavailable.client)).rejects.toThrow(
    /connessione/,
  );
});
