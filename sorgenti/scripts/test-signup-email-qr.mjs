// Browser rendering only: no signup, confirmation request or real email send.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
const output = resolve(
  process.env.MAIA_EMAIL_QR_ARTIFACTS ??
    "/workspace/shared/downloads/maia-email-qr-checks",
);
await mkdir(output, { recursive: true });
const template = await readFile(
  new URL("../supabase/templates/confirmation.html", import.meta.url),
  "utf8",
);
const image = await readFile(
  new URL("../apps/mobile/assets/brand/maia-app-qr.png", import.meta.url),
);
const confirmation =
  "https://confirmation.example.invalid/verify?test=not-a-real-token";
const html = template.replace("{{ .ConfirmationURL }}", confirmation);
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const checks = [],
  unexpected = [],
  errors = [];
try {
  for (const [width, images] of [
    [320, true],
    [390, true],
    [1280, true],
    [390, false],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    try {
      await context.route("**/*", async (route) => {
        if (route.request().url() === "https://metimaia.com/maia-app-qr.png") {
          if (images)
            return route.fulfill({
              status: 200,
              contentType: "image/png",
              body: image,
            });
          return route.abort("blockedbyclient");
        }
        unexpected.push(route.request().url());
        return route.abort("blockedbyclient");
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setContent(html, { waitUntil: "load" });
      const confirm = page.getByRole("link", {
        name: "Conferma il mio account",
        exact: true,
      });
      const install = page.getByRole("link", {
        name: "Installa MAIA sul telefono",
        exact: true,
      });
      const readable = page.getByRole("link", {
        name: "https://metimaia.com/installa",
        exact: true,
      });
      await expect(confirm).toHaveAttribute("href", confirmation);
      await expect(install).toHaveAttribute(
        "href",
        "https://metimaia.com/installa",
      );
      await expect(readable).toHaveAttribute(
        "href",
        "https://metimaia.com/installa",
      );
      await expect(confirm).toBeVisible();
      await expect(install).toBeVisible();
      expect((await confirm.boundingBox()).y).toBeLessThan(
        (await install.boundingBox()).y,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
      ).toBe(true);
      const qr = page.getByRole("img", {
        name: "QR code per aprire le istruzioni di installazione di MAIA",
        exact: true,
      });
      if (images) {
        await expect
          .poll(() => qr.evaluate((node) => node.naturalWidth))
          .toBeGreaterThan(0);
        const bounds = await qr.boundingBox();
        expect(Math.abs(bounds.width - bounds.height)).toBeLessThanOrEqual(1);
      }
      await page.screenshot({
        path: resolve(
          output,
          `email-${width}-${images ? "images" : "blocked"}.png`,
        ),
        fullPage: true,
      });
      checks.push({
        width,
        images,
        confirmation_first: true,
        public_install_link: true,
        no_horizontal_overflow: true,
      });
    } finally {
      await context.close();
    }
  }
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
  await writeFile(
    resolve(output, "results.json"),
    JSON.stringify(
      { checks, errors, unexpected, actual_emails_sent: 0 },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      checks: checks.length,
      errors,
      unexpected,
      actual_emails_sent: 0,
    }),
  );
} finally {
  await browser.close();
}
