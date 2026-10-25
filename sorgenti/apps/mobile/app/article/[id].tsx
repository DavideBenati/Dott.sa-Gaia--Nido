import { usePageMetadata } from "../../src/seo";
import { Text } from "../../src/typography";
import React from "react";
import { View, Linking } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { disclaimer } from "@nido/core";
import { useApp } from "../../src/state";
import { Screen, Notice, Button, EmptyState, ui } from "../../src/ui";
import { ArticleCover } from "../../src/art";
import { contentLink } from "../../src/share-content";
import { ShareContentButton } from "../../src/share-content-button";
export default function Article() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { articles, categories, state, toggleFavorite } = useApp();
  const article = articles.find((a) => a.id === id);
  usePageMetadata(
    article
      ? {
          id: article.id,
          title: article.title,
          subtitle: article.subtitle,
          published:
            article.status === "published" &&
            article.approved &&
            !article.isDemo,
        }
      : undefined,
  );
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
      <View
        style={{
          gap: 30,
          marginVertical: 30,
          width: "100%",
          maxWidth: 720,
          alignSelf: "center",
        }}
      >
        {article.sections.map((section, index) => (
          <View key={index} style={{ gap: 14 }}>
            <Text accessibilityRole="header" style={ui.heading}>
              {section.heading}
            </Text>
            {section.paragraphs.map((paragraph, i) => (
              <Text
                key={i}
                style={[ui.body, { fontSize: 17, lineHeight: 29 }]}
                selectable
              >
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
        {saved ? "Salvato in MAIA" : "Conserva questa lettura"}
      </Button>
      <View style={{ marginTop: 12 }}>
        <ShareContentButton
          label="Condividi questa lettura"
          content={{
            title: `${article.title} · metiMaia`,
            text: `${article.title}\n${article.subtitle}`,
            url: contentLink("/article", { id: article.id }),
          }}
        />
      </View>
      <Notice>{disclaimer}</Notice>
    </Screen>
  );
}
