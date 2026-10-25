import { expect, test, vi } from "vitest";
import type { Checklist } from "@nido/core";
import {
  checklistShare,
  checklistSummary,
  contentLink,
  shareContent,
  readTopicFilters,
  topicShare,
} from "../apps/mobile/src/share-content";

const checklist: Checklist = {
  id: "bag",
  title: "La borsa",
  description: "Preparati con calma",
  stage: "pregnancy",
  status: "published",
  approved: true,
  isDemo: false,
  items: [
    { id: "documents", label: "Preparare i documenti" },
    { id: "clothes", label: "Preparare i cambi" },
  ],
};

test("a badge requires every item in a nonempty checklist, ignoring unrelated progress", () => {
  expect(
    checklistSummary(checklist, { documents: true, unrelated: true }),
  ).toMatchObject({
    total: 2,
    completed: 1,
    complete: false,
  });
  expect(
    checklistSummary(checklist, { documents: true, clothes: true }).complete,
  ).toBe(true);
  expect(checklistSummary({ items: [] }, { unrelated: true }).complete).toBe(
    false,
  );
});

test("a shared snapshot lists remaining tasks and explains that it does not synchronize", () => {
  const value = checklistShare(checklist, {
    documents: true,
    privateItem: true,
  });
  expect(value.text).toContain("1 di 2");
  expect(value.text).toContain("☐ Preparare i cambi");
  expect(value.text).not.toContain("Preparare i documenti");
  expect(value.text).not.toContain("privateItem");
  expect(value.text).toContain("non si aggiorna automaticamente");
  expect(value.text).not.toContain("Traguardo raggiunto");
  expect(new URL(value.url).searchParams.get("id")).toBe("bag");
});

test("a completed snapshot includes the earned milestone", () => {
  const value = checklistShare(checklist, { documents: true, clothes: true });
  expect(value.text).toContain("Traguardo raggiunto");
  expect(value.text).not.toContain("Attività ancora da fare");
});

test("topic links preserve deliberate filters with correct URL encoding", () => {
  const url = new URL(
    contentLink("/discover", {
      category: "care",
      query: "sonno & cura",
      stage: "postpartum",
    }),
  );
  expect(url.origin).toBe("https://metimaia.com");
  expect(url.searchParams.get("query")).toBe("sonno & cura");
  expect(url.searchParams.get("category")).toBe("care");
});

test("a shared topic link restores its complete set of filters", () => {
  const filters = {
    query: "sonno & cura",
    category: "care",
    stage: "birth" as const,
    short: true,
    sort: "title" as const,
  };
  const url = new URL(topicShare(filters, "Prendersi cura").url);
  expect(readTopicFilters(Object.fromEntries(url.searchParams))).toEqual(
    filters,
  );
  expect(
    readTopicFilters({ stage: "invalid", sort: "invalid", short: "yes" }),
  ).toEqual({
    query: "",
    category: "all",
    stage: "all",
    short: false,
    sort: "recent",
  });
});

test("share cancellation does not copy or claim success", async () => {
  const copy = vi.fn();
  expect(
    await shareContent(checklistShare(checklist, {}), {
      share: async () => {
        throw { name: "AbortError" };
      },
      copy,
    }),
  ).toBe("cancelled");
  expect(copy).not.toHaveBeenCalled();
});

test("a failed native share falls back to a confirmed clipboard write", async () => {
  const copy = vi.fn(async () => {});
  expect(
    await shareContent(checklistShare(checklist, {}), {
      share: async () => {
        throw new Error("Unavailable");
      },
      copy,
    }),
  ).toBe("copied");
  expect(copy).toHaveBeenCalledWith(
    expect.stringContaining("https://metimaia.com/checklist?id=bag"),
  );
});

test("clipboard failure produces manual selection, not false success", async () => {
  expect(
    await shareContent(checklistShare(checklist, {}), {
      copy: async () => {
        throw new Error("Permission denied");
      },
    }),
  ).toBe("manual");
});
