import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";

const template = new URL(
  "../supabase/templates/confirmation.html",
  import.meta.url,
);
test("signup confirmation remains the first action with the unchanged per-user Supabase placeholder", async () => {
  const html = await readFile(template, "utf8");
  expect(html.match(/\{\{\s*\.ConfirmationURL\s*\}\}/g)).toHaveLength(1);
  expect(html).toContain('href="{{ .ConfirmationURL }}"');
  expect(html.indexOf("{{ .ConfirmationURL }}")).toBeLessThan(
    html.indexOf('href="https://metimaia.com/installa"'),
  );
  expect(html).not.toMatch(/<script|<form|<iframe/i);
});
test("install and QR URLs are public, with a readable link when remote images are blocked", async () => {
  const html = await readFile(template, "utf8");
  expect(html).toContain(
    'src="https://raw.githubusercontent.com/DavideBenati/Dott.sa-Gaia--Nido/refs/heads/cloudflare-package/QR-App-MAIA.png"',
  );
  expect(html).toContain(
    'alt="QR code per aprire le istruzioni di installazione di MAIA"',
  );
  expect(html).toMatch(/>\s*https:\/\/metimaia\.com\/installa\s*<\/a\s*>/);
  expect(html).not.toMatch(/\{\{\s*\.(Email|Token|TokenHash|Data)/);
  expect(html).not.toMatch(/utm_|access_token|refresh_token|data:image/);
});
test("local Supabase points to this confirmation template and the packaged subject", async () => {
  const config = await readFile(
    new URL("../supabase/config.toml", import.meta.url),
    "utf8",
  );
  const subject = (
    await readFile(
      new URL("../../release-email-qr/OGGETTO.txt", import.meta.url),
      "utf8",
    )
  ).trim();
  expect(config).toContain("[auth.email.template.confirmation]");
  expect(config).toContain(
    'content_path = "./supabase/templates/confirmation.html"',
  );
  expect(config).toContain(`subject = "${subject}"`);
});
