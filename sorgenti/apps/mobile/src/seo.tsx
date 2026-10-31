import { useEffect } from "react";
import { Platform } from "react-native";
import { usePathname } from "expo-router";
import { publicProfessionalText } from "@nido/core";
import metadata from "./page-metadata.json";
const site = "https://metimaia.com";
type Metadata = {
  title: string;
  description: string;
  index: boolean;
  canonical?: string;
};
export function pageSchema({
  title,
  description,
  canonical,
  index,
}: Metadata & { canonical: string }) {
  const url = site + canonical;
  const pageTypes: Record<string, string> = {
    "/discover": "CollectionPage",
    "/checklists": "CollectionPage",
    "/gaia": "AboutPage",
    "/contatti": "ContactPage",
    "/prenota": "ContactPage",
  };
  const pageType = pageTypes[canonical];
  const home = site + "/welcome";
  const breadcrumb = index && url !== home;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": site + "/#website",
        url: site,
        name: "metiMaia",
        inLanguage: "it-IT",
        publisher: { "@id": site + "/#gaia" },
      },
      {
        "@type": "Person",
        "@id": site + "/#gaia",
        name: "Dott.sa Gaia",
        jobTitle: "Ostetrica",
        email: "ostetricamaia@gmail.com",
        url: home,
      },
      ...(index
        ? [
            {
              "@type": pageType ?? "WebPage",
              "@id": url + "#webpage",
              url,
              name: publicProfessionalText(title),
              description: publicProfessionalText(description),
              inLanguage: "it-IT",
              isPartOf: { "@id": site + "/#website" },
              ...(breadcrumb
                ? { breadcrumb: { "@id": url + "#breadcrumb" } }
                : {}),
            },
          ]
        : []),
      ...(breadcrumb
        ? [
            {
              "@type": "BreadcrumbList",
              "@id": url + "#breadcrumb",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "metiMaia",
                  item: home,
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: publicProfessionalText(title).replace(
                    /\s*\|\s*metiMaia$/i,
                    "",
                  ),
                  item: url,
                },
              ],
            },
          ]
        : []),
    ],
  };
}
export function usePageMetadata(article?: {
  id: string;
  title: string;
  subtitle: string;
  published: boolean;
}) {
  const pathname = usePathname();
  const activeArticle =
    article && (pathname === "/article" || pathname.startsWith("/article/"))
      ? article
      : undefined;
  const entry = (metadata as Record<string, Metadata>)[pathname];
  const title = publicProfessionalText(
    activeArticle
      ? `${activeArticle.title} | metiMaia`
      : (entry?.title ?? "metiMaia"),
  );
  const description = publicProfessionalText(
    activeArticle?.subtitle ||
      entry?.description ||
      "Uno spazio per il tuo percorso, con la Dott.sa Gaia.",
  );
  const index = activeArticle
    ? activeArticle.published
    : (entry?.index ?? false);
  const canonical = activeArticle
    ? `/article?id=${encodeURIComponent(activeArticle.id)}`
    : (entry?.canonical ?? pathname);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    document.title = title;
    const setMeta = (key: string, content: string, property = false) => {
      const attr = property ? "property" : "name";
      let element = document.head.querySelector<HTMLMetaElement>(
        `meta[${attr}="${key}"]`,
      );
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attr, key);
        document.head.appendChild(element);
      }
      element.content = content;
    };
    setMeta("description", description);
    setMeta("robots", index ? "index,follow" : "noindex,nofollow");
    setMeta("og:title", title, true);
    setMeta("og:description", description, true);
    setMeta("og:url", site + canonical, true);
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    let link = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = site + canonical;
    let structuredData = document.head.querySelector<HTMLScriptElement>(
      "script#metimaia-page-schema",
    );
    if (!structuredData) {
      structuredData = document.createElement("script");
      structuredData.id = "metimaia-page-schema";
      structuredData.type = "application/ld+json";
      document.head.appendChild(structuredData);
    }
    structuredData.textContent = JSON.stringify(
      pageSchema({ title, description, canonical, index }),
    ).replaceAll("<", "\\u003c");
    document.documentElement.lang = "it";
  }, [title, description, index, canonical]);
}
