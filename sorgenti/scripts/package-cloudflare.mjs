import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { metadata, pageHTML, sitemap, site } from "./web-seo.mjs";
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
    pageHTML(html, `/${route}`),
  );
await writeFile(resolve(output, "index.html"), pageHTML(html, "/"));
await cp(
  fileURLToPath(
    new URL("../apps/mobile/assets/brand/maia-logo.png", import.meta.url),
  ),
  resolve(output, "social-preview.png"),
);
await writeFile(resolve(output, "sitemap.xml"), sitemap);
await writeFile(
  resolve(output, "robots.txt"),
  `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`,
);
await writeFile(
  resolve(output, "_headers"),
  "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n/newsletter*\n  Referrer-Policy: no-referrer\n" +
    Object.entries(metadata)
      .filter(([, page]) => !page.index)
      .map(([path]) => `${path}*\n  X-Robots-Tag: noindex, nofollow\n`)
      .join(""),
);
console.log(`Cloudflare assets ready: ${output}`);
