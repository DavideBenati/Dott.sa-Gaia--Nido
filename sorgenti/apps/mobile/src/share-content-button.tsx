import React, { useState } from "react";
import { Platform, Share, View } from "react-native";
import { Text } from "./typography";
import { Button, ui } from "./ui";
import {
  shareContent,
  shareText,
  type ContentShare,
  type ShareAdapters,
} from "./share-content";

export function ShareContentButton({
  content,
  label = "Condividi",
}: {
  content: ContentShare;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [manual, setManual] = useState(false);
  async function share() {
    setBusy(true);
    setMessage("");
    setManual(false);
    const adapters: ShareAdapters =
      Platform.OS === "web"
        ? {
            share:
              typeof navigator !== "undefined" && navigator.share
                ? async (value) => {
                    await navigator.share(value);
                    return "shared";
                  }
                : undefined,
            copy:
              typeof navigator !== "undefined" && navigator.clipboard?.writeText
                ? (value) => navigator.clipboard.writeText(value)
                : undefined,
          }
        : {
            share: async (value) => {
              const result = await Share.share({
                title: value.title,
                message: shareText(value),
              });
              return result.action === Share.dismissedAction
                ? "cancelled"
                : "shared";
            },
          };
    try {
      const result = await shareContent(content, adapters);
      setManual(result === "manual");
      setMessage(
        result === "copied"
          ? "Testo e link copiati. Ora puoi incollarli dove preferisci."
          : result === "shared"
            ? "Condivisione aperta."
            : result === "manual"
              ? "La condivisione non è disponibile qui. Seleziona e copia il testo qui sotto."
              : "",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 10 }}>
      <Button variant="secondary" disabled={busy} onPress={() => void share()}>
        {busy ? "Prepariamo la condivisione…" : label}
      </Button>
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={ui.body}>
          {message}
        </Text>
      )}
      {manual && (
        <Text selectable style={[ui.body, ui.card]}>
          {shareText(content)}
        </Text>
      )}
    </View>
  );
}
