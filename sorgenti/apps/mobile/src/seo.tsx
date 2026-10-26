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
    document.documentElement.lang = "it";
  }, [title, description, index, canonical]);
}
