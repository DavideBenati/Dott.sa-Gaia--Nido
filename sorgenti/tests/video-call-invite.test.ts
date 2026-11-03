import { beforeEach, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const invitationId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
const lease = "33333333-3333-4333-8333-333333333333";
const manager = "44444444-4444-4444-8444-444444444444";
let handler: (request: Request) => Promise<Response>;
let configuration: Record<string, string>;
let claim: Record<string, unknown>;
let permission: boolean;
let authorized: boolean;
let claimError: boolean;
let finishFailure: boolean;
let providerStatus: number;
let providerThrows: boolean;
let providerReceipt: unknown;
let calls: { name: string; args: Record<string, unknown>; scope: string }[];
let deliveries: {
  url: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}[];

beforeEach(async () => {
  configuration = {
    SUPABASE_URL: "https://backend.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "server-key",
    SUPABASE_ANON_KEY: "public-key",
    RESEND_API_KEY: "private-provider-secret",
  };
  claim = {
    status: "sending",
    job_id: jobId,
    lease_token: lease,
    invitation_id: invitationId,
    recipient_email: "patient@example.invalid",
    expires_at: "2026-11-10T16:00:00+00:00",
    accepted_at: null,
  };
  permission = true;
  authorized = true;
  claimError = false;
  finishFailure = false;
  providerStatus = 200;
  providerThrows = false;
  providerReceipt = { id: "provider-receipt" };
  calls = [];
  deliveries = [];
  const source = (
    await readFile(
      new URL(
        "../supabase/functions/video-call-invite/index.ts",
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
      createClient: (
        _url: string,
        key: string,
        options?: { global?: { headers?: { Authorization?: string } } },
      ) => {
        const scope =
          key === "server-key"
            ? "service"
            : (options?.global?.headers?.Authorization ?? "");
        return {
          auth: {
            getUser: async (token: string) => ({
              data: {
                user: ["manager-token", "patient-token"].includes(token)
                  ? { id: manager }
                  : null,
              },
              error: null,
            }),
          },
          rpc: async (name: string, args: Record<string, unknown> = {}) => {
            calls.push({ name, args, scope });
            if (name === "is_editor")
              return {
                data: permission && scope === "Bearer manager-token",
                error: null,
              };
            if (name === "video_call_email_claim") {
              expect(scope).toBe("Bearer manager-token");
              expect(args).toEqual({
                p_invitation_id: invitationId,
                p_expected_user_id: manager,
              });
              return {
                data: claim,
                error: claimError
                  ? { code: "42501", message: "Private database detail" }
                  : null,
              };
            }
            if (name === "video_call_email_authorized")
              return { data: authorized, error: null };
            if (name === "video_call_email_finish") {
              expect(scope).toBe("service");
              return { data: !finishFailure, error: null };
            }
            if (name === "list_video_call_email_status")
              return {
                data: [
                  {
                    invitation_id: invitationId,
                    status: "accepted",
                    accepted_at: "2026-11-03T10:00:00Z",
                  },
                ],
                error: null,
              };
            throw new Error("Unexpected RPC " + name);
          },
        };
      },
      Deno: {
        env: { get: (key: string) => configuration[key] },
        serve: (fn: typeof handler) => {
          handler = fn;
        },
      },
      Request,
      Response,
      URL,
      Date,
      TextDecoder,
      AbortSignal,
      fetch: async (
        url: string,
        options: { body: string; headers: Record<string, string> },
      ) => {
        deliveries.push({
          url,
          body: JSON.parse(options.body),
          headers: options.headers,
        });
        if (providerThrows) throw new Error("Private provider error");
        return new Response(JSON.stringify(providerReceipt), {
          status: providerStatus,
        });
      },
    },
  );
});

function request(
  body: unknown = { invitation_id: invitationId },
  token = "manager-token",
  extraHeaders: Record<string, string> = {},
) {
  return handler(
    new Request("https://backend.invalid/functions/v1/video-call-invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    }),
  );
}
const finished = () =>
  calls.filter((call) => call.name === "video_call_email_finish");

test("manual send uses only the DB recipient and private invitation link with truthful accepted status", async () => {
  const response = await request();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    status: "accepted",
    accepted_at: "2026-11-03T10:00:00Z",
  });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(deliveries).toHaveLength(1);
  expect(deliveries[0].url).toBe("https://api.resend.com/emails");
  expect(deliveries[0].body.to).toEqual(["patient@example.invalid"]);
  expect(deliveries[0].body.from).toBe(
    "Dott.sa Gaia | metiMaia <noreply@metimaia.com>",
  );
  expect(deliveries[0].body.reply_to).toBe("ostetricamaia@gmail.com");
  expect(String(deliveries[0].body.text)).toContain(
    `https://metimaia.com/videochiamate?invito=${invitationId}`,
  );
  expect(String(deliveries[0].body.text)).toContain(
    "Accedi con l’account che usa questa email",
  );
  expect(String(deliveries[0].body.text)).toContain(
    "non la data dell’appuntamento",
  );
  expect(String(deliveries[0].body.text)).toContain("\n\n");
  expect(String(deliveries[0].body.text)).not.toContain("\\n");
  expect(JSON.stringify(deliveries[0].body)).not.toContain(
    "https://meet.hostpoint.ch/",
  );
  expect(deliveries[0].headers["Idempotency-Key"]).toBe(
    `video-invite-${jobId}`,
  );
  expect(finished()[0].args.p_result).toBe("accepted");
});

test("missing/invalid auth, patient tokens, MFA/permission failure and wrong origins never send", async () => {
  for (const token of ["", "invalid-token", "patient-token"])
    expect((await request(undefined, token)).status).toBe(
      token === "patient-token" ? 403 : 401,
    );
  permission = false;
  expect((await request()).status).toBe(403);
  permission = true;
  expect(
    (
      await request(undefined, "manager-token", {
        Origin: "https://evil.invalid",
      })
    ).status,
  ).toBe(403);
  expect(deliveries).toHaveLength(0);
  expect(calls.some((call) => call.name === "video_call_email_claim")).toBe(
    false,
  );
});

test("arbitrary email, raw room URL, unknown fields and oversized input cannot enter a send", async () => {
  for (const input of [
    { invitation_id: invitationId, email: "other@example.invalid" },
    {
      invitation_id: invitationId,
      room_url: "https://meet.hostpoint.ch/room12345",
    },
    { invitation_id: "bad" },
    null,
    [],
    { invitation_id: "x".repeat(2000) },
  ])
    expect((await request(input)).status).toBe(400);
  expect(deliveries).toHaveLength(0);
  expect(calls.some((call) => call.name === "video_call_email_claim")).toBe(
    false,
  );
});

test("missing provider setup preserves invitation without acquiring a send lease", async () => {
  delete configuration.RESEND_API_KEY;
  const response = await request();
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    error: expect.stringContaining("salvato"),
  });
  expect(calls.some((call) => call.name === "video_call_email_claim")).toBe(
    false,
  );
  expect(deliveries).toHaveLength(0);
});

test("accepted, concurrent sending and closed retries do not send another email", async () => {
  for (const status of ["accepted", "sending", "failed"]) {
    claim = {
      status,
      accepted_at: status === "accepted" ? "2026-11-03T10:00:00Z" : null,
    };
    expect((await (await request()).json()).status).toBe(status);
  }
  expect(deliveries).toHaveLength(0);
  expect(finished()).toHaveLength(0);
});

test("revoked or changed invitation fails closed before contacting provider", async () => {
  claimError = true;
  const rejected = await request();
  expect(rejected.status).toBe(403);
  expect(JSON.stringify(await rejected.json())).not.toContain(
    "Private database",
  );
  claimError = false;
  authorized = false;
  expect((await (await request()).json()).status).toBe("failed");
  expect(finished()[0].args.p_error_code).toBe("access_changed");
  expect(deliveries).toHaveLength(0);
});

test("timeouts and provider 5xx remain uncertain; explicit manual retry keeps exact payload and key", async () => {
  providerThrows = true;
  expect((await (await request()).json()).status).toBe("uncertain");
  providerThrows = false;
  providerStatus = 503;
  expect((await (await request()).json()).status).toBe("uncertain");
  providerStatus = 200;
  expect((await (await request()).json()).status).toBe("accepted");
  expect(deliveries).toHaveLength(3);
  expect(deliveries[1]).toEqual(deliveries[0]);
  expect(deliveries[2]).toEqual(deliveries[0]);
});

test("provider refusal stays retryable; invalid receipt and failed DB persistence never claim success", async () => {
  providerStatus = 429;
  expect((await (await request()).json()).status).toBe("retry");
  providerStatus = 200;
  providerReceipt = {};
  expect((await (await request()).json()).status).toBe("uncertain");
  providerReceipt = { id: "provider-receipt" };
  finishFailure = true;
  expect(await (await request()).json()).toEqual({
    status: "uncertain",
    accepted_at: null,
  });
});

test("malformed DB payload never reaches provider and exposes no secrets", async () => {
  claim.recipient_email = "one@example.invalid,two@example.invalid";
  const response = await request();
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain(
    "provider-secret",
  );
  expect(deliveries).toHaveLength(0);
});
