import { readFile } from "node:fs/promises";
import { publicProfessionalText } from "../packages/core/src/public-name.ts";
export const metadata = JSON.parse(
  await readFile(
    new URL("../apps/mobile/src/page-metadata.json", import.meta.url),
    "utf8",
  ),
);
export const site = "https://metimaia.com";
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
export function pageHTML(html, path) {
  const source = metadata[path] ?? {
    title: "metiMaia",
    description: "Uno spazio per il tuo percorso.",
    index: false,
  };
  const page = {
    ...source,
    title: publicProfessionalText(source.title),
    description: publicProfessionalText(source.description),
  };
  const canonical = site + (page.canonical ?? path);
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": site + "/#website",
        url: site,
        name: "metiMaia",
        inLanguage: "it-IT",
        publisher: { "@id": site + "/#gaia" },
      },
      {
        "@type": "Person",
        "@id": site + "/#gaia",
        name: "Dott.sa Gaia",
        jobTitle: "Ostetrica",
        email: "ostetricamaia@gmail.com",
        url: site + "/welcome",
      },
    ],
  };
  const head = `<title>${escape(page.title)}</title><meta name="description" content="${escape(page.description)}"><meta name="robots" content="${page.index ? "index,follow" : "noindex,nofollow"}"><link rel="canonical" href="${escape(canonical)}"><meta property="og:type" content="website"><meta property="og:locale" content="it_IT"><meta property="og:site_name" content="metiMaia"><meta property="og:title" content="${escape(page.title)}"><meta property="og:description" content="${escape(page.description)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:image" content="${site}/social-preview.png"><meta property="og:image:alt" content="Logo metiMaia"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escape(page.title)}"><meta name="twitter:description" content="${escape(page.description)}"><meta name="twitter:image" content="${site}/social-preview.png"><script type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script>`;
  let output = html
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(
      /<meta\b[^>]*(?:name=["'](?:description|robots|twitter:[^"']*)["']|property=["']og:[^"']*["'])[^>]*>/gi,
      "",
    )
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, "");
  output = output
    .replace(/<html\b[^>]*>/i, '<html lang="it">')
    .replace(/<\/head>/i, head + "</head>");
  if (page.index && !["/article", "/checklist"].includes(path))
    output = output.replace(
      /<\/body>/i,
      `<noscript><main><h1>${escape(page.title)}</h1><p>${escape(page.description)}</p><p>Attiva JavaScript per utilizzare ricerca e funzioni interattive.</p><nav><a href="/welcome">metiMaia</a> · <a href="/discover">Letture</a> · <a href="/checklists">Checklist</a> · <a href="/prenota">Richiedi un incontro via email</a> · <a href="/privacy">Privacy</a></nav></main></noscript></body>`,
    );
  return output;
}
export const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.entries(
  metadata,
)
  .filter(
    ([path, page]) =>
      page.index && !["/", "/article", "/checklist"].includes(path),
  )
  .map(([path]) => `<url><loc>${site}${path}</loc></url>`)
  .join("")}</urlset>\n`;
