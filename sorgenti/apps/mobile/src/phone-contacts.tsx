import React, { useState } from "react";
import { Linking, View } from "react-native";
import { Text } from "./typography";
import { Button, Notice, ui } from "./ui";
import { gaiaPhone } from "./gaia-presentation";

export function PhoneContacts() {
  const [error, setError] = useState("");
  async function open(url: string) {
    setError("");
    try {
      await Linking.openURL(url);
    } catch {
      setError(
        "Non è stato possibile aprire l’app. Puoi copiare il numero mostrato e contattare Gaia dal tuo telefono.",
      );
    }
  }
  return (
    <View style={[ui.card, { gap: 14 }]}>
      <Text accessibilityRole="header" style={ui.heading}>
        Telefono e WhatsApp
      </Text>
      <Text style={ui.body}>
        Per informazioni sui percorsi e sulle consulenze private puoi contattare
        Gaia anche al telefono o su WhatsApp.
      </Text>
      <Text selectable style={ui.heading}>
        {gaiaPhone.label}
      </Text>
      <Button variant="secondary" onPress={() => void open(gaiaPhone.call)}>
        Chiama Gaia
      </Button>
      <Button variant="secondary" onPress={() => void open(gaiaPhone.whatsapp)}>
        Apri WhatsApp
      </Button>
      {error !== "" && (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Notice>{error}</Notice>
        </View>
      )}
    </View>
  );
}
