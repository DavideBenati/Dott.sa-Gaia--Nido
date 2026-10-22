import React from "react";
import { router } from "expo-router";
import { useApp } from "../src/state";
import { Screen, ArticleGrid, EmptyState } from "../src/ui";
export default function Saved() {
  const { state, articles } = useApp();
  const items = articles.filter((a) => state.favorites.includes(a.id));
  return (
    <Screen back eyebrow="DA RITROVARE" title="Le tue letture, qui per te.">
      {items.length ? (
        <ArticleGrid items={items} />
      ) : (
        <EmptyState
          title="Il tuo Nido cresce con te"
          text="Conserva le letture che vorresti ritrovare."
          action="Esplora la biblioteca"
          onPress={() => router.navigate("/(tabs)/discover")}
        />
      )}
    </Screen>
  );
}
