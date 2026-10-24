// Regression checks for stage changes in the static production build.
// Every Supabase request is intercepted. This script never sends an account,
// booking, newsletter, message or payment request to a real service.
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const root = resolve(process.argv[2] ?? "apps/mobile/dist-web");
const origin = "http://127.0.0.1:8096";
const artifacts = process.env.MAIA_STAGE_ARTIFACTS
  ? resolve(process.env.MAIA_STAGE_ARTIFACTS)
  : null;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};
const server = createServer(async (request, response) => {
  try {
    let file = resolve(
      root,
      "." + decodeURIComponent(new URL(request.url, origin).pathname),
    );
    if (file !== root && !file.startsWith(root + "/")) {
      response.writeHead(403).end();
      return;
    }
    if (file === root) file += "/index.html";
    try {
      if (!(await stat(file)).isFile()) throw new Error("Not a file");
    } catch {
      file += ".html";
    }
    response.setHeader(
      "Content-Type",
      types[extname(file)] ?? "application/octet-stream",
    );
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((ready) => server.listen(8096, "127.0.0.1", ready));
if (artifacts) await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const results = [];
const forbidden = [];
let currentPage;
let currentViewport;

async function geometry(locator) {
  return locator.evaluate((element) => {
    let scroll = element.parentElement;
    while (scroll) {
      if (
        ["auto", "scroll"].includes(window.getComputedStyle(scroll).overflowY)
      )
        break;
      scroll = scroll.parentElement;
    }
    const rect = element.getBoundingClientRect();
    const scrollRect = scroll?.getBoundingClientRect();
    return {
      target: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      zone: {
        top: Math.max(0, scrollRect?.top ?? 0),
        bottom: Math.min(
          window.innerHeight,
          scrollRect?.bottom ?? window.innerHeight,
        ),
      },
      scrollTop: scroll?.scrollTop ?? null,
      focused: document.activeElement === element,
    };
  });
}
async function inScrollViewport(locator, name) {
  await expect(locator, `${name}: rendered`).toBeVisible();
  await expect
    .poll(
      async () => {
        const measured = await geometry(locator);
        return (
          measured.target.y >= measured.zone.top - 2 &&
          measured.target.y + measured.target.height <= measured.zone.bottom + 2
        );
      },
      { message: `${name}: fully inside the visible scroll area` },
    )
    .toBe(true);
  return geometry(locator);
}
async function focusedStage(page, id) {
  const heading = page.locator(`#${id}`);
  await expect(heading, `${id}: keyboard focus`).toBeFocused();
  const measured = await inScrollViewport(heading, id);
  results.push({ viewport: currentViewport, stage: id, geometry: measured });
  return heading;
}
async function focusedBookingStage(page, id) {
  const heading = await focusedStage(page, id);
  await expect
    .poll(
      async () => {
        const measured = await geometry(heading);
        return measured.target.y - measured.zone.top;
      },
      { message: `${id}: heading starts near the top of its scroll viewport` },
    )
    .toBeGreaterThanOrEqual(12);
  await expect
    .poll(
      async () => {
        const measured = await geometry(heading);
        return measured.target.y - measured.zone.top;
      },
      { message: `${id}: heading is aligned close to the 16px top inset` },
    )
    .toBeLessThanOrEqual(24);
  const measured = await geometry(heading);
  results.push({
    viewport: currentViewport,
    alignedBookingStage: id,
    topInset: measured.target.y - measured.zone.top,
    geometry: measured,
  });
  return heading;
}
async function sameScroll(before, locator, name) {
  expect(
    before.scrollTop,
    `${name}: a real scroll container exists`,
  ).not.toBeNull();
  // Allow React effects and the scheduled frame to run before checking that a
  // same-stage state update has not moved back to its heading.
  await locator.page().waitForTimeout(200);
  const after = await geometry(locator);
  expect(
    after.scrollTop,
    `${name}: same scroll container after editing`,
  ).not.toBeNull();
  expect(
    Math.abs(after.scrollTop - before.scrollTop),
    `${name}: same-stage edit does not reset the scroll position`,
  ).toBeLessThanOrEqual(2);
}
async function screenshot(page, name) {
  if (artifacts)
    await page.screenshot({ path: resolve(artifacts, name + ".png") });
}

try {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    currentViewport = viewport;
    const context = await browser.newContext({
      viewport,
      serviceWorkers: "block",
    });
    const pageErrors = [];
    await context.route("**/*", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === origin) {
        await route.continue();
        return;
      }
      if (url.hostname.endsWith(".supabase.co")) {
        const cors = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
        };
        if (request.method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers: cors });
          return;
        }
        if (
          !["GET", "HEAD"].includes(request.method()) ||
          url.pathname.includes("/functions/v1/")
        ) {
          forbidden.push({ method: request.method(), path: url.pathname });
          await route.abort("blockedbyclient");
          return;
        }
        let body = [];
        if (
          url.pathname.includes("user_preferences") ||
          url.pathname.includes("notification_preferences") ||
          url.pathname.endsWith("/site_profile")
        )
          body = null;
        if (url.pathname.includes("care_chat_available")) body = false;
        await route.fulfill({
          status: 200,
          headers: cors,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
        return;
      }
      forbidden.push({
        method: request.method(),
        origin: url.origin,
        path: url.pathname,
      });
      await route.abort("blockedbyclient");
    });
    currentPage = await context.newPage();
    const page = currentPage;
    page.on("pageerror", (error) => pageErrors.push(error.message));

    // The actual stage transition must reset scroll/focus, not each keystroke.
    await page.goto(origin + "/prenota");
    const name = page.getByLabel("Nome per la richiesta", { exact: true });
    const email = page.getByLabel("Email di ricontatto", { exact: true });
    await expect(name).toBeEditable();
    await page
      .getByRole("button", { name: "Rivedi la richiesta", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Inserisci il tuo nome",
    );
    await expect(page.locator("#booking-review-heading")).toHaveCount(0);
    await name.fill("Test locale");
    await expect(name).toBeFocused();
    const typingScroll = await geometry(name);
    await name.pressSequentially(" conservato");
    await expect(name).toHaveValue("Test locale conservato");
    await expect(name).toBeFocused();
    await sameScroll(typingScroll, name, "Booking name typing");
    await email.fill("stage-test@example.invalid");
    await expect(email).toBeFocused();

    const morning = page.getByRole("button", { name: "Mattina", exact: true });
    await morning.scrollIntoViewIfNeeded();
    const morningScroll = await geometry(morning);
    await morning.click();
    const selectedMorning = page.getByRole("button", {
      name: "✓ Mattina",
      exact: true,
    });
    await expect(selectedMorning).toBeVisible();
    await sameScroll(
      morningScroll,
      selectedMorning,
      "Booking same-stage time preference",
    );

    const date = page.getByLabel("Data preferita", { exact: true });
    await date.fill("2027-02-30");
    await page
      .getByRole("button", { name: "Rivedi la richiesta", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "Indica una data valida",
    );
    await expect(page.locator("#booking-review-heading")).toHaveCount(0);
    await date.fill("");
    await page
      .getByRole("button", { name: "Rivedi la richiesta", exact: true })
      .click();
    const reviewHeading = await focusedBookingStage(
      page,
      "booking-review-heading",
    );
    const reviewGeometry = await geometry(reviewHeading);
    const send = page.getByRole("button", {
      name: "Apri l’email per inviare",
      exact: true,
    });
    const initialSend = await geometry(send);
    expect(
      initialSend.target.y,
      "Send follows the complete review, not a hidden earlier scroll position",
    ).toBeGreaterThanOrEqual(
      reviewGeometry.target.y + reviewGeometry.target.height,
    );
    expect(
      initialSend.target.y,
      "Send must not initially be above the visible scroll area",
    ).toBeGreaterThanOrEqual(initialSend.zone.top - 2);
    await screenshot(
      page,
      `booking-review-start-${viewport.width}x${viewport.height}`,
    );
    // A complete review can exceed a short viewport. It must open at its
    // heading; the send control may be below, reachable by forward scrolling.
    await send.scrollIntoViewIfNeeded();
    const sendGeometry = await inScrollViewport(
      send,
      "Booking primary send action after forward scroll",
    );
    await expect(send).toBeEnabled();
    results.push({
      viewport,
      action: "booking-email",
      initiallyVisible:
        initialSend.target.y + initialSend.target.height <=
        initialSend.zone.bottom + 2,
      initialGeometry: initialSend,
      reachableGeometry: sendGeometry,
    });
    await screenshot(
      page,
      `booking-review-send-${viewport.width}x${viewport.height}`,
    );
    // The email action opens a draft in the user’s mail app; this focus test never invokes it.
    await page
      .getByRole("button", { name: "Modifica richiesta", exact: true })
      .click();
    await focusedBookingStage(page, "booking-form-heading");
    await expect(name).toHaveValue("Test locale conservato");
    await expect(email).toHaveValue("stage-test@example.invalid");
    await expect(
      page.getByRole("button", { name: "✓ Mattina", exact: true }),
    ).toHaveCount(1);
    await screenshot(
      page,
      `booking-form-return-${viewport.width}x${viewport.height}`,
    );

    await page.goto(origin + "/welcome");
    await page
      .getByRole("button", { name: "Iniziamo insieme", exact: true })
      .click();
    await focusedStage(page, "welcome-step-1");
    const postpartum = page.getByRole("radio", {
      name: "Sono già genitore",
      exact: true,
    });
    await postpartum.scrollIntoViewIfNeeded();
    const choiceScroll = await geometry(postpartum);
    await postpartum.click();
    await expect(postpartum).toHaveAttribute("aria-checked", "true");
    await sameScroll(choiceScroll, postpartum, "Welcome journey choice");
    await page.getByRole("button", { name: "Continua", exact: true }).click();
    await focusedStage(page, "welcome-step-2");
    const personalized = page.getByRole("switch", {
      name: "Desidero un percorso personalizzato",
      exact: true,
    });
    if ((await personalized.getAttribute("aria-checked")) !== "true")
      await personalized.click();
    const healthConsent = page.getByRole("checkbox", {
      name: "Acconsento al salvataggio della data facoltativa",
      exact: true,
    });
    if ((await healthConsent.getAttribute("aria-checked")) !== "true")
      await healthConsent.click();
    const birthDate = page.getByLabel("Data di nascita facoltativa", {
      exact: true,
    });
    await birthDate.fill("2026-");
    await expect(birthDate).toBeFocused();
    const dateScroll = await geometry(birthDate);
    await birthDate.pressSequentially("01-20");
    await expect(birthDate).toHaveValue("2026-01-20");
    await expect(birthDate).toBeFocused();
    await sameScroll(dateScroll, birthDate, "Welcome same-stage date typing");
    await page.getByRole("button", { name: "Continua", exact: true }).click();
    await focusedStage(page, "welcome-step-3");
    const feeding = page.getByRole("checkbox", {
      name: "Alimentazione con formula",
      exact: true,
    });
    await feeding.scrollIntoViewIfNeeded();
    const feedingScroll = await geometry(feeding);
    const priorFeeding = await feeding.getAttribute("aria-checked");
    await feeding.click();
    await expect(feeding).toHaveAttribute(
      "aria-checked",
      priorFeeding === "true" ? "false" : "true",
    );
    await sameScroll(
      feedingScroll,
      feeding,
      "Welcome same-stage topic preference",
    );
    await screenshot(
      page,
      `welcome-step-3-${viewport.width}x${viewport.height}`,
    );
    await page
      .getByRole("button", { name: "Passo precedente", exact: true })
      .click();
    await focusedStage(page, "welcome-step-2");
    await expect(birthDate).toHaveValue("2026-01-20");
    await page
      .getByRole("button", { name: "Passo precedente", exact: true })
      .click();
    await focusedStage(page, "welcome-step-1");
    await expect(postpartum).toHaveAttribute("aria-checked", "true");
    await page
      .getByRole("button", { name: "Passo precedente", exact: true })
      .click();
    await focusedStage(page, "welcome-step-0");
    await screenshot(
      page,
      `welcome-return-${viewport.width}x${viewport.height}`,
    );

    expect(pageErrors, `JavaScript errors at ${viewport.width}px`).toEqual([]);
    await context.close();
    currentPage = null;
  }
  expect(
    forbidden,
    "No real or simulated write calls should be attempted",
  ).toEqual([]);
  if (artifacts)
    await writeFile(
      resolve(artifacts, "results.json"),
      JSON.stringify(results, null, 2),
    );
  console.log(
    "PASS: booking and welcome stage scroll/focus, review heading first and email action reachable by forward scroll, retained values, same-stage typing/preferences at 320x568, 390x844, 1024x768 and 1440x900. All services intercepted; no submissions or real data.",
  );
} catch (error) {
  if (artifacts && currentPage) {
    await screenshot(
      currentPage,
      `failure-${currentViewport?.width ?? "unknown"}`,
    );
    await writeFile(
      resolve(artifacts, "partial-results.json"),
      JSON.stringify({ results, forbidden }, null, 2),
    );
  }
  throw error;
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
