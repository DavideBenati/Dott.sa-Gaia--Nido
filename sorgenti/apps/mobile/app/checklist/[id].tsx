import { Text } from "../../src/typography";
import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useApp } from "../../src/state";
import { Button, Screen, Notice, EmptyState, Progress, ui } from "../../src/ui";
import { Icon } from "../../src/icons";
import { colors } from "../../src/theme";
import { checklistShare, checklistSummary } from "../../src/share-content";
import { ShareContentButton } from "../../src/share-content-button";
export default function Checklist() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { checklists, state, toggleProgress } = useApp();
  const [saving, setSaving] = useState<string[]>([]);
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
  const summary = checklistSummary(checklist, state.progress);
  return (
    <Screen
      back
      eyebrow="CHECKLIST · PICCOLI PASSI"
      title={checklist.title}
      subtitle={checklist.description}
    >
      <Notice>
        Usa questa lista per decidere cosa preparare e trasformare i pensieri in
        piccoli gesti concreti. Spunta ogni attività quando l’hai completata o
        hai deciso che non ti serve. Sono suggerimenti adattabili, non requisiti
        medici: consulta la lista della tua struttura e la tua ostetrica.
        {checklist.isDemo
          ? " Esempio dimostrativo, non ancora revisionato."
          : ""}
      </Notice>
      <View style={{ gap: 12, marginVertical: 25 }}>
        <Progress completed={summary.completed} total={summary.total} />
        {summary.complete && saving.length === 0 && (
          <View style={[ui.card, { backgroundColor: colors.sagePale, gap: 8 }]}>
            <Text accessibilityRole="header" style={ui.heading}>
              🌷 Un piccolo traguardo raggiunto
            </Text>
            <Text accessibilityLiveRegion="polite" style={ui.body}>
              Hai completato tutte le attività di questa checklist, con i tuoi
              tempi. Puoi condividere questo momento con chi ti accompagna.
            </Text>
          </View>
        )}
        {saving.length === 0 && (
          <ShareContentButton
            content={checklistShare(checklist, state.progress)}
            label={
              summary.complete
                ? "Condividi il traguardo"
                : "Condividi lo stato della checklist"
            }
          />
        )}
        <Text style={ui.body}>
          La condivisione invia una fotografia dei progressi e delle attività
          ancora da fare. Non si aggiorna automaticamente. Per seguire insieme
          gli aggiornamenti, puoi autorizzare una persona nelle Condivisioni
          familiari.
        </Text>
        <Button variant="quiet" onPress={() => router.push("/condivisioni")}>
          Condivisioni familiari
        </Button>
      </View>
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
              disabled={saving.includes(item.id)}
              onPress={() => {
                setSaving((current) => [...current, item.id]);
                void toggleProgress(item.id)
                  .catch(() => {})
                  .finally(() =>
                    setSaving((current) =>
                      current.filter((id) => id !== item.id),
                    ),
                  );
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
