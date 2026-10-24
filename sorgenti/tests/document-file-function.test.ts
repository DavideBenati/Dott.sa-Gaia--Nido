import { beforeEach, describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
let handler: (request: Request) => Promise<Response>;
const documentId = "11111111-1111-4111-8111-111111111111";
const randomId = "22222222-2222-4222-8222-222222222222";
const originalPath = `${documentId}/${randomId}.pdf`;
const pdf = new Blob(["%PDF-1.4\nTest document only.\n"], {
  type: "application/pdf",
});
let granted: boolean,
  revokeDuringDownload: boolean,
  storageError: boolean,
  rpcError: boolean;
let rpcCalls: {
  name: string;
  args: Record<string, unknown>;
  authorization: string;
}[];
let storageCalls: { bucket: string; path: string }[];
let document: Record<string, unknown>;
let file: Blob;
let configuration: Record<string, string>;
beforeEach(async () => {
  granted = true;
  revokeDuringDownload = false;
  storageError = false;
  rpcError = false;
  rpcCalls = [];
  storageCalls = [];
  file = pdf;
  document = {
    id: documentId,
    storage_path: originalPath,
    file_name: "materiale-sessione.pdf",
    mime_type: "application/pdf",
    size_bytes: file.size,
    title: "Titolo privato di test",
  };
  configuration = {
    SUPABASE_URL: "https://backend.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "server-only-secret",
    SUPABASE_ANON_KEY: "public-key",
  };
  const source = (
    await readFile(
      new URL("../supabase/functions/document-file/index.ts", import.meta.url),
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
        if (key === "server-only-secret")
          return {
            auth: {
              getUser: async (token: string) => ({
                data: {
                  user:
                    token === "valid-recipient" || token === "valid-manager"
                      ? { id: "verified-current-user" }
                      : null,
                },
                error: null,
              }),
            },
            storage: {
              from: (bucket: string) => ({
                download: async (path: string) => {
                  storageCalls.push({ bucket, path });
                  if (revokeDuringDownload) granted = false;
                  return storageError
                    ? {
                        data: null,
                        error: { message: "Internal storage detail" },
                      }
                    : { data: file, error: null };
                },
              }),
            },
          };
        expect(key).toBe("public-key");
        return {
          rpc: async (name: string, args: Record<string, unknown>) => {
            rpcCalls.push({
              name,
              args,
              authorization: options?.global?.headers?.Authorization ?? "",
            });
            return {
              data: granted ? { ...document } : null,
              error: rpcError ? { message: "Internal RPC detail" } : null,
            };
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
      Blob,
      TextDecoder,
    },
  );
});
function request(
  body: unknown = { action: "download", document_id: documentId },
  token = "valid-recipient",
  origin: string | null = "https://metimaia.com",
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (origin) headers.Origin = origin;
  return handler(
    new Request("https://backend.invalid/functions/v1/document-file", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  );
}
describe("private document download proxy", () => {
  test("anonymous, forged and service-key tokens cannot read documents even without Origin", async () => {
    for (const token of ["", "forged-jwt", "server-only-secret"])
      expect((await request(undefined, token, null)).status).toBe(401);
    expect(rpcCalls).toHaveLength(0);
    expect(storageCalls).toHaveLength(0);
  });
  test("rejects cross-origin requests and GET without opening storage", async () => {
    expect(
      (await request(undefined, "valid-recipient", "https://other.invalid"))
        .status,
    ).toBe(403);
    expect(
      (
        await handler(
          new Request("https://backend.invalid/functions/v1/document-file"),
        )
      ).status,
    ).toBe(405);
    expect(storageCalls).toHaveLength(0);
  });
  test("private CORS preflight does not require or expose a token", async () => {
    const response = await handler(
      new Request("https://backend.invalid/functions/v1/document-file", {
        method: "OPTIONS",
        headers: { Origin: "https://metimaia.com" },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://metimaia.com",
    );
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
      "POST, OPTIONS",
    );
    expect(storageCalls).toHaveLength(0);
  });
  test("missing, unassigned, revoked or MFA-denied documents have identical non-disclosing responses", async () => {
    granted = false;
    const recipient = await request();
    const manager = await request(undefined, "valid-manager");
    expect(recipient.status).toBe(404);
    expect(await recipient.text()).toBe(await manager.text());
    expect(storageCalls).toHaveLength(0);
    expect(rpcCalls[0]).toEqual({
      name: "authorized_document_file",
      args: { p_document_id: documentId },
      authorization: "Bearer valid-recipient",
    });
  });
  test("authorized read-through returns binary file without cache or public capability", async () => {
    const response = await request({
      action: "download",
      document_id: documentId,
      storage_path: "attacker-path.pdf",
      user_id: "another-user",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Disposition")).toContain(
      'attachment; filename="materiale-sessione.pdf"',
    );
    expect(response.headers.get("Location")).toBeNull();
    expect(await response.arrayBuffer()).toEqual(await pdf.arrayBuffer());
    expect(storageCalls).toEqual([
      { bucket: "session-documents", path: originalPath },
    ]);
    expect(rpcCalls).toHaveLength(2);
    expect(
      rpcCalls.every((c) => c.authorization === "Bearer valid-recipient"),
    ).toBe(true);
  });
  test("revocation during storage retrieval prevents delivery of the response body", async () => {
    revokeDuringDownload = true;
    const response = await request();
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("%PDF");
    expect(rpcCalls).toHaveLength(2);
  });
  test("preserves Office binary data and safely encodes untrusted filenames", async () => {
    file = new Blob([new Uint8Array([80, 75, 3, 4, 0, 255, 128])]);
    document = {
      ...document,
      storage_path: `${documentId}/${randomId}.docx`,
      file_name: 'résumé\r\nX-Fake: yes".docx',
      mime_type:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size_bytes: file.size,
    };
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(document.mime_type);
    const disposition = response.headers.get("Content-Disposition")!;
    expect(disposition).not.toMatch(/[\r\n]/);
    expect(disposition).toContain("filename*=UTF-8''r%C3%A9sum%C3%A9");
    expect(response.headers.get("X-Fake")).toBeNull();
    expect(await response.arrayBuffer()).toEqual(await file.arrayBuffer());
  });
  test("invalid requests and excessive bodies are rejected without storage reads", async () => {
    expect(
      (await request({ action: "download", document_id: "../file" })).status,
    ).toBe(400);
    expect(
      (await request({ action: "delete", document_id: documentId })).status,
    ).toBe(400);
    expect((await request({ arbitrary: "x".repeat(2050) })).status).toBe(413);
    expect(storageCalls).toHaveLength(0);
  });
  test("unexpected storage paths and oversized metadata never reach Storage", async () => {
    document.storage_path = `../${randomId}.pdf`;
    expect((await request()).status).toBe(503);
    document.storage_path = originalPath;
    document.size_bytes = 20 * 1024 * 1024 + 1;
    expect((await request()).status).toBe(503);
    expect(storageCalls).toHaveLength(0);
  });
  test("server failures remain generic without private paths or error details", async () => {
    rpcError = true;
    const auth = await request();
    expect(auth.status).toBe(503);
    expect(await auth.text()).not.toContain("Internal RPC");
    expect(storageCalls).toHaveLength(0);
    rpcError = false;
    storageError = true;
    const response = await request();
    const text = await response.text();
    expect(response.status).toBe(503);
    expect(text).not.toContain("Internal storage");
    expect(text).not.toContain(originalPath);
    expect(text).not.toContain(document.title);
  });
  test("size mismatch and missing configuration fail closed", async () => {
    document.size_bytes = file.size + 1;
    expect((await request()).status).toBe(503);
    delete configuration.SUPABASE_ANON_KEY;
    expect((await request()).status).toBe(503);
  });
});
