import { beforeEach, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
let handler: (req: Request) => Promise<Response>;
let external: {
  path: string;
  method: string;
  body: Record<string, unknown> | null;
}[];
let writes: { table: string; value: Record<string, unknown> }[];
let events: Record<string, unknown>[];
let providerSeen = false;
let providerStatus = 200,
  remoteUnsub = false,
  localStatus = "confirmed",
  isEditor = true;
const subscriber = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "test@example.invalid",
  confirmed_at: "2026-10-22T10:00:00Z",
};
const webhookSecret = Buffer.from(
  "test-signing-key-32-characters-long",
).toString("base64");
beforeEach(async () => {
  external = [];
  writes = [];
  events = [];
  providerSeen = false;
  providerStatus = 200;
  remoteUnsub = false;
  localStatus = "confirmed";
  isEditor = true;
  const client = {
    auth: {
      getUser: async (token: string) => ({
        data: { user: token === "valid-user" ? { id: "user" } : null },
        error: null,
      }),
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === "is_editor") return { data: isEditor, error: null };
      if (name === "newsletter_provider_optout") {
        events.push(args);
        return { error: null };
      }
      if (name === "newsletter_claim_jobs")
        return {
          data: [
            {
              subscriber_id: subscriber.id,
              revision: "revision",
              claim_token: "claim",
              provider_seen: providerSeen,
            },
          ],
          error: null,
        };
      return { data: null, error: null };
    },
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        update: (value: Record<string, unknown>) => {
          writes.push({ table, value });
          return chain;
        },
        maybeSingle: async () => ({
          data: { ...subscriber, status: localStatus },
          error: null,
        }),
        then: (resolve: (value: object) => void) =>
          resolve({ data: [], count: 0, error: null }),
      };
      return chain;
    },
  };
  const source = (
    await readFile(
      new URL(
        "../supabase/functions/newsletter-sync/index.ts",
        import.meta.url,
      ),
      "utf8",
    )
  ).replace(/import \{ createClient \} from "npm:[^"]+";/, "");
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
              SUPABASE_SERVICE_ROLE_KEY: "server-secret",
              SUPABASE_ANON_KEY: "public-key",
              RESEND_CONTACTS_API_KEY: "provider-secret",
              RESEND_WEBHOOK_SECRET: "whsec_" + webhookSecret,
            })[key],
        },
        serve: (fn: typeof handler) => (handler = fn),
      },
      Request,
      Response,
      URL,
      Date,
      TextEncoder,
      AbortSignal,
      atob,
      crypto,
      setTimeout: (fn: () => void) => {
        fn();
        return 0;
      },
      fetch: async (
        url: string,
        options: { method: string; body?: string },
      ) => {
        external.push({
          path: new URL(url).pathname,
          method: options.method,
          body: options.body ? JSON.parse(options.body) : null,
        });
        return new Response(JSON.stringify({ unsubscribed: remoteUnsub }), {
          status: providerStatus,
        });
      },
    },
  );
});
const post = (auth = "", body: object = { action: "retry" }) =>
  handler(
    new Request("https://backend.invalid/functions/v1/newsletter-sync", {
      method: "POST",
      headers: { Authorization: auth },
      body: JSON.stringify(body),
    }),
  );
test("missing, forged and normal-account authorization cannot synchronize contacts", async () => {
  expect((await post()).status).toBe(401);
  expect((await post("Bearer forged")).status).toBe(401);
  isEditor = false;
  expect((await post("Bearer valid-user")).status).toBe(403);
  expect(external).toHaveLength(0);
  expect(writes).toHaveLength(0);
});
test("local unsubscribe propagates but provider unsubscribe is never reactivated", async () => {
  localStatus = "unsubscribed";
  expect((await post("Bearer server-secret")).status).toBe(200);
  expect(
    external.some((x) => x.method === "PATCH" && x.body?.unsubscribed === true),
  ).toBe(true);
  external = [];
  writes = [];
  localStatus = "confirmed";
  remoteUnsub = true;
  await post("Bearer server-secret");
  expect(external.some((x) => x.body?.unsubscribed === false)).toBe(false);
  expect(
    writes.some(
      (x) =>
        x.table === "newsletter_subscribers" &&
        x.value.status === "unsubscribed",
    ),
  ).toBe(true);
});
test("API failures remain retryable and never report the job as synchronized", async () => {
  providerStatus = 403;
  await post("Bearer server-secret");
  expect(
    writes.find((x) => x.table === "newsletter_sync_jobs")?.value,
  ).toMatchObject({ state: "error", last_code: "PROVIDER_403" });
});
async function webhook(body: object, valid = true, age = 0) {
  const id = "evt_signed_test",
    stamp = String(Math.floor(Date.now() / 1000) - age),
    raw = JSON.stringify(body);
  const key = await crypto.subtle.importKey(
    "raw",
    Buffer.from(webhookSecret, "base64"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = Buffer.from(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${id}.${stamp}.${raw}`),
    ),
  ).toString("base64");
  return handler(
    new Request(
      "https://backend.invalid/functions/v1/newsletter-sync?webhook=resend",
      {
        method: "POST",
        headers: {
          "svix-id": id,
          "svix-timestamp": stamp,
          "svix-signature": "v1," + (valid ? signature : "invalid"),
        },
        body: raw,
      },
    ),
  );
}
test("webhooks require a current cryptographic signature and cannot create consent", async () => {
  const body = {
    type: "contact.updated",
    created_at: new Date().toISOString(),
    data: { email: subscriber.email, unsubscribed: true },
  };
  expect((await webhook(body, false)).status).toBe(401);
  expect((await webhook(body, true, 600)).status).toBe(401);
  expect(events).toHaveLength(0);
  expect(
    (await webhook({ ...body, data: { ...body.data, unsubscribed: false } }))
      .status,
  ).toBe(200);
  expect(events).toHaveLength(0);
  expect((await webhook(body)).status).toBe(200);
  expect(events[0].event_email).toBe(subscriber.email);
});

test("a previously synchronized contact deleted by the provider is not recreated", async () => {
  providerSeen = true;
  providerStatus = 404;
  await post("Bearer server-secret");
  expect(external.some((x) => x.method === "POST")).toBe(false);
  expect(
    writes.some(
      (x) =>
        x.table === "newsletter_subscribers" &&
        x.value.status === "unsubscribed",
    ),
  ).toBe(true);
});
