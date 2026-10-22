import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const destination = process.argv[2];
if (!destination)
  throw new Error(
    "Specify a new output directory: node scripts/package-cloudflare.mjs /path/to/output",
  );
const output = resolve(destination);
const source = fileURLToPath(
  new URL("../apps/mobile/dist-web/", import.meta.url),
);
const html = await readFile(resolve(source, "index.html"), "utf8");
if (html.includes("/Dott.sa-Gaia--Nido/"))
  throw new Error(
    "Rebuild for the root domain: NIDO_WEB_BASE_PATH= npm run build:web",
  );
await mkdir(output); // Refuse to overwrite an existing deployment package.
await cp(source, output, { recursive: true });
await rm(resolve(output, "404.html"), { force: true });
await rm(resolve(output, ".nojekyll"), { force: true });
// Pages enables SPA fallback without 404.html. Workers Static Assets additionally
// needs physical HTML entry points for known direct URLs under its default handling.
for (const route of [
  "account",
  "welcome",
  "chat",
  "privacy",
  "help",
  "saved",
  "discover",
  "checklists",
  "profile",
])
  await writeFile(resolve(output, `${route}.html`), html);
await writeFile(
  resolve(output, "_headers"),
  "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n",
);
console.log(`Cloudflare assets ready: ${output}`);
