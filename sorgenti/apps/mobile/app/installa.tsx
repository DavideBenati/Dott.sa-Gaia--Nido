import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Screen, Button, Notice, SectionHeader, ui } from "../src/ui";
import { Text } from "../src/typography";
import { usePwa } from "../src/pwa";

export default function Install() {
  const pwa = usePwa();
  const instructions = {
    ios: [
      "1. Apri metimaia.com con Safari.",
      "2. Tocca Condividi, poi Aggiungi alla schermata Home.",
      "3. Se compare Apri come app web, lascialo attivo. Conferma con Aggiungi.",
      "4. Apri MAIA dalla nuova icona.",
    ],
    android: [
      "1. Apri metimaia.com con Chrome.",
      "2. Tocca il menu con i tre puntini e scegli Installa app oppure Aggiungi alla schermata Home.",
      "3. Conferma e apri MAIA dalla nuova icona.",
    ],
  };
  const orderedPlatforms: ("ios" | "android")[] =
    pwa.platform === "android" ? ["android", "ios"] : ["ios", "android"];
  return (
    <Screen
      back
      eyebrow="SEMPRE A PORTATA DI MANO"
      title="MAIA sul tuo telefono"
      subtitle="Un’icona per ritrovare letture, checklist e i materiali di Gaia."
    >
      <View
        style={{ maxWidth: 800, alignSelf: "center", width: "100%", gap: 20 }}
      >
        {pwa.standalone ? (
          <Notice>MAIA è già sul tuo telefono.</Notice>
        ) : (
          <View style={[ui.card, { gap: 14 }]}>
            <Text style={ui.heading}>Il tuo spazio, con un tocco.</Text>
            <Text style={ui.body}>
              Aggiungi MAIA alla schermata Home del telefono e aprila dalla sua
              icona, senza cercare ogni volta il sito.
            </Text>
            {pwa.canInstall && (
              <Button
                disabled={pwa.installing}
                onPress={() => void pwa.install()}
              >
                {pwa.installing ? "Apertura installazione…" : "Installa MAIA"}
              </Button>
            )}
            {pwa.installMessage !== "" && (
              <View accessibilityLiveRegion="polite">
                <Notice>{pwa.installMessage}</Notice>
              </View>
            )}
          </View>
        )}
        <Notice>
          Usa la stessa email e password del sito. Ritroverai i materiali
          assegnati al tuo account, le letture salvate e i progressi delle
          checklist. La prima volta potrebbe essere necessario accedere di nuovo
          dall’icona.
        </Notice>
        {!pwa.standalone && (
          <>
            <Text style={ui.body}>
              Se hai aperto questa pagina dentro WhatsApp o Instagram, aprila
              prima in Safari su iPhone o in Chrome su Android.
            </Text>
            {orderedPlatforms.map((platform) => (
              <React.Fragment key={platform}>
                <SectionHeader
                  title={
                    platform === "ios"
                      ? pwa.platform === "ios"
                        ? "Sul tuo iPhone o iPad"
                        : "Su iPhone e iPad"
                      : pwa.platform === "android"
                        ? "Sul tuo Android"
                        : "Su Android"
                  }
                />
                <View style={[ui.card, { gap: 12 }]}>
                  {instructions[platform].map((step) => (
                    <Text key={step} style={ui.body}>
                      {step}
                    </Text>
                  ))}
                </View>
              </React.Fragment>
            ))}
            {pwa.platform === "desktop" && (
              <Text style={ui.body}>
                Dal computer puoi usare il pulsante Installa MAIA, quando
                disponibile, oppure aprire questa pagina sul telefono.
              </Text>
            )}
          </>
        )}
        <Text style={ui.body}>
          Per consultare e aggiornare i tuoi dati e aprire i documenti serve una
          connessione a Internet. Le notifiche push non sono attive in questa
          prima versione.
        </Text>
        {pwa.updateAvailable && !pwa.standalone && (
          <View style={[ui.card, { gap: 12 }]}>
            <Text style={ui.heading}>È pronta una nuova versione di MAIA.</Text>
            <Button disabled={pwa.updating} onPress={pwa.applyUpdate}>
              Aggiorna MAIA
            </Button>
            {pwa.updateMessage !== "" && <Notice>{pwa.updateMessage}</Notice>}
          </View>
        )}
        <Button variant="secondary" onPress={() => router.navigate("/(tabs)")}>
          Vai al mio percorso
        </Button>
      </View>
    </Screen>
  );
}
