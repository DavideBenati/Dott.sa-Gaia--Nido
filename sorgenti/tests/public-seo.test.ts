import { expect, test, vi } from "vitest";
// @ts-expect-error The packager is a Node ESM script, shared with the build.
import { metadata, pageHTML } from "../scripts/web-seo.mjs";
import { pageSchema } from "../apps/mobile/src/seo";

vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("expo-router", () => ({ usePathname: () => "/welcome" }));

const html =
  '<!DOCTYPE html><html><head></head><body><div id="root"></div></body></html>';
const schemaFrom = (page: string) =>
  JSON.parse(
    page.match(
      /<script\b[^>]*id="metimaia-page-schema"[^>]*>([\s\S]*?)<\/script>/,
    )![1],
  );

test("public route schema describes real pages and links breadcrumbs to their canonicals", () => {
  for (const [path, type] of [
    ["/discover", "CollectionPage"],
    ["/checklists", "CollectionPage"],
    ["/gaia", "AboutPage"],
    ["/contatti", "ContactPage"],
    ["/prenota", "ContactPage"],
    ["/help", "WebPage"],
  ]) {
    const graph = schemaFrom(pageHTML(html, path))["@graph"];
    const page = graph.find(
      (node: { "@type": string }) => node["@type"] === type,
    );
    expect(page.url).toBe(`https://metimaia.com${path}`);
    expect(page.name).toBe(metadata[path].title);
    expect(page.description).toBe(metadata[path].description);
    expect(page.isPartOf["@id"]).toBe("https://metimaia.com/#website");
    const breadcrumb = graph.find(
      (node: { "@id": string }) => node["@id"] === page.breadcrumb["@id"],
    );
    expect(
      breadcrumb.itemListElement.map((item: { item: string }) => item.item),
    ).toEqual(["https://metimaia.com/welcome", page.url]);
    expect(JSON.stringify(graph)).not.toMatch(
      /"Article"|ratingValue|telephone/,
    );
  }
});

test("the canonical home alias has one page entity and no breadcrumb pointing to itself", () => {
  const root = schemaFrom(pageHTML(html, "/"));
  expect(root).toEqual(schemaFrom(pageHTML(html, "/welcome")));
  expect(
    root["@graph"].map((node: { "@type": string }) => node["@type"]),
  ).toEqual(["WebSite", "Person", "WebPage"]);
  expect(root["@graph"][2]["@id"]).toBe("https://metimaia.com/welcome#webpage");
});

test("SPA and packaged graphs agree for every route and omit private page entities", () => {
  for (const [path, page] of Object.entries(metadata) as [
    string,
    { title: string; description: string; canonical?: string; index: boolean },
  ][]) {
    const graph = schemaFrom(pageHTML(html, path));
    expect(graph).toEqual(
      pageSchema({ ...page, canonical: page.canonical ?? path }),
    );
    if (!page.index) {
      expect(
        graph["@graph"].map((node: { "@type": string }) => node["@type"]),
      ).toEqual(["WebSite", "Person"]);
      expect(JSON.stringify(graph)).not.toContain(
        `https://metimaia.com${path}`,
      );
    }
  }
});

test("repackaging replaces the managed schema while preserving unrelated structured data", () => {
  const unrelated =
    '<script type="application/ld+json">{"@type":"Thing"}</script>';
  const initial = pageHTML(
    html.replace("</head>", unrelated + "</head>"),
    "/gaia",
  );
  const repackaged = pageHTML(initial, "/discover");
  expect(repackaged.match(/id="metimaia-page-schema"/g)).toHaveLength(1);
  expect(repackaged).toContain(unrelated);
  expect(JSON.stringify(schemaFrom(repackaged))).not.toContain("AboutPage");
});

test("runtime article metadata uses the real URL and cannot invent Article claims", () => {
  const graph = pageSchema({
    title: "Una lettura con Gaia Brunetti | metiMaia",
    description: "Un approfondimento pubblicato.",
    canonical: "/article?id=real%2Fidentifier",
    index: true,
  });
  const serialized = JSON.stringify(graph);
  expect(serialized).toContain(
    "https://metimaia.com/article?id=real%2Fidentifier",
  );
  expect(serialized).toContain("WebPage");
  expect(serialized).not.toMatch(/Brunetti|"Article"|datePublished|author/);
});

test("JSON-LD escapes markup without corrupting the truthful page name", () => {
  const original = metadata["/help"];
  try {
    metadata["/help"] = { ...original, title: '</script><p id="injected">' };
    const rendered = pageHTML(html, "/help");
    expect(rendered).not.toContain('</script><p id="injected">');
    expect(schemaFrom(rendered)["@graph"][2].name).toBe(
      '</script><p id="injected">',
    );
  } finally {
    metadata["/help"] = original;
  }
});
