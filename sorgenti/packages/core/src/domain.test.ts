import { describe, it, expect } from "vitest";
import {
  articles,
  checklists,
  categories,
  calculateJourney,
  defaultPreferences,
  filterArticles,
  recommendArticles,
  isPublicArticle,
  validateArticle,
} from "./index";
const now = new Date("2026-10-21T12:00:00Z");
describe("Percorso e privacy", () => {
  it("funziona senza date o consenso", () => {
    expect(
      calculateJourney({ ...defaultPreferences, date: "2026-10-21" }, now).week,
    ).toBeNull();
  });
  it("stima quaranta settimane alla data presunta", () => {
    expect(
      calculateJourney(
        {
          ...defaultPreferences,
          personalized: true,
          sensitiveConsent: true,
          date: "2026-10-21",
        },
        now,
      ).week,
    ).toBe(40);
  });
  it("calcola il postpartum in settimane", () => {
    expect(
      calculateJourney(
        {
          ...defaultPreferences,
          journey: "postpartum",
          personalized: true,
          sensitiveConsent: true,
          date: "2026-09-30",
        },
        now,
      ).label,
    ).toBe("3 settimane insieme");
  });
  it("il partner non deve fornire date", () => {
    expect(
      calculateJourney({ ...defaultPreferences, journey: "partner" }, now)
        .label,
    ).toBe("Insieme, in attesa");
  });
  it("il percorso generale non deduce una fase o una settimana da una data precedente", () => {
    const result = calculateJourney(
      {
        ...defaultPreferences,
        exploreOnly: true,
        personalized: true,
        sensitiveConsent: true,
        date: "2026-10-21",
      },
      now,
    );
    expect(result.stage).toBe("all");
    expect(result.week).toBeNull();
    expect(result.label).toBe("Esplora al tuo ritmo");
  });
  it("il partner può scegliere il dopo nascita senza usare date di altre persone", () => {
    const result = calculateJourney(
      {
        ...defaultPreferences,
        journey: "partner",
        partnerStage: "postpartum",
        personalized: true,
        sensitiveConsent: true,
        date: "2026-09-30",
      },
      now,
    );
    expect(result.stage).toBe("postpartum");
    expect(result.week).toBeNull();
    expect(result.label).toBe("Accanto alla famiglia");
  });
  it("rifiuta date impossibili", () => {
    expect(
      calculateJourney(
        {
          ...defaultPreferences,
          personalized: true,
          sensitiveConsent: true,
          date: "2026-02-30",
        },
        now,
      ).week,
    ).toBeNull();
  });
  it("non usa una nascita futura", () => {
    expect(
      calculateJourney(
        {
          ...defaultPreferences,
          journey: "postpartum",
          personalized: true,
          sensitiveConsent: true,
          date: "2027-01-01",
        },
        now,
      ).days,
    ).toBeNull();
  });
});
describe("Biblioteca e redazione", () => {
  it("contiene dodici articoli completi non approvati e sei liste adattabili", () => {
    expect(articles.length).toBeGreaterThanOrEqual(12);
    expect(categories).toHaveLength(9);
    expect(checklists).toHaveLength(6);
    expect(
      articles.every((a) => a.isDemo && !a.approved && a.sections.length >= 3),
    ).toBe(true);
  });
  it("filtra ricerca e categoria insieme", () => {
    const result = filterArticles(articles, {
      query: "primo trimestre",
      categoryId: "pregnancy",
    });
    expect(result.map((a) => a.id)).toContain("primo-trimestre");
    expect(result.every((a) => a.categoryId === "pregnancy")).toBe(true);
  });
  it("restituisce uno stato vuoto reale", () => {
    expect(
      filterArticles(articles, { query: "nessuncontenutoesistente" }),
    ).toEqual([]);
  });
  it("non rende pubblica una bozza o una demo", () => {
    expect(
      isPublicArticle({
        ...articles[0],
        status: "draft",
        approved: true,
        isDemo: false,
      }),
    ).toBe(false);
    expect(isPublicArticle(articles[0])).toBe(false);
  });
  it("richiede revisione e autore per pubblicare", () => {
    expect(
      validateArticle(
        {
          ...articles[0],
          isDemo: false,
          status: "published",
          approved: false,
          reviewerName: null,
          reviewedAt: null,
        },
        now,
      ).length,
    ).toBeGreaterThan(0);
  });
  it("gestisce payload non validi senza lanciare eccezioni", () => {
    expect(validateArticle(null)).not.toEqual([]);
    expect(validateArticle({ title: 5 })).not.toEqual([]);
  });
  it("personalizza i temi di alimentazione in italiano", () => {
    const selected = recommendArticles(
      articles,
      {
        ...defaultPreferences,
        journey: "postpartum",
        feedingTopics: ["Alimentazione con formula"],
      },
      now,
    );
    expect(selected[0].categoryId).toBe("feeding");
  });
});

describe("Letture e storia ostetrica facoltativa", () => {
  it("non usa un precedente cesareo senza il consenso distinto alla personalizzazione", async () => {
    const { emptyPregnancyProfile } = await import("./pregnancy");
    const neutral = {
      ...articles[0],
      id: "neutral",
      title: "Prepararsi insieme",
      subtitle: "Una lettura",
      stage: "pregnancy" as const,
      weekFrom: null,
      weekTo: null,
    };
    const cesarean = { ...neutral, id: "cesarean", title: "Il parto cesareo" };
    const clinical = {
      ...emptyPregnancyProfile(),
      storage_consent: true,
      previous_pregnancies: true,
      previous_outcomes: ["cesarean" as const],
    };
    expect(
      recommendArticles(
        [neutral, cesarean],
        defaultPreferences,
        now,
        clinical,
      )[0].id,
    ).toBe("neutral");
    expect(
      recommendArticles([neutral, cesarean], defaultPreferences, now, {
        ...clinical,
        personalization_consent: true,
      })[0].id,
    ).toBe("cesarean");
    expect(
      recommendArticles(
        [neutral, cesarean],
        { ...defaultPreferences, journey: "partner" },
        now,
        { ...clinical, personalization_consent: true },
      )[0].id,
    ).toBe("neutral");
  });
});
