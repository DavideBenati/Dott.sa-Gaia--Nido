import React from "react";
import { router } from "expo-router";
import { useApp } from "../src/state";
import { Screen, ArticleGrid, ContentStatus, EmptyState } from "../src/ui";
export default function Saved() {
  const { state, articles, contentLoading, contentError } = useApp();
  const items = articles.filter((a) => state.favorites.includes(a.id));
  return (
    <Screen
      back
      eyebrow="DA RITROVARE"
      title="Letture salvate"
      subtitle="Gli articoli che hai scelto di conservare, per ritrovarli con calma."
    >
      <ContentStatus />
      {!contentLoading &&
        !contentError &&
        (items.length ? (
          <ArticleGrid items={items} />
        ) : (
          <EmptyState
            title={
              state.favorites.length
                ? "Le letture salvate non sono disponibili"
                : "Non hai ancora salvato letture"
            }
            text={
              state.favorites.length
                ? "Qui compaiono le letture conservate che sono ancora disponibili nella biblioteca. Puoi esplorare gli altri argomenti."
                : "Apri un articolo negli Argomenti e scegli Conserva questa lettura: lo ritroverai qui."
            }
            action="Esplora gli Argomenti"
            onPress={() => router.navigate("/(tabs)/discover")}
          />
        ))}
    </Screen>
  );
}
