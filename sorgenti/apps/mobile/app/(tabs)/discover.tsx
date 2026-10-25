import { TextInput, Text } from "../../src/typography";
import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { filterArticles, type Stage } from "@nido/core";
import { useApp } from "../../src/state";
import {
  ArticleGrid,
  Button,
  ContentStatus,
  EmptyState,
  Notice,
  Screen,
  ui,
} from "../../src/ui";
import { Icon } from "../../src/icons";
import { colors } from "../../src/theme";
import { useLocalSearchParams } from "expo-router";
import { readTopicFilters, topicShare } from "../../src/share-content";
import { ShareContentButton } from "../../src/share-content-button";
export default function Discover() {
  const { articles, categories, demo, contentLoading, contentError } = useApp();
  const params = useLocalSearchParams<{
    query?: string;
    category?: string;
    stage?: string;
    short?: string;
    sort?: string;
  }>();
  const initial = readTopicFilters(params);
  const [query, setQuery] = useState(initial.query);
  const [categoryId, setCategory] = useState(initial.category);
  const [stage, setStage] = useState<Stage | "birth">(initial.stage);
  const [shortOnly, setShortOnly] = useState(initial.short);
  const [sort, setSort] = useState<"recent" | "short" | "title">(initial.sort);
  useEffect(() => {
    const next = readTopicFilters(params);
    setQuery(next.query);
    setCategory(next.category);
    setStage(next.stage);
    setShortOnly(next.short);
    setSort(next.sort);
  }, [params.query, params.category, params.stage, params.short, params.sort]);
  const result = filterArticles(articles, {
    query,
    categoryId,
    stage: stage === "birth" ? "all" : stage,
    birth: stage === "birth",
    maxMinutes: shortOnly ? 5 : undefined,
  }).sort((a, b) =>
    sort === "short"
      ? a.readingMinutes - b.readingMinutes
      : sort === "title"
        ? a.title.localeCompare(b.title, "it")
        : (Date.parse(b.reviewedAt || b.publishedAt || "") || 0) -
          (Date.parse(a.reviewedAt || a.publishedAt || "") || 0),
  );
  const filtered = Boolean(
    query ||
    categoryId !== "all" ||
    stage !== "all" ||
    shortOnly ||
    sort !== "recent",
  );
  function resetFilters() {
    setQuery("");
    setCategory("all");
    setStage("all");
    setShortOnly(false);
    setSort("recent");
  }
  return (
    <Screen
      eyebrow="ARGOMENTI"
      title="Le parole giuste, al momento giusto."
      subtitle="Una biblioteca da esplorare con i tuoi tempi."
    >
      <View style={[ui.card, { padding: 16, gap: 12, marginBottom: 4 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Icon name="search" />
          <TextInput
            accessibilityLabel="Cerca un articolo"
            placeholder="Cerca un argomento, una domanda…"
            style={[ui.input, { flex: 1, minWidth: 0 }]}
            returnKeyType="search"
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancella ricerca"
              onPress={() => setQuery("")}
              style={{
                minWidth: 44,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="close" />
            </Pressable>
          )}
        </View>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
          Cerca per parola chiave oppure scegli percorso e argomento.
        </Text>
      </View>
      <Text accessibilityRole="header" style={[ui.label, { marginTop: 20 }]}>
        Il tuo percorso
      </Text>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 9,
          marginBottom: 18,
        }}
      >
        {(
          [
            ["all", "Tutti i percorsi"],
            ["pregnancy", "Gravidanza"],
            ["birth", "Nascita"],
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
      <Text accessibilityRole="header" style={ui.label}>
        Argomenti
      </Text>
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
      <View style={{ gap: 10, marginBottom: 20 }}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="Solo letture entro 5 minuti"
          accessibilityState={{ checked: shortOnly }}
          aria-checked={shortOnly}
          onPress={() => setShortOnly(!shortOnly)}
          style={{ paddingVertical: 10 }}
        >
          <Text style={ui.body}>
            {shortOnly ? "☑" : "☐"} Ho poco tempo: letture entro 5 minuti
          </Text>
        </Pressable>
        <Text style={ui.label}>Ordina le letture</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
          {(
            [
              ["recent", "Revisioni più recenti"],
              ["short", "Più brevi"],
              ["title", "Titolo A–Z"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={label}
              aria-pressed={sort === value}
              onPress={() => setSort(value)}
              style={[ui.pill, sort === value && ui.pillActive]}
            >
              <Text style={[ui.pillText, sort === value && ui.pillTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ marginBottom: 18 }}>
        <ShareContentButton
          label={
            categoryId === "all"
              ? "Condividi questi argomenti"
              : "Condividi questo argomento"
          }
          content={topicShare(
            { query, category: categoryId, stage, short: shortOnly, sort },
            categories.find((category) => category.id === categoryId)?.name,
          )}
        />
      </View>
      <ContentStatus />
      {!contentLoading && !contentError && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: colors.muted, fontSize: 14 }}
          >
            {result.length}{" "}
            {result.length === 1
              ? "lettura disponibile"
              : "letture disponibili"}
          </Text>
          {filtered && (
            <Button variant="quiet" onPress={resetFilters}>
              Azzera filtri
            </Button>
          )}
        </View>
      )}
      <ArticleGrid items={result} />
      {!result.length && !contentLoading && !contentError && (
        <EmptyState
          title="Una lettura ti aspetta"
          text="Nessuna lettura corrisponde alla ricerca. Prova con un’altra parola o esplora tutti gli argomenti."
          action="Mostra tutto"
          onPress={() => {
            resetFilters();
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
