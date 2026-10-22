import type {
  Article,
  Checklist,
  JourneyInfo,
  Preferences,
  Stage,
} from "./types";

export const disclaimer =
  "Le informazioni presenti nell'app hanno finalità educative e non sostituiscono il parere di un professionista sanitario.";
const DAY = 86_400_000;
const dayNumber = (date: Date) =>
  Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) /
      DAY,
  );
function parseDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) &&
    date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

export function calculateJourney(
  preferences: Preferences,
  now = new Date(),
): JourneyInfo {
  const stage: Stage =
    preferences.journey === "postpartum" ? "postpartum" : "pregnancy";
  const base: JourneyInfo = {
    stage,
    week: null,
    days: null,
    label:
      stage === "postpartum"
        ? "Un nuovo inizio"
        : preferences.journey === "partner"
          ? "Insieme, in attesa"
          : "Il tuo percorso",
    description:
      "Puoi esplorare tutti i contenuti anche senza condividere date o informazioni personali.",
  };
  if (
    !preferences.personalized ||
    !preferences.sensitiveConsent ||
    !preferences.date
  )
    return base;
  const date = parseDate(preferences.date);
  if (!date || Number.isNaN(now.valueOf()))
    return {
      ...base,
      description:
        "La data non è valida. Puoi correggerla nelle preferenze o proseguire senza una data.",
    };
  const elapsed = dayNumber(now) - dayNumber(date);
  if (stage === "postpartum") {
    if (elapsed < 0)
      return {
        ...base,
        description:
          "La data di nascita è nel futuro. Puoi aggiornarla nelle preferenze.",
      };
    const week = Math.floor(elapsed / 7);
    return {
      stage,
      week,
      days: elapsed,
      label:
        elapsed < 7
          ? `${elapsed} ${elapsed === 1 ? "giorno" : "giorni"} insieme`
          : `${week} ${week === 1 ? "settimana" : "settimane"} insieme`,
      description:
        "Età approssimativa dalla data indicata: ogni famiglia e ogni bambino hanno il proprio ritmo.",
    };
  }
  const gestationDays = 280 + elapsed;
  if (gestationDays < 0 || gestationDays > 301)
    return {
      ...base,
      description:
        "La data indicata non permette una stima utile del percorso. Puoi aggiornarla nelle preferenze.",
    };
  const week = Math.floor(gestationDays / 7);
  return {
    stage,
    week,
    days: gestationDays,
    label: `Settimana ${week}`,
    description:
      "Stima orientativa dalla data presunta del parto, basata su 40 settimane. Non sostituisce la datazione del professionista che ti segue.",
  };
}

export const normalizeSearch = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it")
    .trim();
export function filterArticles(
  items: Article[],
  filters: { query?: string; categoryId?: string; stage?: Stage } = {},
): Article[] {
  const query = normalizeSearch(filters.query || "");
  return items.filter((article) => {
    if (
      filters.categoryId &&
      filters.categoryId !== "all" &&
      article.categoryId !== filters.categoryId
    )
      return false;
    if (
      filters.stage &&
      filters.stage !== "all" &&
      article.stage !== "all" &&
      article.stage !== filters.stage
    )
      return false;
    return (
      !query ||
      normalizeSearch(
        `${article.title} ${article.subtitle} ${article.sections.map((section) => `${section.heading} ${section.paragraphs.join(" ")}`).join(" ")}`,
      ).includes(query)
    );
  });
}
export function recommendArticles(
  items: Article[],
  preferences: Preferences,
  now = new Date(),
): Article[] {
  const journey = calculateJourney(preferences, now);
  const topicCategories: Record<string, string[]> = {
    "allattamento al seno": ["breastfeeding"],
    "alimentazione con formula": ["feeding"],
    "alimentazione mista": ["feeding", "breastfeeding"],
    "supporto e scelte informate": ["feeding", "wellbeing"],
  };
  const selectedCategories = new Set(
    preferences.feedingTopics.flatMap((topic) => {
      const normalized = normalizeSearch(topic);
      return topicCategories[normalized] ?? [normalized];
    }),
  );
  const ranked = items.map((article, index) => {
    let score =
      article.stage === journey.stage ? 2 : article.stage === "all" ? 1 : 0;
    if (
      journey.week !== null &&
      article.stage === journey.stage &&
      article.weekFrom !== null &&
      article.weekTo !== null &&
      journey.week >= article.weekFrom &&
      journey.week <= article.weekTo
    )
      score += 4;
    if (preferences.journey === "partner" && article.categoryId === "partner")
      score += 3;
    if (selectedCategories.has(article.categoryId)) score += 2;
    return { article, score, index };
  });
  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.slice(0, 4).map((item) => item.article);
}
export function isPublicArticle(article: Article): boolean {
  return (
    article.status === "published" &&
    article.approved === true &&
    article.isDemo === false
  );
}
export function isPublicChecklist(checklist: Checklist): boolean {
  return (
    checklist.status === "published" &&
    checklist.approved === true &&
    checklist.isDemo === false
  );
}
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
/** HTTP request bodies are not made safe by a TypeScript cast. */
function articleShape(value: unknown): value is Article {
  if (!record(value)) return false;
  const strings = [
    "id",
    "slug",
    "title",
    "subtitle",
    "categoryId",
    "stage",
    "imageUrl",
    "authorName",
    "authorRole",
    "status",
  ];
  const nullableStrings = [
    "publishedAt",
    "reviewedAt",
    "reviewerName",
    "videoUrl",
  ];
  if (
    !strings.every((key) => typeof value[key] === "string") ||
    !nullableStrings.every(
      (key) => value[key] === null || typeof value[key] === "string",
    )
  )
    return false;
  if (
    typeof value.readingMinutes !== "number" ||
    typeof value.approved !== "boolean" ||
    typeof value.isDemo !== "boolean"
  )
    return false;
  if (
    ![value.weekFrom, value.weekTo].every(
      (week) => week === null || typeof week === "number",
    )
  )
    return false;
  if (
    !Array.isArray(value.sections) ||
    !value.sections.every(
      (part) =>
        record(part) &&
        typeof part.heading === "string" &&
        Array.isArray(part.paragraphs) &&
        part.paragraphs.every((paragraph) => typeof paragraph === "string"),
    )
  )
    return false;
  if (
    !Array.isArray(value.references) ||
    !value.references.every(
      (reference) =>
        record(reference) &&
        typeof reference.label === "string" &&
        typeof reference.url === "string",
    )
  )
    return false;
  return true;
}
export function validateArticle(
  article: unknown,
  today = new Date(),
): string[] {
  if (!articleShape(article))
    return [
      "Il contenuto non ha un formato valido. Controlla i campi dell’articolo.",
    ];
  const errors: string[] = [];
  if (!["pregnancy", "postpartum", "all"].includes(article.stage))
    errors.push("Scegli una fase del percorso valida.");
  if (!["draft", "in_review", "published", "archived"].includes(article.status))
    errors.push("Scegli uno stato editoriale valido.");
  if (article.title.trim().length < 5)
    errors.push("Inserisci un titolo di almeno 5 caratteri.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug))
    errors.push("Usa uno slug con lettere minuscole, numeri e trattini.");
  if (!article.subtitle.trim()) errors.push("Inserisci un sottotitolo.");
  if (!article.categoryId) errors.push("Scegli una categoria.");
  if (!article.authorName.trim() || !article.authorRole.trim())
    errors.push("Indica autore e ruolo, senza inventare qualifiche.");
  if (
    !Number.isInteger(article.readingMinutes) ||
    article.readingMinutes < 1 ||
    article.readingMinutes > 120
  )
    errors.push("Indica un tempo di lettura tra 1 e 120 minuti.");
  if (
    !article.sections.length ||
    article.sections.some(
      (section) =>
        !section.heading.trim() ||
        !section.paragraphs.length ||
        section.paragraphs.some((paragraph) => !paragraph.trim()),
    )
  )
    errors.push("Completa il testo e i titoli delle sezioni.");
  if (
    (article.weekFrom === null) !== (article.weekTo === null) ||
    (article.weekFrom !== null &&
      article.weekTo !== null &&
      (!Number.isSafeInteger(article.weekFrom) ||
        !Number.isSafeInteger(article.weekTo) ||
        article.weekFrom < 0 ||
        article.weekFrom > article.weekTo ||
        (article.stage === "pregnancy" && article.weekTo > 43)))
  )
    errors.push(
      "Controlla l’intervallo di settimane. Per la gravidanza usa settimane da 0 a 43.",
    );
  const safeUrl = (value: string) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  };
  if (
    article.imageUrl &&
    !safeUrl(article.imageUrl) &&
    !(article.imageUrl.startsWith("/") && !article.imageUrl.startsWith("//"))
  )
    errors.push("L’immagine deve usare un indirizzo HTTPS.");
  if (article.videoUrl && !safeUrl(article.videoUrl))
    errors.push("Il video deve usare un indirizzo HTTPS.");
  if (
    article.references.some(
      (reference) => !reference.label.trim() || !safeUrl(reference.url),
    )
  )
    errors.push(
      "Ogni riferimento deve avere un titolo e un collegamento HTTPS.",
    );
  if (article.status === "published" && !article.isDemo) {
    if (!article.approved)
      errors.push("La pubblicazione richiede approvazione professionale.");
    if (!article.reviewerName?.trim())
      errors.push("Indica il professionista responsabile della revisione.");
    const review = parseDate(article.reviewedAt);
    if (!review || dayNumber(review) > dayNumber(today))
      errors.push("Indica una data di revisione valida, non futura.");
    if (!article.references.length)
      errors.push("La pubblicazione richiede fonti verificabili.");
    if (
      !article.publishedAt ||
      Number.isNaN(Date.parse(article.publishedAt)) ||
      Date.parse(article.publishedAt) > today.getTime()
    )
      errors.push("Indica una data di pubblicazione valida, non futura.");
  }
  if (article.isDemo && article.approved)
    errors.push(
      "Un contenuto dimostrativo non può risultare approvato clinicamente.",
    );
  return errors;
}
