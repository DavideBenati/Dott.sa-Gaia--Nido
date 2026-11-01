import React, { useState } from "react";
import { Image, Platform, Pressable, View } from "react-native";
import { router } from "expo-router";
import { Screen, Button, Notice, ui } from "../src/ui";
import { Text } from "../src/typography";
import { usePwa } from "../src/pwa";
import { ShareContentButton } from "../src/share-content-button";
import installation from "../src/app-installation.json";
import installationQr from "../assets/brand/maia-app-qr.png";

function InstallationQr({ otherPhone = false }: { otherPhone?: boolean }) {
  return (
    <View style={[ui.card, { gap: 14 }]}>
      <Text accessibilityRole="header" style={ui.heading}>
        {otherPhone
          ? "Inquadra con l’altro telefono"
          : "1. Inquadra il QR code"}
      </Text>
      <Text style={ui.body}>
        Apri la fotocamera del telefono, inquadra il codice e tocca il
        collegamento che compare. Troverai i passaggi per aggiungere MAIA alla
        schermata Home.
      </Text>
      <Image
        source={installationQr}
        accessibilityRole="image"
        accessibilityLabel="QR code per aprire le istruzioni di installazione di MAIA"
        resizeMode="contain"
        style={{
          width: 222,
          height: 222,
          alignSelf: "center",
          backgroundColor: "#FFFFFF",
        }}
      />
      <Text selectable style={[ui.body, { textAlign: "center", fontSize: 16 }]}>
        {installation.url}
      </Text>
      <Text style={ui.body}>
        Il QR apre le istruzioni. Confermerai l’installazione sul telefono.
      </Text>
      {Platform.OS === "web" && (
        <a
          href="/maia-app-qr.png"
          download="QR-App-MAIA.png"
          style={{
            color: "#42624B",
            minHeight: 44,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "inherit",
          }}
        >
          Scarica il QR code
        </a>
      )}
    </View>
  );
}

export default function Install() {
  const pwa = usePwa();
  const desktop = pwa.platform === "desktop";
  const [phone, setPhone] = useState<"ios" | "android">(
    pwa.platform === "android" ? "android" : "ios",
  );
  const [showQr, setShowQr] = useState(false);
  const instructions = {
    ios: [
      "Apri questa pagina in Safari.",
      "Tocca Condividi, poi Aggiungi alla schermata Home.",
      "Lascia attivo Apri come app web, se compare, e conferma con Aggiungi.",
    ],
    android: [
      "Apri questa pagina in Chrome.",
      "Tocca il menu con i tre puntini e scegli Installa app oppure Aggiungi alla schermata Home.",
      "Conferma l’installazione.",
    ],
  };
  return (
    <Screen
      back
      eyebrow="DAL SITO AL TUO TELEFONO"
      title="MAIA sul tuo telefono"
      subtitle={
        desktop
          ? "Inquadra il codice e continua dal telefono."
          : "Aggiungi l’icona e ritrova il tuo spazio, con un tocco."
      }
    >
      <View
        style={{ maxWidth: 800, alignSelf: "center", width: "100%", gap: 20 }}
      >
        {desktop && <InstallationQr />}
        {pwa.standalone ? (
          <Notice>MAIA è già sul tuo telefono.</Notice>
        ) : (
          <View style={[ui.card, { gap: 14 }]}>
            <Text accessibilityRole="header" style={ui.heading}>
              {desktop
                ? "2. Aggiungi l’icona sul telefono"
                : "1. Aggiungi l’icona al telefono"}
            </Text>
            <Text style={ui.body}>
              Scegli il tuo telefono e segui questi passaggi. L’installazione si
              apre solo quando la confermi tu.
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
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {(
                [
                  ["ios", "iPhone / iPad"],
                  ["android", "Android"],
                ] as const
              ).map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  aria-pressed={phone === value}
                  onPress={() => setPhone(value)}
                  style={[
                    ui.pill,
                    phone === value && ui.pillActive,
                    { minHeight: 44, justifyContent: "center" },
                  ]}
                >
                  <Text
                    style={[ui.pillText, phone === value && ui.pillTextActive]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={ui.body}>
              {phone === "ios"
                ? "Da WhatsApp o Instagram, apri prima questa pagina in Safari."
                : "Da WhatsApp o Instagram, apri prima questa pagina in Chrome."}
            </Text>
            {instructions[phone].map((step, index) => (
              <Text key={step} style={ui.body}>
                {index + 1}. {step}
              </Text>
            ))}
          </View>
        )}
        <View style={[ui.card, { gap: 12 }]}>
          <Text accessibilityRole="header" style={ui.heading}>
            {pwa.standalone
              ? "Il tuo account, anche qui"
              : desktop
                ? "3. Apri MAIA e accedi"
                : "2. Apri MAIA e accedi"}
          </Text>
          <Text style={ui.body}>
            Apri la nuova icona MAIA. Usa la stessa email e password del sito:
            ritroverai i materiali assegnati al tuo account, le letture salvate
            e i progressi delle checklist.
          </Text>
          <Text style={ui.body}>
            Se è il tuo primo accesso, crea l’account dall’app. Se lo usi già,
            la prima volta potrebbe essere necessario accedere di nuovo.
          </Text>
        </View>
        <ShareContentButton
          label="Condividi il link per installare MAIA"
          content={{
            title: "MAIA sul tuo telefono",
            text: "Aggiungi MAIA alla schermata Home e ritrova letture, checklist e i materiali condivisi con il tuo account. Le istruzioni per iPhone e Android sono qui:",
            url: installation.url,
          }}
        />
        {!desktop && (
          <View style={{ gap: 14 }}>
            <Button
              variant="quiet"
              onPress={() => setShowQr((value) => !value)}
            >
              {showQr
                ? "Nascondi il QR code"
                : "Mostra il QR per un altro telefono"}
            </Button>
            {showQr && <InstallationQr otherPhone />}
          </View>
        )}
        <Text style={ui.body}>
          Serve Internet per consultare e aggiornare i dati e aprire i
          documenti. Le notifiche push non sono ancora attive.
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
