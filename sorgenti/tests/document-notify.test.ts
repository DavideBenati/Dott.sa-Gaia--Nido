import { beforeEach, describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type Job = {
  job_id: string;
  lease_token: string;
  document_id: string;
  recipient_id: string;
  document_title: string;
  recipient_email: string;
  attempts: number;
};
let handler: (request: Request) => Promise<Response>;
let configuration: Record<string, string>;
let jobs: Job[];
let authorized: boolean;
let permission: boolean;
let accessFailure: boolean;
let finishFailure: boolean;
let mutateFrozenPayload: boolean;
let providerStatus: number;
let providerThrows: boolean;
let providerReceipt: unknown;
let calls: { name: string; args: Record<string, unknown>; scope: string }[];
let deliveries: {
  url: string;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}[];
const documentId = "11111111-1111-4111-8111-111111111111";
const jobId = "22222222-2222-4222-8222-222222222222";
const lease = "33333333-3333-4333-8333-333333333333";
const recipient = "44444444-4444-4444-8444-444444444444";
const scheduledToken = "private-scheduled-token-at-least-32-characters-long";

beforeEach(async () => {
  configuration = {
    SUPABASE_URL: "https://backend.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-key",
    SUPABASE_ANON_KEY: "public-key",
    RESEND_API_KEY: "provider-secret",
    DOCUMENT_NOTIFY_JOB_TOKEN: scheduledToken,
  };
  jobs = [
    {
      job_id: jobId,
      lease_token: lease,
      document_id: documentId,
      recipient_id: recipient,
      document_title: "La borsa del parto",
      recipient_email: "patient@example.invalid",
      attempts: 1,
    },
  ];
  authorized = true;
  permission = true;
  accessFailure = false;
  finishFailure = false;
  mutateFrozenPayload = false;
  providerStatus = 200;
  providerThrows = false;
  providerReceipt = { id: "resend-provider-receipt" };
  calls = [];
  deliveries = [];
  const source = (
    await readFile(
      new URL(
        "../supabase/functions/document-notify/index.ts",
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
          key === "server-only-key"
            ? "service"
            : (options?.global?.headers?.Authorization ?? "");
        return {
          auth: {
            getUser: async (token: string) => ({
              data: {
                user: ["valid-manager", "valid-patient"].includes(token)
                  ? { id: recipient }
                  : null,
              },
              error: null,
            }),
          },
          rpc: async (name: string, args: Record<string, unknown> = {}) => {
            calls.push({ name, args, scope });
            if (name === "can_manage_documents")
              return {
                data: permission && scope === "Bearer valid-manager",
                error: null,
              };
            if (name === "document_notification_status")
              return {
                data: {
                  pending: jobs.length,
                  sending: 0,
                  accepted: jobs.length ? 0 : 1,
                  failed: 0,
                  cancelled: 0,
                  uncertain: 0,
                },
                error: null,
              };
            expect(scope).toBe("service");
            if (name === "document_notification_claim")
              return { data: jobs.map((row) => ({ ...row })), error: null };
            if (name === "document_notification_authorized")
              return {
                data: authorized
                  ? jobs
                      .filter((row) => row.job_id === args.p_job_id)
                      .map((row) => ({
                        ...row,
                        ...(mutateFrozenPayload
                          ? { recipient_email: "changed@example.invalid" }
                          : {}),
                      }))
                  : [],
                error: accessFailure
                  ? { message: "Secret internal database detail" }
                  : null,
              };
            if (name === "document_notification_finish") {
              if (finishFailure)
                return {
                  data: false,
                  error: { message: "Private write failure" },
                };
              if (["accepted", "cancelled"].includes(String(args.p_result)))
                jobs = jobs.filter((row) => row.job_id !== args.p_job_id);
              return { data: true, error: null };
            }
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
      setTimeout: (fn: () => void) => {
        fn();
        return 0;
      },
      fetch: async (
        url: string,
        options: { body: string; headers: Record<string, string> },
      ) => {
        deliveries.push({
          url,
          body: JSON.parse(options.body),
          headers: options.headers,
        });
        if (providerThrows) throw new Error("Private provider timeout detail");
        return new Response(JSON.stringify(providerReceipt), {
          status: providerStatus,
        });
      },
    },
  );
});

function request(
  body: unknown = { action: "dispatch", document_id: documentId },
  token = "valid-manager",
  extraHeaders: Record<string, string> = {},
) {
  return handler(
    new Request("https://backend.invalid/functions/v1/document-notify", {
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
  calls.filter((call) => call.name === "document_notification_finish");

describe("Document-sharing notification delivery", () => {
  test("only a verified document manager with current MFA permission can send", async () => {
    for (const token of ["", "forged", "server-only-key", "valid-patient"])
      expect([401, 403]).toContain((await request(undefined, token)).status);
    permission = false;
    expect((await request()).status).toBe(403);
    expect(deliveries).toEqual([]);
    expect(
      calls.some((call) => call.name === "document_notification_claim"),
    ).toBe(false);
  });

  test("rejects cross-origin, GET, unknown actions, oversized and client-authored recipients without claims", async () => {
    expect(
      (
        await request(undefined, "valid-manager", {
          Origin: "https://other.invalid",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await handler(
          new Request("https://backend.invalid/functions/v1/document-notify"),
        )
      ).status,
    ).toBe(405);
    for (const body of [
      { action: "dispatch", document_id: "../file" },
      {
        action: "dispatch",
        document_id: documentId,
        email: "attacker@example.invalid",
      },
      { action: "dispatch", document_id: documentId, title: "Injected title" },
      { action: "dispatch" },
      { action: "delete", document_id: documentId },
    ])
      expect((await request(body)).status).toBe(400);
    expect((await request({ action: "x".repeat(2100) })).status).toBe(413);
    expect(deliveries).toEqual([]);
    expect(
      calls.some((call) => call.name === "document_notification_claim"),
    ).toBe(false);
  });

  test("sends one warm notification with the actual title and a private-account link", async () => {
    const response = await request(undefined, "valid-manager", {
      Origin: "https://metimaia.com",
    });
    expect(response.status).toBe(200);
    const summary = await response.json();
    expect(summary).toMatchObject({
      accepted: 1,
      retrying: 0,
      processed: 1,
      status: { accepted: 1 },
    });
    expect(deliveries).toHaveLength(1);
    const message = deliveries[0];
    expect(message.url).toBe("https://api.resend.com/emails");
    expect(message.headers["Idempotency-Key"]).toBe(`document-share-${jobId}`);
    expect(message.body.to).toEqual(["patient@example.invalid"]);
    expect(message.body.reply_to).toBe("ostetricamaia@gmail.com");
    expect(message.body.from).toContain("noreply@metimaia.com");
    expect(message.body.text).toContain("«La borsa del parto»");
    expect(message.body.text).toContain("Con affetto");
    expect(message.body.text).toContain(
      "quando trovi il momento giusto per te",
    );
    expect(message.body.text).toContain("https://metimaia.com/miei-documenti");
    expect(message.body.html).toContain("Apri i miei documenti");
    for (const forbidden of ["attachments", "cc", "bcc", "tags"])
      expect(message.body[forbidden]).toBeUndefined();
    expect(JSON.stringify(message.body)).not.toContain("storage_path");
    expect(
      calls.find((call) => call.name === "can_manage_documents")?.scope,
    ).toBe("Bearer valid-manager");
    expect(finished()[0].args).toMatchObject({
      p_job_id: jobId,
      p_lease_token: lease,
      p_result: "accepted",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test("new recipients receive separate messages without disclosing the other recipient", async () => {
    jobs.push({
      ...jobs[0],
      job_id: "55555555-5555-4555-8555-555555555555",
      recipient_id: "66666666-6666-4666-8666-666666666666",
      recipient_email: "second@example.invalid",
    });
    expect((await request()).status).toBe(200);
    expect(deliveries).toHaveLength(2);
    expect(deliveries[0].body.to).toEqual(["patient@example.invalid"]);
    expect(deliveries[1].body.to).toEqual(["second@example.invalid"]);
    expect(JSON.stringify(deliveries[0].body)).not.toContain(
      "second@example.invalid",
    );
    expect(JSON.stringify(deliveries[1].body)).not.toContain(
      "patient@example.invalid",
    );
  });

  test("revoked, archived, unconfirmed or changed-email jobs never reach the provider", async () => {
    authorized = false;
    expect((await request()).status).toBe(200);
    expect(deliveries).toEqual([]);
    expect(finished()[0].args.p_result).toBe("cancelled");
    jobs = [
      {
        job_id: jobId,
        lease_token: lease,
        document_id: documentId,
        recipient_id: recipient,
        document_title: "Titolo",
        recipient_email: "patient@example.invalid",
        attempts: 1,
      },
    ];
    authorized = true;
    mutateFrozenPayload = true;
    expect((await request()).status).toBe(200);
    expect(deliveries).toEqual([]);
    expect(finished().at(-1)?.args.p_result).toBe("cancelled");
  });

  test("access-check failure is retryable and never bypasses authorization", async () => {
    accessFailure = true;
    const response = await request();
    expect(response.status).toBe(200);
    expect((await response.json()).retrying).toBe(1);
    expect(deliveries).toEqual([]);
    expect(finished()[0].args).toMatchObject({
      p_result: "retry",
      p_error_code: "access_check",
    });
  });

  test("escapes document titles in HTML and excludes header controls from title text", async () => {
    jobs[0].document_title =
      'Prima <script>alert("x")</script> & dopo\r\nX-Fake: yes';
    await request();
    const message = deliveries[0].body;
    expect(message.html).toContain("&lt;script&gt;");
    expect(message.html).toContain("&amp; dopo");
    expect(message.html).not.toContain("<script>");
    expect(message.subject).not.toContain("X-Fake");
    expect(message.text).not.toContain("\r\nX-Fake");
  });

  test("missing provider configuration leaves the queue unclaimed", async () => {
    delete configuration.RESEND_API_KEY;
    expect((await request()).status).toBe(503);
    expect(
      calls.some((call) => call.name === "document_notification_claim"),
    ).toBe(false);
    expect(deliveries).toEqual([]);
  });

  test("scheduled retry requires the exact private token, without an Origin or user JWT", async () => {
    expect(
      (
        await request({ action: "retry" }, "", {
          "X-Document-Notify-Token": "forged",
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await request({ action: "dispatch", document_id: documentId }, "", {
          "X-Document-Notify-Token": scheduledToken,
        })
      ).status,
    ).toBe(400);
    const response = await request({ action: "retry" }, "", {
      "X-Document-Notify-Token": scheduledToken,
    });
    expect(response.status).toBe(200);
    expect((await response.json()).accepted).toBe(1);
    expect(
      calls.find((call) => call.name === "document_notification_claim")?.args,
    ).toEqual({ p_document_id: null, p_limit: 10 });
    expect(calls.some((call) => call.name === "can_manage_documents")).toBe(
      false,
    );
  });

  test("provider ambiguity retries with the same key and byte-identical payload", async () => {
    providerThrows = true;
    expect((await request()).status).toBe(200);
    expect(finished()[0].args.p_result).toBe("uncertain");
    providerThrows = false;
    expect(
      (await request({ action: "retry", document_id: documentId })).status,
    ).toBe(200);
    expect(deliveries).toHaveLength(2);
    expect(deliveries[0]).toEqual(deliveries[1]);
    expect(finished()[1].args.p_result).toBe("accepted");
  });

  test("accepted receipt with lost database acknowledgment remains honest and reuses the provider key", async () => {
    finishFailure = true;
    const response = await request();
    const text = await response.text();
    expect(text).toContain("non sono ancora confermati");
    expect(text).not.toContain("Private write failure");
    finishFailure = false;
    await request({ action: "retry", document_id: documentId });
    expect(deliveries[0]).toEqual(deliveries[1]);
  });

  test("successful subsequent saves without new queue work do not send another email", async () => {
    await request();
    const response = await request();
    expect((await response.json()).processed).toBe(0);
    expect(deliveries).toHaveLength(1);
  });

  test("provider rejection or missing receipt is not reported as a delivered email", async () => {
    providerStatus = 429;
    let response = await request();
    expect(await response.json()).toMatchObject({ accepted: 0, retrying: 1 });
    expect(finished()[0].args).toMatchObject({
      p_result: "retry",
      p_error_code: "provider_429",
    });
    providerStatus = 200;
    providerReceipt = {};
    response = await request();
    expect(await response.json()).toMatchObject({ accepted: 0, retrying: 1 });
    expect(finished().at(-1)?.args).toMatchObject({
      p_result: "uncertain",
      p_error_code: "provider_receipt",
    });
  });
});
