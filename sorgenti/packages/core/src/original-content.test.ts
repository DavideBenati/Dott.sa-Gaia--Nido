import { describe, expect, test } from "vitest";
import { validateArticle } from "./domain";
import { articles } from "./fixtures";

const today = new Date("2026-10-30T12:00:00Z");
const publication = {
  ...articles[0],
  authorName: "Dott.sa Gaia",
  authorRole: "Ostetrica",
  status: "published",
  isDemo: false,
  approved: true,
  reviewedAt: "2026-10-30",
  reviewerName: "Dott.sa Gaia",
  publishedAt: "2026-10-30",
  references: [],
};

describe("Attribution of original editorial material", () => {
  test("allows a reviewed original without external references", () => {
    expect(
      validateArticle({ ...publication, originalContent: true }, today),
    ).toEqual([]);
  });

  test("legacy and explicitly external material still need references", () => {
    expect(validateArticle(publication, today).join(" ")).toContain(
      "Aggiungi una fonte",
    );
    expect(
      validateArticle({ ...publication, originalContent: false }, today).join(
        " ",
      ),
    ).toContain("Aggiungi una fonte");
    expect(
      validateArticle(
        { ...publication, references: articles[0].references },
        today,
      ),
    ).toEqual([]);
  });

  test("rejects malformed original-content assertions", () => {
    for (const value of ["true", "false", 1, {}, [], null])
      expect(
        validateArticle({ ...publication, originalContent: value }, today),
      ).toEqual([
        "Il contenuto non ha un formato valido. Controlla i campi dell’articolo.",
      ]);
  });

  test("original attribution does not excuse invalid references or publication metadata", () => {
    const errors = validateArticle(
      {
        ...publication,
        originalContent: true,
        authorName: "",
        approved: false,
        reviewerName: null,
        reviewedAt: null,
        references: [{ label: "", url: "http://example.invalid/fonte" }],
      },
      today,
    );
    expect(errors).toContain(
      "Ogni riferimento deve avere un titolo e un collegamento HTTPS.",
    );
    expect(errors).toContain(
      "La pubblicazione richiede approvazione professionale.",
    );
    expect(errors).toContain(
      "Indica autore e ruolo, senza inventare qualifiche.",
    );
    expect(errors).toContain(
      "Indica il professionista responsabile della revisione.",
    );
    expect(errors).toContain(
      "Indica una data di revisione valida, non futura.",
    );
  });
});
