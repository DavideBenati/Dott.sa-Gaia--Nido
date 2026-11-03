import { afterEach, expect, test } from "vitest";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import {
  TARGET,
  currentDeployment,
  publish,
  uploadedVersion,
  validateCurrentVersion,
  verifySite,
} from "../scripts/cloudflare-publish.mjs";

const oldVersion = "11111111-1111-4111-8111-111111111111";
const newVersion = "22222222-2222-4222-8222-222222222222";
const oldDeployment = "33333333-3333-4333-8333-333333333333";
const newDeployment = "44444444-4444-4444-8444-444444444444";
const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "maia-publish-"));
  temporary.push(directory);
  await mkdir(join(directory, "site"));
  const files: Record<string, string> = {};
  for (const name of [
    "index.html",
    "_headers",
    ...Array.from({ length: 109 }, (_, i) => `file-${i}.txt`),
  ]) {
    const content = `simulated ${name}`;
    await writeFile(join(directory, "site", name), content);
    files[name] = createHash("sha256").update(content).digest("hex");
  }
  await writeFile(
    join(directory, "site-sha256.json"),
    JSON.stringify({ files }),
  );
  return { directory, files };
}
const version = () => ({
  id: oldVersion,
  resources: {
    bindings: [],
    script: { handlers: [], named_handlers: [] },
    script_runtime: {
      compatibility_date: "2026-10-01",
      compatibility_flags: ["nodejs_compat"],
      usage_model: "standard",
    },
  },
});
function deployment(active = false, changed = false) {
  return [
    {
      id: active || changed ? newDeployment : oldDeployment,
      created_on:
        active || changed ? "2026-11-03T12:00:00Z" : "2026-11-02T12:00:00Z",
      versions: [
        { version_id: active ? newVersion : oldVersion, percentage: 100 },
      ],
    },
  ];
}
function simulatedCLI({
  strictNull = false,
  concurrent = false,
  receiptLost = false,
  verificationLost = false,
  remainsOld = false,
  resources = version(),
} = {}) {
  const calls: string[][] = [];
  let uploaded = false;
  let activated = false;
  const cli = async (args: string[], options: { outputFile?: string } = {}) => {
    calls.push(args);
    const command = args.slice(0, 2).join(" ");
    if (args[0] === "login") return { stdout: "", stderr: "" };
    if (command === "deployments list") {
      if (activated && verificationLost)
        throw Error("network lost on verification");
      return {
        stdout: JSON.stringify(
          deployment(activated && !remainsOld, uploaded && concurrent),
        ),
        stderr: "",
      };
    }
    if (command === "versions view")
      return { stdout: JSON.stringify(resources), stderr: "" };
    if (command === "versions upload") {
      uploaded = true;
      await writeFile(
        options.outputFile!,
        JSON.stringify({
          type: "version-upload",
          worker_name: TARGET.name,
          version_id: strictNull ? null : newVersion,
        }) + "\n",
      );
      return { stdout: "official upload mock", stderr: "" };
    }
    if (command === "versions deploy") {
      activated = true;
      if (receiptLost) throw Error("provider accepted but response lost");
      return { stdout: "deployment response mock", stderr: "" };
    }
    throw Error(`Unexpected command ${command}`);
  };
  return { cli, calls };
}
const silent = () => {};

test("hash verification rejects missing, extra, changed, traversal and symbolic files before authentication", async () => {
  for (const mode of [
    "missing",
    "extra",
    "changed",
    "traversal",
    "symlink",
  ] as const) {
    const { directory, files } = await fixture();
    if (mode === "missing") await rm(join(directory, "site", "file-0.txt"));
    if (mode === "extra")
      await writeFile(join(directory, "site", "unexpected.txt"), "extra");
    if (mode === "changed")
      await writeFile(join(directory, "site", "index.html"), "changed");
    if (mode === "traversal") {
      files["../outside.txt"] = files["file-0.txt"];
      delete files["file-0.txt"];
      await writeFile(
        join(directory, "site-sha256.json"),
        JSON.stringify({ files }),
      );
    }
    if (mode === "symlink") {
      await rm(join(directory, "site", "file-0.txt"));
      await symlink(
        join(directory, "site", "file-1.txt"),
        join(directory, "site", "file-0.txt"),
      );
    }
    const { cli, calls } = simulatedCLI();
    await expect(
      publish({ directory, cli, confirm: async () => "PUBBLICA", log: silent }),
    ).rejects.toThrow();
    expect(calls).toEqual([]);
  }
});

test("current deployment selection rejects split traffic and chooses newest chronologically", () => {
  const old = deployment()[0];
  const recent = deployment(true)[0];
  expect(currentDeployment([recent, old]).version_id).toBe(newVersion);
  expect(() =>
    currentDeployment([
      {
        ...old,
        versions: [...old.versions, { version_id: newVersion, percentage: 0 }],
      },
    ]),
  ).toThrow();
  expect(() =>
    currentDeployment([
      { ...old, versions: [{ version_id: oldVersion, percentage: 99 }] },
    ]),
  ).toThrow();
});

test("all bindings, handlers and runtime overrides stop before a publication request", async () => {
  for (const resource of [
    {
      ...version(),
      resources: {
        ...version().resources,
        bindings: [{ type: "plain_text", name: "EXISTING" }],
      },
    },
    {
      ...version(),
      resources: { ...version().resources, script: { handlers: ["fetch"] } },
    },
    {
      ...version(),
      resources: { ...version().resources, script: {} },
    },
    {
      ...version(),
      resources: {
        ...version().resources,
        script_runtime: {
          ...version().resources.script_runtime,
          limits: { cpu_ms: 5000 },
        },
      },
    },
  ]) {
    expect(() => validateCurrentVersion(resource, oldVersion)).toThrow();
    const { directory } = await fixture();
    const { cli, calls } = simulatedCLI({
      resources: resource as ReturnType<typeof version>,
    });
    await expect(
      publish({ directory, cli, confirm: async () => "PUBBLICA", log: silent }),
    ).rejects.toThrow();
    expect(
      calls.some((args) => args[1] === "upload" || args[1] === "deploy"),
    ).toBe(false);
  }
});

test("explicit typed confirmation is required before uploading", async () => {
  const { directory } = await fixture();
  const { cli, calls } = simulatedCLI();
  expect(await verifySite(directory)).toBe(111);
  expect(
    await publish({ directory, cli, confirm: async () => "no", log: silent }),
  ).toEqual({ status: "cancelled" });
  expect(calls.some((args) => args[1] === "upload")).toBe(false);
});

test("successful publication keeps runtime date/flags, stages strict upload and verifies activation", async () => {
  const { directory } = await fixture();
  const { cli, calls } = simulatedCLI();
  expect(
    await publish({
      directory,
      cli,
      confirm: async () => "PUBBLICA",
      log: silent,
    }),
  ).toEqual({
    status: "published",
    version_id: newVersion,
    previous_version_id: oldVersion,
  });
  const config = JSON.parse(
    await readFile(join(directory, "cf-config.json"), "utf8"),
  );
  expect(config).toMatchObject({
    name: TARGET.name,
    account_id: TARGET.account_id,
    compatibility_date: "2026-10-01",
    compatibility_flags: ["nodejs_compat"],
    assets: { directory: "./site" },
  });
  for (const key of [
    "routes",
    "route",
    "workers_dev",
    "triggers",
    "logpush",
    "observability",
    "tail_consumers",
  ])
    expect(config).not.toHaveProperty(key);
  expect(calls.find((args) => args[1] === "upload")).toContain("--strict");
  expect(calls.find((args) => args[1] === "deploy")).toEqual(
    expect.arrayContaining(["--version-id", newVersion, "--percentage", "100"]),
  );
  expect(calls.filter((args) => args[0] === "deployments")).toHaveLength(3);
  expect(
    JSON.parse(
      await readFile(
        join(directory, "maia-publicazione-risultato.json"),
        "utf8",
      ),
    ),
  ).toMatchObject({
    status: "published_verified",
    previous_version_id: oldVersion,
    uploaded_version_id: newVersion,
  });
});

test("strict abort with exit zero and null version never activates", async () => {
  const { directory } = await fixture();
  const { cli, calls } = simulatedCLI({ strictNull: true });
  await expect(
    publish({ directory, cli, confirm: async () => "PUBBLICA", log: silent }),
  ).rejects.toThrow(/Upload non confermato/);
  expect(calls.some((args) => args[1] === "deploy")).toBe(false);
  for (const text of [
    JSON.stringify({
      type: "version-upload",
      worker_name: "other",
      version_id: newVersion,
    }),
    JSON.stringify({
      type: "version-upload",
      worker_name: TARGET.name,
      version_id: oldVersion,
    }),
  ])
    expect(() => uploadedVersion(text, oldVersion)).toThrow();
});

test("another publication between upload and activation stops without overwriting it", async () => {
  const { directory } = await fixture();
  const { cli, calls } = simulatedCLI({ concurrent: true });
  await expect(
    publish({ directory, cli, confirm: async () => "PUBBLICA", log: silent }),
  ).rejects.toThrow(/cambiata la pubblicazione/);
  expect(calls.some((args) => args[1] === "deploy")).toBe(false);
  expect(
    JSON.parse(
      await readFile(
        join(directory, "maia-publicazione-risultato.json"),
        "utf8",
      ),
    ),
  ).toMatchObject({
    status: "uploaded_not_activated",
    previous_version_id: oldVersion,
    uploaded_version_id: newVersion,
  });
});

test("a lost activation receipt is resolved from fresh production state", async () => {
  const { directory } = await fixture();
  const { cli } = simulatedCLI({ receiptLost: true });
  expect(
    (
      await publish({
        directory,
        cli,
        confirm: async () => "PUBBLICA",
        log: silent,
      })
    ).status,
  ).toBe("published");
});

test("unverifiable activation never reports success or claims the old site is unchanged", async () => {
  for (const options of [
    { verificationLost: true },
    { remainsOld: true, receiptLost: true },
  ]) {
    const { directory } = await fixture();
    const { cli } = simulatedCLI(options);
    const messages: string[] = [];
    await expect(
      publish({
        directory,
        cli,
        confirm: async () => "PUBBLICA",
        log: (text: string) => messages.push(text),
      }),
    ).rejects.toThrow(/verificare|non risulta attiva/);
    const receipt = JSON.parse(
      await readFile(
        join(directory, "maia-publicazione-risultato.json"),
        "utf8",
      ),
    );
    expect(receipt.status).toBe(
      options.verificationLost
        ? "activation_unknown"
        : "activation_not_confirmed",
    );
    expect(
      messages.some((text) => text.includes("Pubblicazione verificata")),
    ).toBe(false);
  }
});
