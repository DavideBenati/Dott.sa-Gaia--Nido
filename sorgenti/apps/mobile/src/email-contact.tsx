import React, { useState } from "react";
import { Linking, View } from "react-native";
import { Button, Notice } from "./ui";

export function EmailContactButton({
  email,
  subject = "metiMaia — informazioni e disponibilità",
  children = "Scrivi a Gaia via email",
}: {
  email: string;
  subject?: string;
  children?: string;
}) {
  const [error, setError] = useState("");
  async function open() {
    setError("");
    try {
      await Linking.openURL(
        `mailto:${email}?subject=${encodeURIComponent(subject)}`,
      );
    } catch {
      setError(
        `Non è stato possibile aprire l’app email. Copia l’indirizzo ${email} e scrivi dalla tua casella.`,
      );
    }
  }
  return (
    <View style={{ gap: 10 }}>
      <Button variant="secondary" onPress={() => void open()}>
        {children}
      </Button>
      {error !== "" && (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Notice>{error}</Notice>
        </View>
      )}
    </View>
  );
}
