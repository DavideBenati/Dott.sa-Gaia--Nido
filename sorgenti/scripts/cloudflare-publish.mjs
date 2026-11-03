// Official OAuth and version APIs only; no credentials or deployment at import.
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { lstat, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, posix } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";
export const TARGET = Object.freeze({
  name: "metimaia",
  account_id: "68583a5f0841226fd1f0b4adc17acb92",
  wrangler: "4.157.0",
});
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const object = (v) => v && typeof v === "object" && !Array.isArray(v);
const empty = (v) =>
  v === undefined || v === null || (object(v) && !Object.keys(v).length);
const noEntries = (v) => v === undefined || (Array.isArray(v) && !v.length);
export async function verifySite(directory) {
  const root = join(directory, "site"),
    info = await lstat(root);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw Error(
      "Cartella site non valida: estrai nuovamente tutto il pacchetto.",
    );
  const manifest = JSON.parse(
    await readFile(join(directory, "site-sha256.json"), "utf8"),
  );
  if (!object(manifest.files) || Object.keys(manifest.files).length !== 111)
    throw Error("Elenco dei 111 file non valido.");
  for (const [name, digest] of Object.entries(manifest.files))
    if (
      !name ||
      name.includes("\\") ||
      name.startsWith("/") ||
      posix.normalize(name) !== name ||
      name.split("/").includes("..") ||
      !/^[a-f0-9]{64}$/.test(digest)
    )
      throw Error("Percorso o impronta non valida.");
  const found = [];
  async function walk(folder, prefix = "") {
    for (const item of await readdir(folder, { withFileTypes: true })) {
      const name = prefix + item.name,
        path = join(folder, item.name),
        stat = await lstat(path);
      if (stat.isSymbolicLink())
        throw Error(
          "Collegamento simbolico nel sito: usa una nuova estrazione.",
        );
      if (stat.isDirectory()) await walk(path, name + "/");
      else if (stat.isFile()) {
        if (
          !Object.hasOwn(manifest.files, name) ||
          stat.size > 25 * 1024 * 1024
        )
          throw Error(`File inatteso: ${name}.`);
        if (
          createHash("sha256")
            .update(await readFile(path))
            .digest("hex") !== manifest.files[name]
        )
          throw Error(`File modificato o incompleto: ${name}.`);
        found.push(name);
      } else throw Error(`Tipo di file non valido: ${name}.`);
    }
  }
  await walk(root);
  if (
    found.length !== 111 ||
    !found.includes("index.html") ||
    !found.includes("_headers")
  )
    throw Error("Il sito è incompleto: servono tutti i 111 file.");
  return found.length;
}
export function currentDeployment(value) {
  if (
    !Array.isArray(value) ||
    !value.length ||
    value.some((d) => !object(d) || !Number.isFinite(Date.parse(d.created_on)))
  )
    throw Error("Pubblicazione attuale non verificabile.");
  const latest = [...value]
    .sort((a, b) => Date.parse(a.created_on) - Date.parse(b.created_on))
    .at(-1);
  if (
    !uuid.test(latest.id) ||
    !Array.isArray(latest.versions) ||
    latest.versions.length !== 1 ||
    !uuid.test(latest.versions[0].version_id) ||
    latest.versions[0].percentage !== 100
  )
    throw Error("La pubblicazione attuale non è una singola versione al 100%.");
  return {
    id: latest.id,
    created_on: latest.created_on,
    version_id: latest.versions[0].version_id,
  };
}
export function validateCurrentVersion(value, expected) {
  if (!object(value) || value.id !== expected || !object(value.resources))
    throw Error("Versione attuale non verificabile.");
  const { bindings, script, script_runtime: runtime } = value.resources;
  if (
    !Array.isArray(bindings) ||
    bindings.length ||
    !object(script) ||
    !Array.isArray(script.handlers) ||
    script.handlers.length !== 0 ||
    !noEntries(script.named_handlers)
  )
    throw Error(
      "Il Worker ha codice o collegamenti a risorse: questo pacchetto pubblica solo il sito statico. Operazione interrotta.",
    );
  if (
    !object(runtime) ||
    typeof runtime.compatibility_date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(runtime.compatibility_date) ||
    !Number.isFinite(Date.parse(runtime.compatibility_date))
  )
    throw Error("Configurazione runtime non riconosciuta.");
  const allowed = new Set([
    "compatibility_date",
    "compatibility_flags",
    "usage_model",
    "exports",
    "migration_tag",
    "limits",
    "containers",
  ]);
  if (
    Object.keys(runtime).some((k) => !allowed.has(k)) ||
    !empty(runtime.exports) ||
    !empty(runtime.limits) ||
    !noEntries(runtime.containers) ||
    (runtime.migration_tag !== undefined &&
      runtime.migration_tag !== null &&
      runtime.migration_tag !== "") ||
    (runtime.usage_model !== undefined && runtime.usage_model !== "standard")
  )
    throw Error(
      "Impostazioni runtime personalizzate: operazione interrotta per conservarle.",
    );
  const flags = runtime.compatibility_flags ?? [];
  if (
    !Array.isArray(flags) ||
    flags.some((f) => typeof f !== "string" || !/^[a-z][a-z0-9_]*$/.test(f))
  )
    throw Error("Flag runtime non riconosciuti.");
  return {
    compatibility_date: runtime.compatibility_date,
    compatibility_flags: flags,
  };
}
export function uploadedVersion(text, previous) {
  const events = text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((e) => e.type === "version-upload");
  if (
    events.length !== 1 ||
    events[0].worker_name !== TARGET.name ||
    !uuid.test(events[0].version_id) ||
    events[0].version_id === previous ||
    events[0].worker_name_overridden === true
  )
    throw Error(
      "Upload non confermato. Un conflitto con la configurazione esistente può averlo interrotto: nessuna nuova versione verrà attivata.",
    );
  return events[0].version_id;
}
export function findNpx(execPath = process.execPath) {
  const base = dirname(execPath),
    candidates = [
      join(base, "node_modules/npm/bin/npx-cli.js"),
      resolve(base, "../lib/node_modules/npm/bin/npx-cli.js"),
    ];
  try {
    candidates.push(realpathSync(join(base, "npx")));
  } catch {
    /* Standard Windows layout above. */
  }
  const found = candidates.find(
    (p) => p.endsWith("npx-cli.js") && existsSync(p),
  );
  if (!found)
    throw Error(
      "npm non trovato: installa Node.js LTS da nodejs.org e riapri questo file.",
    );
  return found;
}
export function officialCli(directory) {
  const npx = findNpx();
  return (args, options = {}) =>
    new Promise((accept, reject) => {
      const env = {
        ...process.env,
        WRANGLER_SEND_METRICS: "false",
        NO_COLOR: "1",
      };
      for (const key of [
        "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_ACCOUNT_ID",
        "CF_ACCOUNT_ID",
        "CLOUDFLARE_API_KEY",
        "CLOUDFLARE_EMAIL",
        "CF_API_TOKEN",
        "CF_API_KEY",
        "CF_EMAIL",
        "CLOUDFLARE_API_BASE_URL",
        "CF_API_BASE_URL",
        "WRANGLER_CI_MATCH_TAG",
        "WRANGLER_CI_OVERRIDE_NAME",
        "WRANGLER_OUTPUT_FILE_PATH",
        "WRANGLER_OUTPUT_FILE_DIRECTORY",
      ])
        delete env[key];
      if (options.interactive) delete env.CI;
      else env.CI = "true";
      if (options.outputFile)
        env.WRANGLER_OUTPUT_FILE_PATH = options.outputFile;
      const child = spawn(
        process.execPath,
        [
          npx,
          "--yes",
          `--package=wrangler@${TARGET.wrangler}`,
          "--",
          "wrangler",
          ...args,
        ],
        {
          cwd: directory,
          env,
          shell: false,
          detached: process.platform !== "win32",
          stdio: options.interactive ? "inherit" : ["ignore", "pipe", "pipe"],
        },
      );
      let stdout = "",
        stderr = "",
        timedOut = false;
      if (child.stdout)
        child.stdout.on("data", (part) => {
          stdout += part;
          if (stdout.length > 2000000) child.kill();
          if (options.progress) process.stdout.write(part);
        });
      if (child.stderr)
        child.stderr.on("data", (part) => {
          stderr += part;
          if (stderr.length > 2000000) child.kill();
          if (options.progress) process.stderr.write(part);
        });
      const timer = setTimeout(() => {
        timedOut = true;
        if (process.platform === "win32" && child.pid)
          spawnSync(
            join(
              process.env.SystemRoot || "C:\\Windows",
              "System32/taskkill.exe",
            ),
            ["/PID", String(child.pid), "/T", "/F"],
            { stdio: "ignore", shell: false },
          );
        else {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {
            child.kill();
          }
        }
      }, 300000);
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0 || timedOut)
          reject(
            Error(
              timedOut
                ? "Cloudflare non ha risposto entro cinque minuti."
                : `Wrangler si è fermato (codice ${code}). ${stderr.trim().slice(-2000)}`,
            ),
          );
        else accept({ stdout, stderr });
      });
    });
}
export async function publish({ directory, cli, confirm, log = console.log }) {
  let phase = "controllo file",
    previous,
    nextVersion;
  const configPath = join(directory, "cf-config.json"),
    receiptPath = join(directory, "maia-publicazione-risultato.json"),
    outputFile = join(directory, ".maia-upload.jsonl");
  const config = {
    name: TARGET.name,
    account_id: TARGET.account_id,
    send_metrics: false,
    assets: {
      directory: "./site",
      html_handling: "auto-trailing-slash",
      not_found_handling: "single-page-application",
    },
  };
  const record = async (status, extra = {}) =>
    writeFile(
      receiptPath,
      JSON.stringify(
        {
          status,
          worker: TARGET.name,
          previous_version_id: previous?.version_id ?? null,
          uploaded_version_id: nextVersion ?? null,
          checked_at: new Date().toISOString(),
          ...extra,
        },
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
  try {
    if (Number(process.versions.node.split(".")[0]) < 22)
      throw Error(
        "Serve Node.js 22 o successivo. Installa la versione LTS da nodejs.org.",
      );
    await verifySite(directory);
    for (const name of await readdir(directory)) {
      if (/^\.env(?:\.|$)/.test(name) || /^\.dev\.vars(?:\.|$)/.test(name))
        throw Error(
          "File di ambiente estranei: usa una cartella appena estratta.",
        );
      if (
        [
          "cf-config.json",
          ".maia-upload.jsonl",
          "maia-publicazione-risultato.json",
        ].includes(name) &&
        (await lstat(join(directory, name))).isSymbolicLink()
      )
        throw Error("File di lavoro non valido: usa una nuova estrazione.");
    }
    await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
    const common = ["--config", configPath];
    const getDeployment = async () =>
      currentDeployment(
        JSON.parse(
          (await cli(["deployments", "list", ...common, "--json"])).stdout,
        ),
      );
    log(
      "I 111 file sono integri. Completa l’accesso ufficiale Cloudflare nel browser.",
    );
    phase = "accesso Cloudflare";
    await cli(["login", ...common], { interactive: true });
    phase = "lettura della configurazione attuale";
    previous = await getDeployment();
    const version = JSON.parse(
      (
        await cli([
          "versions",
          "view",
          previous.version_id,
          ...common,
          "--json",
        ])
      ).stdout,
    );
    Object.assign(config, validateCurrentVersion(version, previous.version_id));
    await writeFile(configPath, JSON.stringify(config, null, 2) + "\n");
    log(
      "Destinazione: Worker metimaia. Sito completo v14.2; domini e route restano gestiti dalla configurazione Cloudflare esistente.",
    );
    log(
      "Configurazione asset prevista: HTML auto-trailing-slash e fallback single-page-application. I conflitti rilevati interrompono l’upload.",
    );
    if (
      (
        await confirm(
          "Scrivi PUBBLICA per caricare e attivare questo aggiornamento: ",
        )
      ).trim() !== "PUBBLICA"
    ) {
      log("Pubblicazione annullata prima dell’upload.");
      return { status: "cancelled" };
    }
    phase = "caricamento della nuova versione";
    await verifySite(directory);
    await rm(outputFile, { force: true });
    await cli(
      [
        "versions",
        "upload",
        ...common,
        "--strict",
        "--message",
        "metiMaia v14.2 - sito completo",
      ],
      { outputFile, progress: true },
    );
    nextVersion = uploadedVersion(
      await readFile(outputFile, "utf8"),
      previous.version_id,
    );
    await record("uploaded_not_activated");
    phase = "controllo prima dell’attivazione";
    if (JSON.stringify(await getDeployment()) !== JSON.stringify(previous))
      throw Error(
        "Nel frattempo è cambiata la pubblicazione online. La versione caricata non viene attivata.",
      );
    phase = "attivazione e verifica";
    let activationError;
    try {
      await cli(
        [
          "versions",
          "deploy",
          ...common,
          "--version-id",
          nextVersion,
          "--percentage",
          "100",
          "--yes",
          "--message",
          "metiMaia v14.2 - pubblicazione verificata",
        ],
        { progress: true },
      );
    } catch (error) {
      activationError = error;
    }
    let observed;
    try {
      observed = await getDeployment();
    } catch {
      await record("activation_unknown");
      throw Error(
        "Non possiamo verificare l’esito dell’attivazione. Controlla il Worker metimaia prima di riprovare; i riferimenti sono nel file maia-publicazione-risultato.json.",
      );
    }
    if (observed.version_id !== nextVersion) {
      await record("activation_not_confirmed", {
        observed_version_id: observed.version_id,
      });
      throw Error(
        `Al controllo finale la nuova versione non risulta attiva. Verifica il Worker prima di riprovare.${activationError ? " Wrangler ha segnalato un errore durante l’attivazione." : ""}`,
      );
    }
    await record("published_verified", {
      deployed_version_id: observed.version_id,
    });
    log(
      "Pubblicazione verificata: nuova versione attiva al 100%. Apri https://metimaia.com/videochiamate.",
    );
    return {
      status: "published",
      version_id: nextVersion,
      previous_version_id: previous.version_id,
    };
  } catch (error) {
    if (nextVersion && phase !== "attivazione e verifica")
      await record("uploaded_not_activated");
    throw Error(
      `Fase: ${phase}. ${error instanceof Error ? error.message : "Operazione non riuscita."}`,
      { cause: error },
    );
  }
}
async function main() {
  const directory = dirname(fileURLToPath(import.meta.url));
  await publish({
    directory,
    cli: officialCli(directory),
    confirm: async (message) => {
      // OAuth's child process owns stdin until its interactive login finishes.
      const input = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      try {
        return await input.question(message);
      } finally {
        input.close();
      }
    },
  });
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
