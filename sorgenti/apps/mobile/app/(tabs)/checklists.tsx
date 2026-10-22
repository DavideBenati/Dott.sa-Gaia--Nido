import React from "react";
import { View, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { useApp } from "../../src/state";
import { ContentStatus, EmptyState, Notice, Screen, ui } from "../../src/ui";
export default function Checklists() {
  const { checklists, state, contentLoading, contentError } = useApp();
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
      <ContentStatus />
      <View style={{ gap: 18, marginTop: 24 }}>
        {checklists.map((checklist) => (
          <Pressable
            key={checklist.id}
            accessibilityRole="button"
            accessibilityLabel={checklist.title}
            style={[ui.card, { gap: 12 }]}
            onPress={() =>
              router.push({
                pathname: "/checklist/[id]",
                params: { id: checklist.id },
              })
            }
          >
            <Text style={ui.heading}>{checklist.title}</Text>
            <Text style={ui.body}>{checklist.description}</Text>
            <Text style={ui.body}>
              {checklist.items.filter((i) => state.progress[i.id]).length} di{" "}
              {checklist.items.length} completati
            </Text>
          </Pressable>
        ))}
      </View>
      {!checklists.length && !contentLoading && !contentError && (
        <EmptyState
          title="Presto, nuovi piccoli passi"
          text="Le checklist appariranno dopo la revisione e la pubblicazione."
        />
      )}
    </Screen>
  );
}
