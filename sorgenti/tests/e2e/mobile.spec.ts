import { expect, test, type Page } from "@playwright/test";

const appPath = (path: string) =>
  `${(process.env.MOBILE_BASE_PATH ?? "").replace(/\/$/, "")}${path}`;

async function enterAsGuest(page: Page) {
  await page.goto(appPath("/"));
  await page.getByText("Esplora come ospite", { exact: true }).click();
  await expect(
    page.getByText("Ciao! Oggi facciamo un altro passo insieme.", {
      exact: true,
    }),
  ).toBeVisible();
}

async function openDiscover(page: Page) {
  await page.getByRole("tab", { name: "Scopri" }).click();
  await expect(page.getByLabel("Cerca un articolo")).toBeVisible();
}

test("guest navigation, search, category filtering and empty results", async ({
  page,
}) => {
  await enterAsGuest(page);
  await openDiscover(page);
  const search = page.getByLabel("Cerca un articolo");
  await search.fill("primo trimestre");
  await expect(
    page.getByRole("button", {
      name: "Il primo trimestre, un passo alla volta",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Il puerperio: dare spazio al recupero",
      exact: true,
    }),
  ).toHaveCount(0);
  await search.fill("nessuncontenutoesistente");
  await expect(
    page.getByText(
      "Nessuna lettura corrisponde alla ricerca. Prova con un’altra parola o esplora tutti gli argomenti.",
      { exact: true },
    ),
  ).toBeVisible();
  await search.fill("");
  await page
    .getByRole("button", {
      name: "Categoria: Il ruolo del partner",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Esserci: il partner durante il travaglio",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Il primo trimestre, un passo alla volta",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("article details, favorites and saved articles persist after reload", async ({
  page,
}) => {
  await enterAsGuest(page);
  await openDiscover(page);
  await page.getByLabel("Cerca un articolo").fill("primo trimestre");
  await page
    .getByRole("button", {
      name: "Il primo trimestre, un passo alla volta",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/article\//);
  await expect(page.getByText(/contenuto dimostrativo/i).first()).toBeVisible();
  await page.getByLabel("Salva articolo", { exact: true }).click();
  await expect(
    page.getByLabel("Rimuovi dai salvati", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByLabel("Rimuovi dai salvati", { exact: true }),
  ).toBeVisible();
  await page.goto(appPath("/saved"));
  await expect(
    page.getByRole("button", {
      name: "Il primo trimestre, un passo alla volta",
      exact: true,
    }),
  ).toBeVisible();
});

test("checklist items can be checked, restored and unchecked", async ({
  page,
}) => {
  await enterAsGuest(page);
  await page.getByRole("tab", { name: "Checklist" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Un piccolo passo alla volta.",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Preparare la borsa per il parto",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/checklist\//);
  const firstItem = page.getByRole("checkbox").first();
  await expect(firstItem).not.toBeChecked();
  await firstItem.click();
  await expect(firstItem).toBeChecked();
  await page.reload();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
  await page.getByRole("checkbox").first().click();
  await expect(page.getByRole("checkbox").first()).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole("checkbox").first()).not.toBeChecked();
});

test("postpartum onboarding, optional consent, export and local deletion", async ({
  page,
}) => {
  const birthDate = new Date(Date.now() - 21 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  await page.goto(appPath("/"));
  await page
    .getByRole("button", { name: "Iniziamo insieme", exact: true })
    .click();
  await page
    .getByRole("radio", { name: "Sono già genitore", exact: true })
    .click();
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await expect(
    page.getByLabel("Data di nascita facoltativa", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("switch", {
      name: "Desidero un percorso personalizzato",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(
      /Prima di scegliere una data: può rivelare informazioni sulla salute/,
    ),
  ).toBeVisible();
  await expect(
    page.getByLabel("Data di nascita facoltativa", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("checkbox", {
      name: "Acconsento al salvataggio della data facoltativa",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Acconsento al salvataggio della data facoltativa",
      exact: true,
    }),
  ).toBeChecked();
  await page
    .getByLabel("Data di nascita facoltativa", { exact: true })
    .fill(birthDate);
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Alimentazione con formula", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Alimentazione con formula",
      exact: true,
    }),
  ).toBeChecked();
  await expect(
    page.getByRole("switch", {
      name: "Consenso marketing facoltativo",
      exact: true,
    }),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "Entra nel tuo Nido", exact: true })
    .click();
  await expect(
    page.getByText("3 settimane insieme", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "I primi giorni: conoscersi, con calma",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Profilo", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Il tuo spazio, le tue scelte.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(`Data facoltativa: ${birthDate}`, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Ritira il consenso e rimuovi la data",
      exact: true,
    })
    .click();
  await expect(
    page.getByText(`Data facoltativa: ${birthDate}`, { exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByText(`Data facoltativa: ${birthDate}`, { exact: true }),
  ).toHaveCount(0);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Esporta i miei dati", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("nido-i-miei-dati.json");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  expect(exported.preferences).toMatchObject({
    journey: "postpartum",
    date: null,
    sensitiveConsent: false,
    marketing: false,
  });
  await page
    .getByRole("button", {
      name: "Cancella i dati del dispositivo",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Conferma cancellazione", exact: true })
    .click();
  await expect(page).toHaveURL(/\/welcome/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Iniziamo insieme", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Esplora come ospite", exact: true })
    .click();
  await expect(
    page.getByText("Il tuo percorso", { exact: true }),
  ).toBeVisible();
});

test("partner onboarding works without another person’s health details", async ({
  page,
}) => {
  await page.goto(appPath("/"));
  await page
    .getByRole("button", { name: "Iniziamo insieme", exact: true })
    .click();
  await page
    .getByRole("radio", { name: "Accompagno una persona", exact: true })
    .click();
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await expect(
    page.getByRole("switch", {
      name: "Desidero un percorso personalizzato",
      exact: true,
    }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: "Continua", exact: true }).click();
  await page
    .getByRole("button", { name: "Entra nel tuo Nido", exact: true })
    .click();
  await expect(
    page.getByText("Insieme, in attesa", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Profilo", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Il tuo spazio, le tue scelte.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(/Data facoltativa:/)).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Ritira il consenso e rimuovi la data",
      exact: true,
    }),
  ).toHaveCount(0);
});
