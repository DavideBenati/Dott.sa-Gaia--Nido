import { Text } from "../../src/typography";
import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { calculateJourney, recommendArticles, disclaimer } from "@nido/core";
import { useApp } from "../../src/state";
import {
  ArticleCard,
  Button,
  ContentStatus,
  Screen,
  Progress,
  ui,
} from "../../src/ui";
import { Icon } from "../../src/icons";
import { colors } from "../../src/theme";
import { usePwa } from "../../src/pwa";
import { selectHomeChecklist } from "../../src/home-checklist";
import { checklistSummary } from "../../src/share-content";

export default function Home() {
  const {
    state,
    articles,
    checklists,
    email,
    memberProfile,
    personalizedPreferences,
    pregnancyProfile,
    contentLoading,
    contentError,
  } = useApp();
  const { standalone } = usePwa();
  const [showMore, setShowMore] = useState(false);
  const journey = calculateJourney(personalizedPreferences);
  const next = selectHomeChecklist(checklists, state.progress, journey.stage);
  const nextSummary = next ? checklistSummary(next, state.progress) : null;
  const reading = recommendArticles(
    articles,
    personalizedPreferences,
    new Date(),
    pregnancyProfile,
  )[0];

  return (
    <Screen
      compactFooter
      style={{ maxWidth: 840 }}
      eyebrow="IL MIO PERCORSO"
      title={
        email
          ? memberProfile?.nickname
            ? `Ciao, ${memberProfile.nickname}.`
            : "Il tuo spazio, con Gaia."
          : "Ogni nuovo inizio, insieme."
      }
      subtitle="I tuoi materiali e un piccolo passo alla volta."
    >
      <View style={{ gap: 16 }}>
        {email && (
          <View style={[ui.card, { padding: 18, gap: 10 }]}>
            <View style={[ui.row, { alignItems: "flex-start" }]}>
              <Icon name="lock" size={26} />
              <Text style={[ui.heading, { flex: 1 }]}>I miei documenti</Text>
            </View>
            <Text style={ui.body}>
              I materiali che Gaia ha condiviso con te.
            </Text>
            <Button onPress={() => router.push("/miei-documenti")}>
              Apri i miei documenti
            </Button>
          </View>
        )}
        <ContentStatus />
        {next && nextSummary && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={next.title}
            onPress={() =>
              router.push({ pathname: "/checklist", params: { id: next.id } })
            }
            style={[ui.card, { padding: 18, gap: 9 }]}
          >
            <Text style={ui.label}>
              {nextSummary.complete
                ? "IL TUO TRAGUARDO"
                : nextSummary.completed > 0
                  ? "RIPRENDI DA QUI"
                  : "UNA CHECKLIST PER TE"}
            </Text>
            <Text style={[ui.heading, { fontSize: 24, lineHeight: 30 }]}>
              {next.title}
            </Text>
            <Progress
              completed={nextSummary.completed}
              total={nextSummary.total}
            />
            <View style={[ui.row, { justifyContent: "space-between" }]}>
              <Text style={{ color: colors.sageDark, fontWeight: "600" }}>
                {nextSummary.complete
                  ? "Rivedi checklist"
                  : nextSummary.completed > 0
                    ? "Riprendi checklist"
                    : "Apri checklist"}
              </Text>
              <Icon name="arrow" />
            </View>
          </Pressable>
        )}
        <View style={{ gap: 10 }}>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              columnGap: 12,
            }}
          >
            <Text
              accessibilityRole="header"
              style={[ui.heading, { fontSize: 22, lineHeight: 28 }]}
            >
              Una lettura per te
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate("/(tabs)/discover")}
              style={{
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Text
                style={{
                  color: colors.sageDark,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                Tutte le letture
              </Text>
              <Icon name="arrow" size={16} />
            </Pressable>
          </View>
          {reading ? (
            <ArticleCard
              article={reading}
              compact
              style={{ maxWidth: "100%", height: "auto" }}
            />
          ) : !contentLoading && !contentError ? (
            <Text style={ui.body}>
              Le letture compariranno qui quando saranno disponibili.
            </Text>
          ) : null}
        </View>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            columnGap: 22,
            rowGap: 2,
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/saved")}
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
            }}
          >
            <Icon name="bookmark" size={18} />
            <Text
              style={{
                color: colors.sageDark,
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              Letture salvate
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(tabs)/checklists")}
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
            }}
          >
            <Icon name="checklist" size={18} />
            <Text
              style={{
                color: colors.sageDark,
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              Tutte le checklist
            </Text>
          </Pressable>
        </View>
        {!email && (
          <Button variant="secondary" onPress={() => router.push("/account")}>
            Crea account o accedi
          </Button>
        )}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: 4,
          }}
        >
          <Pressable
            accessibilityRole="button"
            aria-expanded={showMore}
            onPress={() => setShowMore((value) => !value)}
            style={{
              minHeight: 48,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text
              style={{
                color: colors.sageDark,
                fontSize: 16,
                fontWeight: "600",
              }}
            >
              Altre opzioni
            </Text>
            <Icon name={showMore ? "close" : "arrow"} size={18} />
          </Pressable>
          {showMore && (
            <View style={{ gap: 8, paddingTop: 10 }}>
              <Text style={[ui.label, { marginBottom: 0 }]}>
                {journey.label}
              </Text>
              <Text style={ui.body}>{journey.description}</Text>
              <Button
                variant="quiet"
                onPress={() => router.push("/welcome?edit=1")}
              >
                Personalizza il tuo percorso
              </Button>
              {email && (
                <>
                  <Button
                    variant="quiet"
                    onPress={() => router.push("/profile")}
                  >
                    La mia scheda per Gaia
                  </Button>
                  <Button
                    variant="quiet"
                    onPress={() => router.push("/traguardi")}
                  >
                    I miei traguardi
                  </Button>
                </>
              )}
              <Button variant="quiet" onPress={() => router.push("/contatti")}>
                Contatta Gaia via email
              </Button>
              <Button variant="quiet" onPress={() => router.push("/prenota")}>
                Prepara una richiesta via email
              </Button>
              <Button variant="quiet" onPress={() => router.navigate("/shop")}>
                Scopri i consigli d’acquisto
              </Button>
              {!standalone && (
                <Button
                  variant="quiet"
                  onPress={() => router.push("/installa")}
                >
                  MAIA sul tuo telefono
                </Button>
              )}
            </View>
          )}
        </View>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
          {disclaimer}
        </Text>
      </View>
    </Screen>
  );
}
