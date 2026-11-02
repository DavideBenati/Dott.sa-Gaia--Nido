import { Text } from "../../src/typography";
import React, { useRef, useState } from "react";
import { View, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useApp } from "../../src/state";
import {
  Button,
  Screen,
  Notice,
  EmptyState,
  Progress,
  ContentStatus,
  ui,
} from "../../src/ui";
import { Icon } from "../../src/icons";
import { colors } from "../../src/theme";
import { checklistShare, checklistSummary } from "../../src/share-content";
import { ShareContentButton } from "../../src/share-content-button";
export default function Checklist() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    checklists,
    state,
    toggleProgress,
    contentLoading,
    contentError,
    refreshContent,
  } = useApp();
  const [saving, setSaving] = useState<string[]>([]);
  const inFlight = useRef(new Set<string>());
  const [remainingOnly, setRemainingOnly] = useState(false);
  const [sharingOpen, setSharingOpen] = useState(false);
  const checklist = checklists.find((c) => c.id === id);
  if (!checklist && contentLoading)
    return (
      <Screen back title="La tua checklist">
        <Notice>Caricamento checklist…</Notice>
      </Screen>
    );
  if (!checklist && contentError)
    return (
      <Screen back title="La tua checklist">
        <View accessibilityRole="alert">
          <Notice>{contentError}</Notice>
        </View>
        <Button onPress={() => void refreshContent()}>
          Riprova caricamento checklist
        </Button>
      </Screen>
    );
  if (!checklist)
    return (
      <Screen back>
        <EmptyState
          title="Checklist non disponibile"
          text="Questo contenuto potrebbe non essere più pubblicato."
        />
        <Button onPress={() => router.navigate("/checklists")}>
          Vai alle checklist
        </Button>
      </Screen>
    );
  if (checklist.items.length === 0)
    return (
      <Screen back title={checklist.title} subtitle={checklist.description}>
        <ContentStatus />
        {!contentLoading && !contentError && (
          <EmptyState
            title="Questa checklist è ancora vuota"
            text="Non ci sono ancora attività da spuntare. Puoi scegliere un’altra checklist."
            action="Vai alle checklist"
            onPress={() => router.navigate("/checklists")}
          />
        )}
      </Screen>
    );
  const summary = checklistSummary(checklist, state.progress);
  const items = remainingOnly
    ? checklist.items.filter(
        (item) => !state.progress[item.id] || saving.includes(item.id),
      )
    : checklist.items;
  return (
    <Screen
      back
      eyebrow="CHECKLIST · PICCOLI PASSI"
      title={checklist.title}
      subtitle={checklist.description}
    >
      <Notice>
        Spunta ciò che hai preparato o deciso che non ti serve. Adatta la lista
        alle indicazioni della tua struttura e di Gaia.
        {checklist.isDemo
          ? " Esempio dimostrativo, non ancora revisionato."
          : ""}
      </Notice>
      <ContentStatus />
      <View style={{ gap: 12, marginVertical: 12 }}>
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
      </View>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 14,
        }}
      >
        {(
          [
            [false, "Tutte le attività"],
            [true, "Da fare"],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            aria-pressed={remainingOnly === value}
            onPress={() => setRemainingOnly(value)}
            style={[ui.pill, remainingOnly === value && ui.pillActive]}
          >
            <Text
              style={[
                ui.pillText,
                remainingOnly === value && ui.pillTextActive,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {remainingOnly && items.length === 0 && (
        <Notice>
          {summary.complete
            ? "Non restano attività da fare. Puoi rivederle da Tutte le attività."
            : "Questa checklist non contiene ancora attività."}
        </Notice>
      )}
      <View style={[ui.card, { padding: 0, overflow: "hidden" }]}>
        {items.map((item) => {
          const checked = Boolean(state.progress[item.id]);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="checkbox"
              accessibilityLabel={item.label}
              accessibilityState={{
                checked,
                busy: saving.includes(item.id),
                disabled: saving.includes(item.id),
              }}
              aria-checked={checked}
              disabled={saving.includes(item.id)}
              onPress={() => {
                if (inFlight.current.has(item.id)) return;
                inFlight.current.add(item.id);
                setSaving((current) => [...current, item.id]);
                void toggleProgress(item.id)
                  .catch(() => {})
                  .finally(() => {
                    inFlight.current.delete(item.id);
                    setSaving((current) =>
                      current.filter((id) => id !== item.id),
                    );
                  });
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
                {saving.includes(item.id) && (
                  <Text accessibilityLiveRegion="polite" style={ui.label}>
                    Salvataggio…
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={[ui.card, { gap: 12, marginTop: 16 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Condividi e organizza insieme"
          accessibilityState={{ expanded: sharingOpen }}
          aria-expanded={sharingOpen}
          aria-controls={sharingOpen ? "checklist-sharing-options" : undefined}
          onPress={() => setSharingOpen((open) => !open)}
          style={{
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Text style={[ui.label, { flex: 1 }]}>
            Condividi e organizza insieme
          </Text>
          <Text style={ui.body}>{sharingOpen ? "−" : "+"}</Text>
        </Pressable>
        {sharingOpen && (
          <View nativeID="checklist-sharing-options" style={{ gap: 12 }}>
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
              La condivisione invia una fotografia dei progressi e delle
              attività ancora da fare. Non si aggiorna automaticamente. Per
              seguire insieme gli aggiornamenti, puoi autorizzare una persona
              nelle Condivisioni familiari.
            </Text>
            <Button
              variant="quiet"
              onPress={() => router.push("/condivisioni")}
            >
              Condivisioni familiari
            </Button>
          </View>
        )}
      </View>
    </Screen>
  );
}
