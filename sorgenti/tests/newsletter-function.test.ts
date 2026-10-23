import { beforeEach, describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
let handler: (request: Request) => Promise<Response>;
let existing = false;
let validLink = true;
let sent: { html: string; to: string[] }[];
let writes: Record<string, unknown>[];
beforeEach(async () => {
  existing = false;
  validLink = true;
  sent = [];
  writes = [];
  const source = (
    await readFile(
      new URL("../supabase/functions/newsletter/index.ts", import.meta.url),
      "utf8",
    )
  ).replace(/import \{ createClient \} from "npm:[^"]+";/, "");
  const client = {
    rpc: async () => ({ data: true, error: null }),
    from: () => {
      let mode = "read";
      const chain = {
        select: () => chain,
        delete: () => {
          mode = "delete";
          return chain;
        },
        update: (value: Record<string, unknown>) => {
          mode = "update";
          writes.push(value);
          return chain;
        },
        upsert: (value: Record<string, unknown>) => {
          writes.push(value);
          return Promise.resolve({ error: null });
        },
        eq: () => chain,
        lt: () => chain,
        gt: () => chain,
        maybeSingle: async () => ({
          data: existing ? { status: "confirmed" } : null,
          error: null,
        }),
        then: (resolve: (value: object) => void) =>
          resolve({
            error: null,
            data: mode === "update" && validLink ? [{ id: "id" }] : [],
          }),
      };
      return chain;
    },
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
              RESEND_API_KEY: "test-secret",
              SUPABASE_URL: "https://backend.invalid",
              SUPABASE_SERVICE_ROLE_KEY: "server-only",
            })[key as "RESEND_API_KEY"],
        },
        serve: (fn: typeof handler) => {
          handler = fn;
        },
      },
      Response,
      Request,
      URL,
      crypto,
      TextEncoder,
      Date,
      fetch: async (_url: string, options: { body: string }) => {
        if (_url.endsWith("/newsletter-sync"))
          return new Response("{}", { status: 200 });
        sent.push(JSON.parse(options.body));
        return new Response("{}", { status: 200 });
      },
    },
  );
});
const post = (body: object, origin = "https://metimaia.com") =>
  handler(
    new Request("https://backend.invalid/functions/v1/newsletter", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
describe("newsletter request handler", () => {
  test("rejects missing consent and cross-origin calls without sending", async () => {
    expect((await post({ email: "test@example.invalid" })).status).toBe(400);
    expect(
      (
        await post(
          {
            email: "test@example.invalid",
            consent: true,
            consentVersion: "2026-10-23-v1",
          },
          "https://other.invalid",
        )
      ).status,
    ).toBe(403);
    expect(sent).toHaveLength(0);
  });
  test("stores pending consent and hashed single-use tokens; never silently confirms", async () => {
    const response = await post({
      email: "Test@example.invalid",
      consent: true,
      consentVersion: "2026-10-23-v1",
    });
    expect(response.status).toBe(200);
    expect(writes[0].status).toBe("pending");
    expect(writes[0].email).toBe("test@example.invalid");
    expect(sent).toHaveLength(1);
    const rawToken = sent[0].html.match(
      /action=confirm&token=([a-f0-9]{64})/,
    )![1];
    expect(writes[0].confirmation_hash).not.toBe(rawToken);
    expect(JSON.stringify(writes)).not.toContain(rawToken);
    expect(sent[0].html).toContain("action=unsubscribe");
  });
  test("email scanners cannot activate subscriptions with GET", async () => {
    expect(
      (
        await handler(
          new Request(
            "https://backend.invalid/functions/v1/newsletter?action=confirm&token=" +
              "a".repeat(64),
          ),
        )
      ).status,
    ).toBe(405);
    expect(writes).toHaveLength(0);
  });
  test("confirmation requires valid token; expired token reports failure", async () => {
    expect((await post({ action: "confirm", token: "invalid" })).status).toBe(
      400,
    );
    expect(
      (await post({ action: "confirm", token: "a".repeat(64) })).status,
    ).toBe(200);
    expect(writes[0]).toMatchObject({
      status: "confirmed",
      confirmation_hash: null,
    });
    validLink = false;
    expect(
      (await post({ action: "confirm", token: "b".repeat(64) })).status,
    ).toBe(400);
  });
  test("unsubscribe deactivates the newsletter independently of the account", async () => {
    expect(
      (await post({ action: "unsubscribe", token: "a".repeat(64) })).status,
    ).toBe(200);
    expect(writes[0]).toMatchObject({ status: "unsubscribed" });
  });
  test("already confirmed addresses receive generic response without another email", async () => {
    existing = true;
    expect(
      (
        await post({
          email: "test@example.invalid",
          consent: true,
          consentVersion: "2026-10-23-v1",
        })
      ).status,
    ).toBe(200);
    expect(sent).toHaveLength(0);
  });
});
