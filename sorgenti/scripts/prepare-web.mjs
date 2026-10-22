import { copyFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const output = fileURLToPath(
  new URL("../apps/mobile/dist-web/", import.meta.url),
);
await access(`${output}/index.html`);
await copyFile(`${output}/index.html`, `${output}/404.html`);
await writeFile(`${output}/.nojekyll`, "");
await writeFile(`${output}/robots.txt`, "User-agent: *\nDisallow: /\n");
console.log(
  "Demo web pronta: apps/mobile/dist-web (con fallback per le rotte).",
);
