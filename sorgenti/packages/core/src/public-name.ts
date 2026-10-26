import type { Article, Checklist } from "./types";

export const professionalPublicName = "Dott.sa Gaia";

// Apply only to professional/editorial copy. Never to account identities,
// patient messages, document filenames, links, email addresses or stored rows.
export function publicProfessionalText(text: string): string {
  return text.replace(
    /\b(?:Ostetrica\s+)?(?:Dott\.(?:ssa|sa)\s+)?Gaia\s+Brunetti\b|\bDott\.(?:ssa|sa)\s+Brunetti\b/gi,
    (match) =>
      /^Ostetrica\b/i.test(match) ? "Ostetrica Gaia" : "Dott.ssa Gaia",
  );
}

export function publicArticle(article: Article): Article {
  return {
    ...article,
    title: publicProfessionalText(article.title),
    subtitle: publicProfessionalText(article.subtitle),
    authorName: publicProfessionalText(article.authorName),
    authorRole: publicProfessionalText(article.authorRole),
    reviewerName: article.reviewerName
      ? publicProfessionalText(article.reviewerName)
      : article.reviewerName,
    sections: article.sections.map((section) => ({
      ...section,
      heading: publicProfessionalText(section.heading),
      paragraphs: section.paragraphs.map(publicProfessionalText),
    })),
    references: article.references.map((reference) => ({
      ...reference,
      label: publicProfessionalText(reference.label),
    })),
  };
}

export function publicChecklist(checklist: Checklist): Checklist {
  return {
    ...checklist,
    title: publicProfessionalText(checklist.title),
    description: publicProfessionalText(checklist.description),
    items: checklist.items.map((item) => ({
      ...item,
      label: publicProfessionalText(item.label),
      ...(item.note ? { note: publicProfessionalText(item.note) } : {}),
    })),
  };
}
