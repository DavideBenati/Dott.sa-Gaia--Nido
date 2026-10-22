import React from "react";
import { View, Text, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useApp } from "../../src/state";
import { Screen, Notice, EmptyState, ui } from "../../src/ui";
import { Icon } from "../../src/icons";
import { colors } from "../../src/theme";
export default function Checklist() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { checklists, state, toggleProgress } = useApp();
  const checklist = checklists.find((c) => c.id === id);
  if (!checklist)
    return (
      <Screen back>
        <EmptyState
          title="Checklist non disponibile"
          text="Questo contenuto potrebbe non essere più pubblicato."
        />
      </Screen>
    );
  const count = checklist.items.filter((i) => state.progress[i.id]).length;
  return (
    <Screen
      back
      eyebrow="PICCOLI PASSI"
      title={checklist.title}
      subtitle={checklist.description}
    >
      <Notice>
        Suggerimenti adattabili, non requisiti medici. Consulta la lista della
        tua struttura e scegli ciò che è utile alla tua famiglia.
        {checklist.isDemo
          ? " Esempio dimostrativo, non ancora revisionato."
          : ""}
      </Notice>
      <Text style={[ui.heading, { marginVertical: 25 }]}>
        {count} di {checklist.items.length} completati
      </Text>
      <View style={[ui.card, { padding: 0, overflow: "hidden" }]}>
        {checklist.items.map((item) => {
          const checked = Boolean(state.progress[item.id]);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="checkbox"
              accessibilityLabel={item.label}
              accessibilityState={{ checked }}
              aria-checked={checked}
              onPress={() => {
                void toggleProgress(item.id).catch(() => {});
              }}
              style={{
                flexDirection: "row",
                gap: 15,
                padding: 22,
                borderBottomWidth: 1,
                borderColor: colors.border,
                minHeight: 70,
              }}
            >
              <View
                style={{
                  width: 25,
                  height: 25,
                  borderWidth: 1,
                  borderColor: colors.sageDark,
                  borderRadius: 6,
                  backgroundColor: checked ? colors.sageDark : colors.paper,
                }}
              >
                {checked && <Icon name="check" color="white" />}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    ui.body,
                    {
                      color: colors.ink,
                      textDecorationLine: checked ? "line-through" : "none",
                    },
                  ]}
                >
                  {item.label}
                </Text>
                {item.note && <Text style={ui.body}>{item.note}</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
