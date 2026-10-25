import { Text } from "../../src/typography";
import React from "react";
import { View, Pressable } from "react-native";
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
  Progress,
  ui,
} from "../../src/ui";
import { Icon } from "../../src/icons";
import { colors } from "../../src/theme";
export default function Home() {
  const { state, articles, checklists, email, memberProfile } = useApp();
  const journey = calculateJourney(state.preferences);
  const next =
    checklists.find((c) => c.stage === journey.stage) ?? checklists[0];
  return (
    <Screen
      eyebrow="IL MIO PERCORSO"
      title={
        email
          ? memberProfile?.nickname
            ? `Ciao, ${memberProfile.nickname}.`
            : "Bentornata nel tuo spazio."
          : "Ogni nuovo inizio, insieme."
      }
      subtitle="Ciao! Oggi facciamo un altro passo insieme."
    >
      <View
        style={[
          ui.card,
          { gap: 12, backgroundColor: colors.sagePale, marginBottom: 18 },
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <Text style={ui.heading}>{journey.label}</Text>
          <Icon name="leaf" size={32} />
        </View>
        <Text style={ui.body}>{journey.description}</Text>
        <Button
          variant="secondary"
          onPress={() => router.push("/welcome?edit=1")}
        >
          Personalizza il tuo percorso
        </Button>
        {email && (
          <Button variant="quiet" onPress={() => router.push("/profile")}>
            La mia scheda per Gaia
          </Button>
        )}
      </View>
      <View style={[ui.card, { gap: 12, backgroundColor: colors.peach }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon name="shop" size={28} />
          <Text style={ui.heading}>Consigli d’acquisto</Text>
        </View>
        <Text style={ui.body}>
          Una selezione di prodotti su Amazon per la quotidianità in famiglia.
          Prezzi, disponibilità e condizioni di acquisto sono indicati su
          Amazon.
        </Text>
        <Button variant="secondary" onPress={() => router.navigate("/shop")}>
          Scopri i consigli d’acquisto
        </Button>
      </View>
      <View
        style={{
          flexDirection: "row",
          gap: 12,
          marginVertical: 18,
          flexWrap: "wrap",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Le tue letture"
          onPress={() => router.push("/saved")}
          style={({ pressed }) => [
            ui.card,
            {
              flex: 1,
              minWidth: 130,
              padding: 18,
              gap: 12,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Icon name="bookmark" />
          <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 16 }}>
            Le tue letture
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
            I tuoi contenuti preferiti, sempre con te.
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Le tue checklist"
          onPress={() => router.push("/(tabs)/checklists")}
          style={({ pressed }) => [
            ui.card,
            {
              flex: 1,
              minWidth: 130,
              padding: 18,
              gap: 12,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Icon name="checklist" />
          <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 16 }}>
            Le tue checklist
          </Text>
          {next ? (
            <Progress
              completed={next.items.filter((i) => state.progress[i.id]).length}
              total={next.items.length}
            />
          ) : (
            <Text style={ui.body}>Un piccolo passo alla volta.</Text>
          )}
        </Pressable>
      </View>
      <View style={[ui.card, { gap: 14, borderColor: colors.sage }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Icon name="mail" size={28} />
          <Text style={[ui.heading, { flex: 1, fontSize: 25 }]}>
            Dott.sa Gaia
          </Text>
        </View>
        <Text style={ui.body}>
          Per informazioni sui servizi e richieste di disponibilità, scrivi a
          Gaia via email.
        </Text>
        <Button onPress={() => router.push("/contatti")} icon="arrow">
          Contatta Gaia via email
        </Button>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
          Le risposte non sono immediate. Per urgenze contatta i servizi di
          emergenza.
        </Text>
      </View>
      {!email && (
        <View style={{ marginTop: 16 }}>
          <Button variant="quiet" onPress={() => router.push("/account")}>
            Crea account o accedi
          </Button>
        </View>
      )}
      <SectionHeader
        title={
          journey.week !== null && state.preferences.journey !== "postpartum"
            ? `Una lettura per la settimana ${journey.week}`
            : "Consigliato per te"
        }
        action="Scopri tutto"
        onPress={() => router.navigate("/(tabs)/discover")}
      />
      <Button variant="secondary" onPress={() => router.push("/prenota")}>
        Prepara una richiesta via email
      </Button>
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
            style={[ui.card, { gap: 12 }]}
            onPress={() =>
              router.push({
                pathname: "/checklist",
                params: { id: next.id },
              })
            }
          >
            <Text style={ui.heading}>{next.title}</Text>
            <Text style={ui.body}>
              Suggerimenti da adattare alla tua famiglia.
            </Text>
            <Progress
              completed={next.items.filter((i) => state.progress[i.id]).length}
              total={next.items.length}
            />
            <View style={[ui.row, { justifyContent: "space-between" }]}>
              <Text style={{ color: colors.sageDark, fontWeight: "600" }}>
                Apri checklist
              </Text>
              <Icon name="arrow" />
            </View>
          </Pressable>
        </>
      )}
      <View style={{ marginTop: 24 }}>
        <Notice>{disclaimer}</Notice>
      </View>
    </Screen>
  );
}
