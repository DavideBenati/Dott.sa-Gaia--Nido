import React from "react";
import { View, Text, Linking } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { disclaimer } from "@nido/core";
import { useApp } from "../../src/state";
import { Screen, Notice, Button, EmptyState, ui } from "../../src/ui";
import { ArticleCover } from "../../src/art";
export default function Article() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { articles, categories, state, toggleFavorite } = useApp();
  const article = articles.find((a) => a.id === id);
  if (!article)
    return (
      <Screen back>
        <EmptyState
          title="Lettura non disponibile"
          text="Questo articolo potrebbe non essere più pubblicato."
        />
      </Screen>
    );
  const saved = state.favorites.includes(article.id);
  return (
    <Screen
      back
      eyebrow={categories.find((c) => c.id === article.categoryId)?.name}
      title={article.title}
      subtitle={article.subtitle}
    >
      <ArticleCover
        uri={article.imageUrl}
        demo={article.isDemo}
        variant={1}
        style={{ height: 260, borderRadius: 22 }}
      />
      <View style={{ gap: 10, marginVertical: 20 }}>
        <Text style={ui.label}>{article.authorName}</Text>
        <Text style={ui.body}>
          {article.authorRole} · {article.readingMinutes} min di lettura
        </Text>
        <Text style={ui.body}>
          Pubblicazione:{" "}
          {article.publishedAt
            ? new Date(article.publishedAt).toLocaleDateString("it-IT")
            : "Da definire"}
        </Text>
        <Text style={ui.body}>
          Ultima revisione clinica:{" "}
          {article.reviewedAt
            ? `${article.reviewedAt} · ${article.reviewerName}`
            : "Non ancora effettuata"}
        </Text>
      </View>
      {article.isDemo && (
        <Notice warm>
          CONTENUTO DIMOSTRATIVO · Questo testo è un esempio editoriale e non ha
          ricevuto una revisione clinica.
        </Notice>
      )}
      <View style={{ gap: 28, marginVertical: 30 }}>
        {article.sections.map((section, index) => (
          <View key={index} style={{ gap: 14 }}>
            <Text accessibilityRole="header" style={ui.heading}>
              {section.heading}
            </Text>
            {section.paragraphs.map((paragraph, i) => (
              <Text key={i} style={ui.body} selectable>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </View>
      {article.references.length > 0 && (
        <>
          <Text style={ui.heading}>Fonti e approfondimenti</Text>
          {article.references.map((ref, index) => (
            <Button
              key={index}
              variant="quiet"
              onPress={() => {
                if (ref.url.startsWith("https://"))
                  void Linking.openURL(ref.url);
              }}
            >
              {ref.label}
            </Button>
          ))}
        </>
      )}
      {article.videoUrl && (
        <Button
          variant="quiet"
          onPress={() => {
            if (article.videoUrl?.startsWith("https://"))
              void Linking.openURL(article.videoUrl);
          }}
        >
          Guarda il video
        </Button>
      )}
      <Button
        icon="bookmark"
        accessibilityLabel={saved ? "Rimuovi dai salvati" : "Salva articolo"}
        onPress={() => {
          void toggleFavorite(article.id).catch(() => {});
        }}
      >
        {saved ? "Salvato nel tuo Nido" : "Conserva questa lettura"}
      </Button>
      <Notice>{disclaimer}</Notice>
    </Screen>
  );
}
