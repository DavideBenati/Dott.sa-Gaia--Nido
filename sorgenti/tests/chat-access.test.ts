import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
const mother = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const doctor = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
async function asUser(id: string) {
  await db.exec("reset role; set role authenticated;");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
}
async function send(conversation: string, body: string) {
  return db.query(
    "insert into public.care_messages(conversation_id,body) values($1,$2)",
    [conversation, body],
  );
}
beforeAll(async () => {
  db = new PGlite();
  // Emulate only Supabase's auth primitives and the pre-existing export tables.
  // The actual new migration, including PostgreSQL RLS, runs unchanged below.
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated;
    grant execute on function auth.uid() to authenticated;
    create table public.profiles(user_id uuid);
    create table public.user_preferences(user_id uuid,payload jsonb);
    create table public.notification_preferences(user_id uuid);
    create table public.user_favorites(user_id uuid,article_id uuid);
    create table public.checklist_progress(user_id uuid,item_id uuid,completed boolean);
  `);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610220002_private_chat.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    "grant select on public.profiles,public.user_preferences,public.notification_preferences,public.user_favorites,public.checklist_progress to authenticated; grant execute on function public.export_my_data() to authenticated;",
  );
});
beforeEach(async () => {
  await db.exec("reset role; truncate auth.users cascade;");
  for (const id of [mother, other, doctor])
    await db.query("insert into auth.users values($1)", [id]);
  await db.query("insert into private.chat_staff(user_id) values($1)", [
    doctor,
  ]);
  await asUser(mother);
  await db.query("insert into public.care_conversations(user_id) values($1)", [
    mother,
  ]);
});
afterAll(async () => {
  await db.close();
});
describe("private chat database authorization", () => {
  test("another mother cannot read or write someone else's conversation", async () => {
    await send(mother, "Domanda privata");
    await asUser(other);
    expect(
      (await db.query("select * from care_conversations")).rows,
    ).toHaveLength(0);
    expect((await db.query("select * from care_messages")).rows).toHaveLength(
      0,
    );
    await expect(send(mother, "Tentativo")).rejects.toThrow();
    await expect(
      db.query("insert into care_conversations(user_id) values($1)", [mother]),
    ).rejects.toThrow();
  });
  test("only explicitly enabled chat staff can read and reply", async () => {
    await send(mother, "Informazioni sugli incontri");
    await asUser(doctor);
    expect((await db.query("select * from care_messages")).rows).toHaveLength(
      1,
    );
    await send(mother, "Ecco le disponibilità");
    await asUser(mother);
    expect((await db.query("select * from care_messages")).rows).toHaveLength(
      2,
    );
    await db.exec("reset role");
    await db.query(
      "update private.chat_staff set active=false where user_id=$1",
      [doctor],
    );
    await asUser(doctor);
    expect((await db.query("select * from care_messages")).rows).toHaveLength(
      0,
    );
    await expect(
      send(mother, "Risposta senza autorizzazione"),
    ).rejects.toThrow();
  });
  test("senders, timestamps, staff membership and message history cannot be forged", async () => {
    await send(mother, "Messaggio originale");
    await expect(
      db.query(
        "insert into care_messages(conversation_id,sender_id,body) values($1,$2,'Falso')",
        [mother, doctor],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "insert into care_messages(conversation_id,body,created_at) values($1,'Falso',now())",
        [mother],
      ),
    ).rejects.toThrow();
    await expect(
      db.query("insert into private.chat_staff(user_id) values($1)", [mother]),
    ).rejects.toThrow();
    await expect(
      db.exec("update care_messages set body='Modificato'"),
    ).rejects.toThrow();
    await expect(db.exec("delete from care_messages")).rejects.toThrow();
    await expect(send(mother, " ")).rejects.toThrow();
    await expect(send(mother, "a".repeat(4001))).rejects.toThrow();
  });
  test("sending is blocked until a professional is enabled; anonymous access is denied", async () => {
    await db.exec("reset role; update private.chat_staff set active=false;");
    await asUser(mother);
    expect(
      (
        await db.query<{ care_chat_available: boolean }>(
          "select care_chat_available()",
        )
      ).rows[0].care_chat_available,
    ).toBe(false);
    await expect(
      send(mother, "Nessuna professionista attiva"),
    ).rejects.toThrow();
    await db.exec("reset role; set role anon");
    await expect(db.exec("select * from care_messages")).rejects.toThrow();
    await expect(db.exec("select * from care_conversations")).rejects.toThrow();
    await expect(db.exec("select care_chat_available()")).rejects.toThrow();
    await expect(db.exec("select is_chat_staff()")).rejects.toThrow();
    await expect(db.exec("select export_my_data()")).rejects.toThrow();
  });
  test("export includes only one's own conversation; account deletion removes it", async () => {
    await send(mother, "Messaggio della mamma");
    await asUser(doctor);
    await send(mother, "Risposta");
    await asUser(other);
    await db.query("insert into care_conversations(user_id) values($1)", [
      other,
    ]);
    await send(other, "Altra mamma");
    await asUser(mother);
    const result = await db.query<{ export_my_data: { messages: unknown[] } }>(
      "select export_my_data()",
    );
    expect(result.rows[0].export_my_data.messages).toHaveLength(2);
    await db.exec("reset role");
    await db.query("delete from auth.users where id=$1", [mother]);
    expect(
      (
        await db.query("select * from care_messages where conversation_id=$1", [
          mother,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query("select * from care_messages where conversation_id=$1", [
          other,
        ])
      ).rows,
    ).toHaveLength(1);
  });
});
