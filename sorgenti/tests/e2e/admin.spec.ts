import { expect, test } from "@playwright/test";

test("editorial APIs reject unauthenticated and cross-origin writes", async ({
  request,
}) => {
  const unauthorized = await request.post("/api/editor", {
    data: {
      action: "article",
      value: {
        title: "Tentativo non autorizzato",
        status: "published",
        approved: true,
        role: "admin",
      },
    },
  });
  expect([401, 403, 503]).toContain(unauthorized.status());
  expect(await unauthorized.json()).toHaveProperty("error");

  const crossOrigin = await request.post("/api/editor", {
    headers: { origin: "https://untrusted.example" },
    data: {
      action: "article",
      value: { title: "Tentativo da origine esterna" },
    },
  });
  expect(crossOrigin.status()).toBe(403);
});

test("editorial data and uploads require server authorization", async ({
  request,
}) => {
  const editorial = await request.get("/api/editor");
  expect([401, 403, 503]).toContain(editorial.status());
  expect(await editorial.json()).not.toHaveProperty("articles");

  const upload = await request.post("/api/upload", {
    multipart: {
      file: {
        name: "example.png",
        mimeType: "image/png",
        buffer: Buffer.from("not-an-image"),
      },
    },
  });
  expect([401, 403, 503]).toContain(upload.status());
});

test("demo editor saves drafts, previews, edits, simulates publication and unpublishes", async ({
  page,
}) => {
  const title = "Una rete di supporto, prova editoriale";
  const updatedTitle = "Una rete di supporto, articolo aggiornato";
  await page.goto("/");
  await expect(page.getByText("Modalità demo", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Le pubblicazioni simulate non compaiono nell’app dei genitori.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Nuovo articolo", exact: true })
    .click();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("Titolo", { exact: true }).fill(title);
  await editor
    .getByLabel("Sottotitolo", { exact: true })
    .fill("Organizzare piccoli aiuti, rispettando scelte e riservatezza.");
  await editor
    .getByLabel("Corpo dell’articolo")
    .fill(
      "## Chiedere un aiuto concreto\n\nQuesto è un esempio editoriale, da sottoporre a revisione professionale.",
    );
  await editor
    .getByLabel("Autore", { exact: true })
    .fill("Redazione dimostrativa");
  await editor
    .getByLabel("Ruolo professionale", { exact: true })
    .fill("Esempio da revisionare");
  await editor.getByRole("button", { name: "Anteprima", exact: true }).click();
  const preview = page.getByRole("dialog").last();
  await expect(
    preview.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByText(
      "Questo è un esempio editoriale, da sottoporre a revisione professionale.",
      { exact: true },
    ),
  ).toBeVisible();
  await preview.getByLabel("Chiudi anteprima").click();
  await editor
    .getByRole("button", { name: "Salva articolo", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  let row = page.locator(".article-row").filter({ hasText: title });
  await expect(row.getByText("Bozza", { exact: true })).toBeVisible();
  await page.reload();
  row = page.locator(".article-row").filter({ hasText: title });
  await row.getByRole("button", { name: /Modifica/ }).click();
  await page.getByLabel("Titolo", { exact: true }).fill(updatedTitle);
  await page
    .getByRole("combobox", { name: "Stato editoriale", exact: true })
    .selectOption("published");
  await page
    .getByRole("button", { name: "Salva articolo", exact: true })
    .click();
  row = page.locator(".article-row").filter({ hasText: updatedTitle });
  await expect(
    row.getByText("Pubblicato · demo", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Filtra per stato").selectOption("draft");
  await expect(page.getByText(updatedTitle, { exact: true })).toHaveCount(0);
  await page.getByLabel("Filtra per stato").selectOption("published");
  row = page.locator(".article-row").filter({ hasText: updatedTitle });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /Modifica/ }).click();
  await page
    .getByRole("combobox", { name: "Stato editoriale", exact: true })
    .selectOption("draft");
  await page
    .getByRole("button", { name: "Salva articolo", exact: true })
    .click();
  await page.getByLabel("Filtra per stato").selectOption("draft");
  await expect(
    page
      .locator(".article-row")
      .filter({ hasText: updatedTitle })
      .getByText("Bozza", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator(".article-row")
      .filter({ hasText: updatedTitle })
      .getByText("Bozza", { exact: true }),
  ).toBeVisible();
});

test("demo editorial checklist and category changes persist", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Checklist", exact: true }).click();
  await page
    .getByRole("button", { name: "Nuova checklist", exact: true })
    .click();
  await page.getByLabel("Titolo checklist").fill("La rete di aiuto, esempio");
  await page
    .getByLabel("Descrizione", { exact: true })
    .fill("Suggerimenti da adattare alla propria famiglia.");
  await page
    .getByRole("textbox", { name: /^Suggerimenti/ })
    .fill("Concordare una commissione\nOrganizzare un momento di ascolto");
  await page
    .getByRole("button", { name: "Salva checklist", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "La rete di aiuto, esempio",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Checklist", exact: true }).click();
  await page
    .getByRole("heading", { name: "La rete di aiuto, esempio", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: /^Suggerimenti/ }),
  ).toHaveValue(
    "Concordare una commissione\nOrganizzare un momento di ascolto",
  );
  await page.getByLabel("Chiudi checklist").click();
  await page.getByRole("button", { name: "Categorie", exact: true }).click();
  await page.getByLabel("Nuova categoria").fill("Risorse del territorio");
  await page
    .getByRole("button", { name: "Aggiungi categoria", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Categorie", exact: true }).click();
  await expect(
    page.getByLabel("Nome categoria Risorse del territorio"),
  ).toHaveValue("Risorse del territorio");
});
