import { beforeEach, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
let handler: (r: Request) => Promise<Response>;
let slots = true;
let duplicate = false;
let inserts: unknown[];
let sends: number;
beforeEach(async () => {
  slots = true;
  duplicate = false;
  inserts = [];
  sends = 0;
  const source = (
    await readFile(
      new URL("../supabase/functions/site-actions/index.ts", import.meta.url),
      "utf8",
    )
  ).replace(/import \{ createClient \} from "npm:[^"]+";/, "");
  const client = {
    rpc: async () => ({ data: slots, error: null }),
    from: () => ({
      insert: async (v: unknown) => {
        inserts.push(v);
        return { error: duplicate ? { code: "23505" } : null };
      },
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  };
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText,
    {
      createClient: () => client,
      Deno: {
        env: {
          get: (key: string) =>
            ({
              SUPABASE_URL: "https://backend.invalid",
              SUPABASE_SERVICE_ROLE_KEY: "server-only",
              RESEND_API_KEY: "test-only",
              BOOKING_RATE_SALT: "test-only-salt",
            })[key],
        },
        serve: (fn: typeof handler) => (handler = fn),
      },
      Request,
      Response,
      Date,
      crypto,
      TextEncoder,
      AbortSignal,
      fetch: async () => {
        sends++;
        return new Response("{}", { status: 200 });
      },
    },
  );
});
const valid = {
  action: "booking",
  id: "11111111-1111-4111-8111-111111111111",
  request: {
    name: "Test",
    email: "test@example.invalid",
    topic: "Informazioni sui servizi",
    date: "",
    time: "Da concordare",
    mode: "Da concordare",
  },
};
const post = (body: object, origin = "https://metimaia.com") =>
  handler(
    new Request("https://backend.invalid", {
      method: "POST",
      headers: { origin },
      body: JSON.stringify(body),
    }),
  );
test("rejects invalid and cross-origin submissions without writing or sending", async () => {
  expect((await post(valid, "https://other.invalid")).status).toBe(403);
  expect(
    (
      await post({
        ...valid,
        request: { ...valid.request, date: "2027-02-30" },
      })
    ).status,
  ).toBe(400);
  expect(
    (await post({ ...valid, request: { ...valid.request, email: "bad" } }))
      .status,
  ).toBe(400);
  expect(inserts).toHaveLength(0);
  expect(sends).toBe(0);
});
test("rate limit prevents both storage and mail", async () => {
  slots = false;
  expect((await post(valid)).status).toBe(429);
  expect(inserts).toHaveLength(0);
  expect(sends).toBe(0);
});
test("saves a request and sends only a generic fixed-destination notification; retries do not resend", async () => {
  expect((await post(valid)).status).toBe(200);
  expect(inserts).toHaveLength(1);
  expect(sends).toBe(1);
  duplicate = true;
  expect((await post(valid)).status).toBe(200);
  expect(sends).toBe(1);
});
