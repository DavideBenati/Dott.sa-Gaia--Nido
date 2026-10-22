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
