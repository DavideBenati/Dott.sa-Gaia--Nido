import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { metadata, pageHTML, sitemap, site } from "./web-seo.mjs";
import { pwaHTML, pwaAssets, pwaHeaders } from "./web-pwa.mjs";
import { cloudflareHeaders } from "./cloudflare-headers.mjs";
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
const appHTML = pwaHTML(html);
await mkdir(output); // Refuse to overwrite an existing deployment package.
await cp(source, output, { recursive: true });
await rm(resolve(output, "404.html"), { force: true });
await rm(resolve(output, ".nojekyll"), { force: true });
// Pages enables SPA fallback without 404.html. Workers Static Assets additionally
// needs physical HTML entry points for known direct URLs under its default handling.
for (const route of [
  "iscritti",
  "traguardi",
  "condivisioni",
  "videochiamate",
  "documenti-studio",
  "miei-documenti",
  "documenti",
  "installa",
  "contatti",
  "verifiche",
  "newsletter-admin",
  "gaia",
  "impostazioni",
  "messaggi",
  "richieste",
  "sicurezza",
  "prenota",
  "account",
  "studio",
  "shop",
  "article",
  "checklist",
  "newsletter",
  "welcome",
  "chat",
  "privacy",
  "help",
  "saved",
  "discover",
  "checklists",
  "profile",
])
  await writeFile(
    resolve(output, `${route}.html`),
    pageHTML(appHTML, `/${route}`),
  );
await writeFile(resolve(output, "index.html"), pageHTML(appHTML, "/"));
for (const [path, content] of Object.entries(pwaAssets(html)))
  await writeFile(resolve(output, path), content);
await cp(
  fileURLToPath(new URL("../assets/pwa/", import.meta.url)),
  resolve(output, "icons"),
  { recursive: true },
);
await cp(
  fileURLToPath(
    new URL("../apps/mobile/assets/brand/maia-logo.png", import.meta.url),
  ),
  resolve(output, "social-preview.png"),
);
await cp(
  fileURLToPath(
    new URL("../apps/mobile/assets/brand/maia-app-qr.png", import.meta.url),
  ),
  resolve(output, "maia-app-qr.png"),
);
await writeFile(resolve(output, "sitemap.xml"), sitemap);
await writeFile(
  resolve(output, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`,
);
await writeFile(
  resolve(output, "_headers"),
  cloudflareHeaders(metadata, pwaHeaders),
);
console.log(`Cloudflare assets ready: ${output}`);
