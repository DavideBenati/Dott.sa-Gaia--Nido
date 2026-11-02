import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router, useIsFocused } from "expo-router";
import { Button, ui } from "./ui";
import { Text } from "./typography";
import { Icon } from "./icons";
import { colors } from "./theme";
import {
  loadMyDocumentSummary,
  type MyDocumentSummary,
} from "./session-documents";
import { useResumeRefresh } from "./use-resume-refresh";

export function HomeDocuments() {
  const focused = useIsFocused();
  const [version, setVersion] = useState(0);
  const [summary, setSummary] = useState<MyDocumentSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const requestVersion = useRef(0);
  useResumeRefresh(() => setVersion((value) => value + 1), {
    enabled: focused,
    background: () => {
      requestVersion.current++;
      setSummary(null);
      setFailed(false);
    },
  });
  useEffect(() => {
    const request = ++requestVersion.current;
    let active = true;
    setSummary(null);
    setFailed(false);
    if (focused)
      void loadMyDocumentSummary().then(
        (value) => {
          if (active && request === requestVersion.current) setSummary(value);
        },
        () => {
          if (active && request === requestVersion.current) setFailed(true);
        },
      );
    return () => {
      active = false;
    };
  }, [focused, version]);
  return (
    <View style={[ui.card, { padding: 18, gap: 10 }]}>
      <View style={[ui.row, { alignItems: "flex-start" }]}>
        <Icon name="lock" size={26} />
        <Text accessibilityRole="header" style={[ui.heading, { flex: 1 }]}>
          I miei documenti
        </Text>
      </View>
      <View accessibilityLiveRegion="polite" style={{ gap: 5 }}>
        {failed ? (
          <Text style={ui.body}>
            Non riusciamo a verificare i materiali qui. Apri i tuoi documenti
            per controllare.
          </Text>
        ) : !summary ? (
          <Text style={ui.body}>Controllo i materiali condivisi…</Text>
        ) : summary.total === 0 ? (
          <Text style={ui.body}>
            Non hai ancora materiali condivisi. Compariranno qui quando Gaia li
            aggiungerà.
          </Text>
        ) : (
          <>
            <Text
              style={{
                color: colors.sageDark,
                fontSize: 16,
                lineHeight: 23,
                fontWeight: "600",
              }}
            >
              {summary.total === null
                ? "Materiali disponibili"
                : summary.total === 1
                  ? "1 materiale disponibile"
                  : `${summary.total} materiali disponibili`}
            </Text>
            {summary.latest && (
              <>
                <Text
                  numberOfLines={1}
                  style={[ui.body, { color: colors.ink }]}
                >
                  {summary.latest.title}
                </Text>
                <Text
                  style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}
                >
                  Ultima condivisione:{" "}
                  {new Date(summary.latest.sharedAt).toLocaleDateString(
                    "it-IT",
                    { day: "numeric", month: "long", year: "numeric" },
                  )}
                </Text>
              </>
            )}
          </>
        )}
      </View>
      <Button onPress={() => router.push("/miei-documenti")}>
        Apri i miei documenti
      </Button>
      {failed && (
        <Button
          variant="quiet"
          onPress={() => setVersion((value) => value + 1)}
        >
          Riprova riepilogo documenti
        </Button>
      )}
    </View>
  );
}
