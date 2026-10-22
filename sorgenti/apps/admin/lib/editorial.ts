import type {
  Article,
  ArticleSection,
  Category,
  Checklist,
  Reference,
} from "@nido/core";
export const statusLabels = {
  draft: "Bozza",
  in_review: "In revisione",
  published: "Pubblicato",
  archived: "Archiviato",
};
export const stageLabels = {
  pregnancy: "Gravidanza",
  postpartum: "Dopo la nascita",
  all: "Tutti i percorsi",
};
export const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const bodyToText = (sections: ArticleSection[]) =>
  sections
    .map(
      (section) =>
        `## ${section.heading}\n\n${section.paragraphs.join("\n\n")}`,
    )
    .join("\n\n");
export function textToBody(text: string): ArticleSection[] {
  return text
    .split(/(?:^|\n)##\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [heading, ...lines] = chunk.split("\n");
      return {
        heading: heading.trim(),
        paragraphs: lines
          .join("\n")
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean),
      };
    });
}
export const refsToText = (references: Reference[]) =>
  references.map((ref) => `${ref.label} | ${ref.url}`).join("\n");
export function textToRefs(text: string): Reference[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split("|");
      return { label: label.trim(), url: rest.join("|").trim() };
    });
}
export function newArticle(
  category: Category | undefined,
  demo: boolean,
): Article {
  return {
    id: crypto.randomUUID(),
    slug: "",
    title: "",
    subtitle: "",
    categoryId: category?.id ?? "",
    stage: "all",
    weekFrom: null,
    weekTo: null,
    imageUrl: "",
    readingMinutes: 5,
    authorName: demo ? "Redazione Nido · esempio" : "",
    authorRole: demo ? "Contenuto dimostrativo, da revisionare" : "",
    publishedAt: null,
    reviewedAt: null,
    reviewerName: null,
    status: "draft",
    approved: false,
    isDemo: demo,
    sections: [{ heading: "Un passo alla volta", paragraphs: [] }],
    references: [],
    videoUrl: null,
  };
}
export function newChecklist(demo: boolean): Checklist {
  return {
    id: crypto.randomUUID(),
    title: "",
    description: "",
    stage: "all",
    status: "draft",
    approved: false,
    isDemo: demo,
    items: [],
  };
}
