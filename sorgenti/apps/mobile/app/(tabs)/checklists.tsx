import { Text } from "../../src/typography";
import React, { useState } from "react";
import { type Stage, normalizeSearch } from "@nido/core";
import { TextInput } from "../../src/typography";
import { View, Pressable, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { useApp } from "../../src/state";
import {
  Button,
  ContentStatus,
  EmptyState,
  Notice,
  Progress,
  Screen,
  ui,
} from "../../src/ui";
export default function Checklists() {
  const { checklists, state, contentLoading, contentError } = useApp();
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<Stage>("all");
  const visible = checklists.filter(
    (item) =>
      (stage === "all" || item.stage === "all" || item.stage === stage) &&
      normalizeSearch(
        `${item.title} ${item.description} ${item.items.map((i) => i.label).join(" ")}`,
      ).includes(normalizeSearch(query)),
  );
  return (
    <Screen
      eyebrow="CHECKLIST"
      title="Un piccolo passo alla volta."
      subtitle="Per alleggerire i pensieri e fare spazio a ciò che conta."
    >
      <Notice>
        Queste liste sono suggerimenti adattabili, non requisiti medici. Le
        indicazioni della struttura e del tuo professionista sanitario hanno la
        precedenza.
      </Notice>
      <View style={{ gap: 12, marginTop: 20 }}>
        <TextInput
          accessibilityLabel="Cerca una checklist"
          placeholder="Cerca una checklist o un’attività…"
          value={query}
          onChangeText={setQuery}
          style={ui.input}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(
            [
              ["all", "Tutte le checklist"],
              ["pregnancy", "Gravidanza"],
              ["postpartum", "Dopo la nascita"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              aria-pressed={stage === value}
              onPress={() => setStage(value)}
              style={[ui.pill, stage === value && ui.pillActive]}
            >
              <Text style={[ui.pillText, stage === value && ui.pillTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {(query || stage !== "all") && (
          <Button
            variant="quiet"
            onPress={() => {
              setQuery("");
              setStage("all");
            }}
          >
            Azzera ricerca checklist
          </Button>
        )}
      </View>
      <ContentStatus />
      <View style={{ gap: 18, marginTop: 24 }}>
        {visible.map((checklist) => (
          <Link
            key={checklist.id}
            href={{ pathname: "/checklist", params: { id: checklist.id } }}
            asChild
          >
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={checklist.title}
              style={StyleSheet.flatten([ui.card, { gap: 12 }])}
            >
              <Text style={ui.heading}>{checklist.title}</Text>
              <Text style={ui.body}>{checklist.description}</Text>
              <Progress
                completed={
                  checklist.items.filter((i) => state.progress[i.id]).length
                }
                total={checklist.items.length}
              />
            </Pressable>
          </Link>
        ))}
      </View>
      {!visible.length &&
        checklists.length > 0 &&
        !contentLoading &&
        !contentError && (
          <Notice>
            Nessuna checklist corrisponde alla ricerca. Cambia parola o azzera i
            filtri.
          </Notice>
        )}
      {!checklists.length && !contentLoading && !contentError && (
        <EmptyState
          title="Presto, nuovi piccoli passi"
          text="Le checklist appariranno dopo la revisione e la pubblicazione."
        />
      )}
    </Screen>
  );
}
