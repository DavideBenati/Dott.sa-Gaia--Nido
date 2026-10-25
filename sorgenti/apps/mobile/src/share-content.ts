import type { Checklist } from "@nido/core";

export interface ContentShare {
  title: string;
  text: string;
  url: string;
}

export type ShareOutcome = "shared" | "copied" | "cancelled" | "manual";

export interface ShareAdapters {
  share?: (content: ContentShare) => Promise<"shared" | "cancelled">;
  copy?: (text: string) => Promise<void>;
}

export interface TopicFilters {
  query: string;
  category: string;
  stage: "all" | "pregnancy" | "postpartum" | "birth";
  short: boolean;
  sort: "recent" | "short" | "title";
}

export function readTopicFilters(
  params: Record<string, string | string[] | undefined>,
): TopicFilters {
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const stage = first("stage");
  const sort = first("sort");
  return {
    query: first("query") ?? "",
    category: first("category") || "all",
    stage:
      stage === "pregnancy" || stage === "postpartum" || stage === "birth"
        ? stage
        : "all",
    short: first("short") === "1",
    sort: sort === "short" || sort === "title" ? sort : "recent",
  };
}

export function topicShare(
  filters: TopicFilters,
  categoryName?: string,
): ContentShare {
  return {
    title: `${categoryName ?? "Argomenti"} · metiMaia`,
    text: categoryName
      ? `Esplora le letture di metiMaia su ${categoryName}.`
      : "Esplora gli argomenti di metiMaia, con i tuoi tempi.",
    url: contentLink("/discover", {
      category: filters.category !== "all" ? filters.category : undefined,
      query: filters.query || undefined,
      stage: filters.stage !== "all" ? filters.stage : undefined,
      short: filters.short ? "1" : undefined,
      sort: filters.sort !== "recent" ? filters.sort : undefined,
    }),
  };
}

const publicSite = "https://metimaia.com";

/** Public links contain only content identifiers and deliberate search filters. */
export function contentLink(
  path: "/article" | "/checklist" | "/discover",
  params: Record<string, string | undefined> = {},
): string {
  const url = new URL(path, publicSite);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

export function checklistSummary(
  checklist: Pick<Checklist, "items">,
  progress: Record<string, boolean>,
) {
  const remaining = checklist.items.filter(
    (item) => progress[item.id] !== true,
  );
  return {
    total: checklist.items.length,
    completed: checklist.items.length - remaining.length,
    complete: checklist.items.length > 0 && remaining.length === 0,
    remaining,
  };
}

/** No profile, journey dates, email or other account data enter this snapshot. */
export function checklistShare(
  checklist: Checklist,
  progress: Record<string, boolean>,
): ContentShare {
  const summary = checklistSummary(checklist, progress);
  const status = summary.complete
    ? "🌷 Traguardo raggiunto: tutte le attività completate!"
    : `${summary.completed} di ${summary.total} attività completate.`;
  const remaining = summary.remaining.length
    ? `\nAttività ancora da fare:\n${summary.remaining.map((item) => `☐ ${item.label}`).join("\n")}`
    : "";
  return {
    title: `${checklist.title} · metiMaia`,
    text: `${checklist.title}\n${status}${remaining}\n\nÈ una fotografia dello stato al momento della condivisione: non si aggiorna automaticamente. Il link apre la checklist; i progressi personali restano nel proprio account o dispositivo.`,
    url: contentLink("/checklist", { id: checklist.id }),
  };
}

export function shareText(content: ContentShare): string {
  return `${content.text}\n${content.url}`;
}

/** Cancellation never falls through to a clipboard write or success message. */
export async function shareContent(
  content: ContentShare,
  adapters: ShareAdapters,
): Promise<ShareOutcome> {
  if (adapters.share) {
    try {
      return await adapters.share(content);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "AbortError"
      )
        return "cancelled";
    }
  }
  if (adapters.copy) {
    try {
      await adapters.copy(shareText(content));
      return "copied";
    } catch {
      // The caller displays selectable text for browsers without permission.
    }
  }
  return "manual";
}
