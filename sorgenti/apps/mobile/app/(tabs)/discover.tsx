import React, { useState } from "react";
import { TextInput, Text, View, Pressable } from "react-native";
import { filterArticles, type Stage } from "@nido/core";
import { useApp } from "../../src/state";
import {
  ArticleGrid,
  ContentStatus,
  EmptyState,
  Notice,
  Screen,
  ui,
} from "../../src/ui";
export default function Discover() {
  const { articles, categories, demo, contentLoading, contentError } = useApp();
  const [query, setQuery] = useState("");
  const [categoryId, setCategory] = useState("all");
  const [stage, setStage] = useState<Stage>("all");
  const result = filterArticles(articles, { query, categoryId, stage });
  return (
    <Screen
      eyebrow="SCOPRI"
      title="Le parole giuste, al momento giusto."
      subtitle="Una biblioteca da esplorare con i tuoi tempi."
    >
      <TextInput
        accessibilityLabel="Cerca un articolo"
        placeholder="Cerca un argomento, una domanda…"
        style={ui.input}
        value={query}
        onChangeText={setQuery}
      />
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 9,
          marginVertical: 18,
        }}
      >
        {(
          [
            ["all", "Tutti i percorsi"],
            ["pregnancy", "Gravidanza"],
            ["postpartum", "Dopo la nascita"],
          ] as const
        ).map(([id, label]) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            aria-pressed={stage === id}
            onPress={() => setStage(id)}
            style={[ui.pill, stage === id && ui.pillActive]}
          >
            <Text style={[ui.pillText, stage === id && ui.pillTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 9,
          marginBottom: 22,
        }}
      >
        {[{ id: "all", name: "Tutti gli argomenti" }, ...categories].map(
          (category) => (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              accessibilityLabel={`Categoria: ${category.name}`}
              aria-pressed={categoryId === category.id}
              onPress={() => setCategory(category.id)}
              style={[ui.pill, categoryId === category.id && ui.pillActive]}
            >
              <Text
                style={[
                  ui.pillText,
                  categoryId === category.id && ui.pillTextActive,
                ]}
              >
                {category.name}
              </Text>
            </Pressable>
          ),
        )}
      </View>
      <ContentStatus />
      <ArticleGrid items={result} />
      {!result.length && !contentLoading && !contentError && (
        <EmptyState
          title="Una lettura ti aspetta"
          text="Nessuna lettura corrisponde alla ricerca. Prova con un’altra parola o esplora tutti gli argomenti."
          action="Mostra tutto"
          onPress={() => {
            setQuery("");
            setCategory("all");
            setStage("all");
          }}
        />
      )}
      {demo && (
        <Notice warm>
          Le letture di questa demo sono esempi editoriali, non ancora
          revisionati da un professionista sanitario. Le fonti indicate sono
          spunti di approfondimento.
        </Notice>
      )}
    </Screen>
  );
}
