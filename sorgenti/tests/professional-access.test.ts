import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
let db: PGlite;
const editor = "11111111-1111-4111-8111-111111111111",
  normal = "22222222-2222-4222-8222-222222222222",
  staff = "33333333-3333-4333-8333-333333333333";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create schema private;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('aal',coalesce(current_setting('test.aal',true),'aal1')) $$;grant usage on schema public,auth to anon,authenticated;create table private.editor_memberships(user_id uuid primary key,active boolean default true);create table private.chat_staff(user_id uuid primary key,active boolean default true);create table public.user_preferences(user_id uuid,payload jsonb);`,
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610230005_professional_workspace.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
});
beforeEach(async () => {
  await db.exec(
    `reset role;set test.aal='aal1';truncate auth.users cascade;truncate private.editor_memberships,private.chat_staff,public.booking_requests,public.user_preferences,private.consent_events;insert into auth.users values('${editor}'),('${normal}'),('${staff}');insert into private.editor_memberships(user_id)values('${editor}');insert into private.chat_staff(user_id)values('${staff}');`,
  );
});
afterAll(async () => db.close());
async function as(id: string) {
  await db.exec("reset role;set role authenticated");
  await db.query("select set_config('test.uid',$1,false)", [id]);
}
test("normal accounts and guests cannot alter presentation or read meeting requests", async () => {
  await as(normal);
  await expect(
    db.query("update site_profile set bio='Unauthorized'"),
  ).resolves.toMatchObject({ affectedRows: 0 });
  expect((await db.query("select * from booking_requests")).rows).toHaveLength(
    0,
  );
  await expect(
    db.query(
      "insert into booking_requests(id,name,email,topic,preferred_time,preferred_mode)values(gen_random_uuid(),'A','x@y.z','x','x','x')",
    ),
  ).rejects.toThrow(/permission denied/);
  await db.exec("reset role;set role anon");
  await expect(db.query("select * from booking_requests")).rejects.toThrow(
    /permission denied/,
  );
});
test("editor and chat roles remain separate; MFA is enforced by database after opt in", async () => {
  await as(editor);
  expect(
    (await db.query("select is_editor() ok,is_chat_staff() chat")).rows,
  ).toEqual([{ ok: true, chat: false }]);
  await expect(db.query("select require_professional_mfa()")).rejects.toThrow(
    /Verified MFA/,
  );
  await db.exec("set test.aal='aal2'");
  await db.query("select require_professional_mfa()");
  await db.exec("set test.aal='aal1'");
  expect((await db.query("select is_editor() ok")).rows).toEqual([
    { ok: false },
  ]);
  await db.exec("set test.aal='aal2'");
  expect((await db.query("select is_editor() ok")).rows).toEqual([
    { ok: true },
  ]);
  await as(staff);
  expect(
    (await db.query("select is_editor() ok,is_chat_staff() chat")).rows,
  ).toEqual([{ ok: false, chat: true }]);
});
test("health consent changes are recorded without copying health values", async () => {
  await db.query("insert into user_preferences values($1,$2)", [
    normal,
    { personalized: true, sensitiveConsent: true, dueDate: "2027-02-01" },
  ]);
  await db.query("update user_preferences set payload=$1 where user_id=$2", [
    { personalized: false, sensitiveConsent: false },
    normal,
  ]);
  const rows = (
    await db.query(
      "select purpose,granted,version from private.consent_events order by created_at",
    )
  ).rows;
  expect(rows).toHaveLength(2);
  expect(rows.map((r) => r.granted)).toEqual([true, false]);
  await as(editor);
  await expect(
    db.query("select * from private.consent_events"),
  ).rejects.toThrow(/permission denied/);
});
