import React from "react";
import { Text, View, Pressable, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { calculateJourney, recommendArticles, disclaimer } from "@nido/core";
import { useApp } from "../../src/state";
import {
  ArticleGrid,
  Button,
  ContentStatus,
  Notice,
  Screen,
  SectionHeader,
  Tag,
  ui,
} from "../../src/ui";
import { NestArt } from "../../src/art";
import { colors, serif } from "../../src/theme";
export default function Home() {
  const { state, articles, checklists } = useApp();
  const { width } = useWindowDimensions();
  const journey = calculateJourney(state.preferences);
  const postpartum = state.preferences.journey === "postpartum";
  const next =
    checklists.find((c) => c.stage === journey.stage) ?? checklists[0];
  return (
    <Screen
      eyebrow="IL MIO PERCORSO"
      title="Ogni nuovo inizio, insieme."
      subtitle="Ciao! Oggi facciamo un altro passo insieme."
    >
      <View
        style={{
          backgroundColor: "#EDEEE4",
          borderRadius: 25,
          overflow: "hidden",
          flexDirection: width > 680 ? "row" : "column",
        }}
      >
        <View style={{ padding: 30, flex: 1, gap: 18 }}>
          <Tag>
            {postpartum
              ? "IL TEMPO DEI PRIMI INCONTRI"
              : "UN GIORNO ALLA VOLTA"}
          </Tag>
          <Text
            style={{
              fontFamily: serif,
              fontSize: 35,
              lineHeight: 43,
              color: colors.ink,
            }}
          >
            {postpartum
              ? "Cresce una nuova vita.\nE nasci anche tu."
              : "C’è un piccolo mondo\nche cresce con te."}
          </Text>
          <Text style={ui.body}>
            Uno spazio per informarti, prepararti e ascoltarti. Con delicatezza,
            senza fretta e senza aspettative.
          </Text>
          <Button
            onPress={() => router.navigate("/(tabs)/discover")}
            icon="arrow"
          >
            Esplora il tuo percorso
          </Button>
        </View>
        <NestArt
          variant={postpartum ? 1 : 0}
          style={{ width: width > 680 ? "45%" : "100%", height: 240 }}
        />
      </View>
      <View
        style={[
          ui.card,
          { marginTop: 20, gap: 8, backgroundColor: colors.sagePale },
        ]}
      >
        <Text style={ui.heading}>{journey.label}</Text>
        <Text style={ui.body}>{journey.description}</Text>
        <Button variant="quiet" onPress={() => router.push("/welcome?edit=1")}>
          Personalizza il tuo percorso
        </Button>
      </View>
      <SectionHeader
        title={
          journey.week !== null && !postpartum
            ? `Una lettura per la settimana ${journey.week}`
            : postpartum
              ? "Per questi primi giorni"
              : "Piccole letture, nuove consapevolezze"
        }
        action="Scopri tutto"
        onPress={() => router.navigate("/(tabs)/discover")}
      />
      <ContentStatus />
      <ArticleGrid
        items={recommendArticles(articles, state.preferences).slice(0, 3)}
      />
      {next && (
        <>
          <SectionHeader title="Un pensiero in meno" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={next.title}
            style={[ui.card, { gap: 10 }]}
            onPress={() =>
              router.push({
                pathname: "/checklist/[id]",
                params: { id: next.id },
              })
            }
          >
            <Text style={ui.heading}>{next.title}</Text>
            <Text style={ui.body}>
              Suggerimenti da adattare alla tua famiglia.
            </Text>
            <Text style={ui.body}>
              {next.items.filter((i) => state.progress[i.id]).length} di{" "}
              {next.items.length} suggerimenti completati
            </Text>
          </Pressable>
        </>
      )}
      <View style={{ paddingVertical: 40 }}>
        <Text
          style={[ui.heading, { textAlign: "center", fontStyle: "italic" }]}
        >
          {
            "Non esiste un modo perfetto.\nEsiste il vostro modo, da scoprire insieme."
          }
        </Text>
      </View>
      <Notice>{disclaimer}</Notice>
    </Screen>
  );
}
