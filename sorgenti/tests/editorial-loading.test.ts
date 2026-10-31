import { describe, expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadEditorialContent,
  loadPublicContent,
  saveArticle,
} from "../packages/data/src/index";
import {
  articles,
  categories,
  checklists,
} from "../packages/core/src/fixtures";
import type { Article } from "../packages/core/src/types";

const publicArticle = (index: number, imageUrl: string): Article => ({
  ...articles[index],
  status: "published",
  approved: true,
  isDemo: false,
  imageUrl,
});
const first = publicArticle(0, "storage://editorial-images/missing-cover.png");
const second = publicArticle(1, "storage://editorial-images/healthy-cover.png");
const third = publicArticle(2, "https://images.example.invalid/public.jpg");
type Row = { payload: Article | (typeof checklists)[number] } & {
  status?: string;
  approved?: boolean;
  is_demo?: boolean;
};
const row = (payload: Row["payload"]): Row => ({
  payload,
  status: payload.status,
  approved: payload.approved,
  is_demo: payload.isDemo,
});

function fixture({
  coverFailure = "error",
  errorTable,
}: {
  coverFailure?: "error" | "throw" | "missing-data";
  errorTable?: string;
} = {}) {
  const documents = [
    first,
    second,
    third,
    { ...first, id: "private-draft", status: "draft", approved: false },
  ];
  const content: Record<string, unknown[]> = {
    articles: documents.map((document) => row(document as Article)),
    checklists: [row({ ...checklists[0], approved: true, isDemo: false })],
    article_categories: categories,
  };
  const calls: { table: string; column: string; value: unknown }[] = [];
  const createSignedUrl = vi.fn(async (path: string) => {
    if (path === "healthy-cover.png")
      return {
        data: {
          signedUrl: "https://images.example.invalid/signed/healthy.png",
        },
        error: null,
      };
    if (coverFailure === "throw") throw new Error("Storage unreachable");
    return {
      data: null,
      error: coverFailure === "error" ? { message: "Storage denied" } : null,
    };
  });
  const rpc = vi.fn(async (name: string, args?: { document?: Article }) => {
    if (name === "is_editor") return { data: true, error: null };
    if (name === "save_article") return { data: args?.document, error: null };
    throw new Error("Unexpected RPC");
  });
  const client = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "editor" } },
        error: null,
      })),
    },
    rpc,
    storage: { from: vi.fn(() => ({ createSignedUrl })) },
    from: vi.fn((table: string) => {
      if (!content[table]) throw new Error("Unexpected table");
      const filters: { column: string; value: unknown }[] = [];
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters.push({ column, value });
          calls.push({ table, column, value });
          return query;
        },
        order: async () => ({
          data: content[table].filter((item) =>
            filters.every(
              ({ column, value }) =>
                (item as Record<string, unknown>)[column] === value,
            ),
          ),
          error:
            errorTable === table ? { message: "Database unavailable" } : null,
        }),
      };
      return query;
    }),
  } as unknown as SupabaseClient;
  return { client, calls, createSignedUrl, rpc };
}

describe("Available readings survive optional cover failures", () => {
  test.each(["error", "throw", "missing-data"] as const)(
    "a %s signing failure affects only its cover, not the catalogue",
    async (coverFailure) => {
      const { client, createSignedUrl, calls } = fixture({ coverFailure });
      const result = await loadPublicContent(client);
      expect(result.articles).toEqual([
        { ...first, imageUrl: "" },
        {
          ...second,
          imageUrl: "https://images.example.invalid/signed/healthy.png",
        },
        third,
      ]);
      expect(result.checklists).toHaveLength(1);
      expect(result.categories).toEqual(categories);
      expect(createSignedUrl).toHaveBeenCalledTimes(2);
      for (const table of ["articles", "checklists"])
        expect(calls.filter((call) => call.table === table)).toEqual([
          { table, column: "status", value: "published" },
          { table, column: "approved", value: true },
          { table, column: "is_demo", value: false },
        ]);
    },
  );

  test("editing retains an unavailable image and saving does not erase its reference", async () => {
    const { client, rpc } = fixture();
    const result = await loadEditorialContent(client);
    expect(result.articles[0].imageUrl).toBe(first.imageUrl);
    expect(result.articles).toHaveLength(4);
    const saved = await saveArticle(client, {
      ...result.articles[0],
      title: "Titolo modificato dalla professionista",
    });
    expect(saved.imageUrl).toBe(first.imageUrl);
    const write = rpc.mock.calls.find(([name]) => name === "save_article");
    expect(write?.[1]?.document?.imageUrl).toBe(first.imageUrl);
  });

  test.each(["articles", "checklists", "article_categories"])(
    "a real %s query error still rejects instead of inventing demo content",
    async (errorTable) => {
      const { client, createSignedUrl } = fixture({ errorTable });
      await expect(loadPublicContent(client)).rejects.toThrow(
        "Database unavailable",
      );
      expect(createSignedUrl).not.toHaveBeenCalled();
    },
  );
});
