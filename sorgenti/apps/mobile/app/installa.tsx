import React, { useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Screen, Button, Notice, ui } from "../src/ui";
import { Text } from "../src/typography";
import { usePwa } from "../src/pwa";
import { useApp } from "../src/state";
import { colors } from "../src/theme";
import { InstallationGuide } from "../src/installation-guide";
import { ShareContentButton } from "../src/share-content-button";
import installation from "../src/app-installation.json";
import installationQr from "../assets/brand/maia-app-qr.png";

function InstallationQr() {
  return (
    <View style={[ui.card, { gap: 12, padding: 20 }]}>
      <Text
        accessibilityRole="header"
        style={[ui.heading, { fontSize: 23, lineHeight: 29 }]}
      >
        Inquadra con la fotocamera del telefono
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
      <Text selectable style={[ui.body, { textAlign: "center", fontSize: 15 }]}>
        {installation.url}
      </Text>
      <Text style={ui.body}>
        Tocca il collegamento che compare: sul telefono vedrai i passaggi per
        aggiungere l’icona MAIA.
      </Text>
      {Platform.OS === "web" && (
        <a
          href="/maia-app-qr.png"
          download="QR-App-MAIA.png"
          style={{
            color: colors.sageDark,
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
  const { email, state } = useApp();
  const { width } = useWindowDimensions();
  // A narrow browser with an unrecognised user agent still needs phone steps.
  const desktop = pwa.platform === "desktop" && width >= 900;
  const [phone, setPhone] = useState<"ios" | "android">(
    pwa.platform === "android" ? "android" : "ios",
  );
  const [showDesktopGuide, setShowDesktopGuide] = useState(false);
  const [showSending, setShowSending] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const continueToAccount = () =>
    router.navigate(
      email
        ? state.preferences.onboarded
          ? "/(tabs)"
          : "/welcome"
        : "/account?mode=login",
    );
  return (
    <Screen
      focused
      style={{ maxWidth: 708 }}
      title={pwa.standalone ? "Sei già nell’app MAIA" : "MAIA sul tuo telefono"}
      subtitle={
        pwa.standalone
          ? "Il tuo spazio è pronto."
          : desktop
            ? "Dal computer al telefono, con il QR code."
            : "La stessa MAIA, a portata di mano."
      }
    >
      <View
        style={{ maxWidth: 660, alignSelf: "center", width: "100%", gap: 18 }}
      >
        {pwa.standalone ? (
          <View style={[ui.card, { padding: 20, gap: 14 }]}>
            <Text style={ui.body}>
              Hai aperto MAIA dall’icona. Qui ritrovi checklist, letture salvate
              e i materiali che Gaia condivide con te.
            </Text>
            <Button onPress={continueToAccount}>
              {email ? "Continua nel mio percorso" : "Accedi al mio account"}
            </Button>
            {!email && (
              <Button
                variant="secondary"
                onPress={() => router.push("/account")}
              >
                Crea un account
              </Button>
            )}
          </View>
        ) : (
          <>
            {desktop && <InstallationQr />}
            {desktop && (
              <Pressable
                accessibilityRole="button"
                aria-expanded={showDesktopGuide}
                onPress={() => setShowDesktopGuide((value) => !value)}
                style={{ minHeight: 44, justifyContent: "center" }}
              >
                <Text
                  style={{
                    color: colors.sageDark,
                    fontSize: 16,
                    fontWeight: "600",
                  }}
                >
                  {showDesktopGuide
                    ? "Chiudi i passaggi per il telefono"
                    : "Vedi anche i passaggi per iPhone e Android"}
                </Text>
              </Pressable>
            )}
            {(!desktop || showDesktopGuide) && (
              <InstallationGuide phone={phone} onPhoneChange={setPhone} />
            )}
            <View style={[ui.card, { padding: 20, gap: 10 }]}>
              <Text
                accessibilityRole="header"
                style={[ui.heading, { fontSize: 23, lineHeight: 29 }]}
              >
                Dopo aver aggiunto l’icona
              </Text>
              <Text style={ui.body}>
                Torna alla schermata Home del telefono e tocca MAIA. Hai già un
                account? Usa la stessa email e password del sito.
              </Text>
              <Text style={ui.body}>
                Ritroverai i tuoi documenti, le letture salvate e le checklist.
                Se è la prima volta, puoi creare l’account da lì.
              </Text>
            </View>
            <Button variant="secondary" onPress={continueToAccount}>
              {email ? "Continua sul sito" : "Accedi dal sito"}
            </Button>
          </>
        )}
        <Pressable
          accessibilityRole="button"
          aria-expanded={showSending}
          onPress={() => setShowSending((value) => !value)}
          style={{
            minHeight: 48,
            justifyContent: "center",
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: 12,
          }}
        >
          <Text
            style={{
              color: colors.sageDark,
              fontSize: 16,
              lineHeight: 23,
              fontWeight: "600",
            }}
          >
            {showSending
              ? "Chiudi l’invio delle istruzioni"
              : "Vuoi aiutare un’altra persona a installare MAIA?"}
          </Text>
        </Pressable>
        {showSending && (
          <View style={{ gap: 12 }}>
            <Text style={ui.body}>
              {pwa.standalone
                ? "Invia questa guida a un’altra persona: potrà seguire i passaggi dal proprio telefono."
                : "Invia questa guida a un’altra persona. Per aggiungere MAIA sul tuo telefono, segui invece i passaggi del browser qui sopra."}
            </Text>
            <ShareContentButton
              label="Invia le istruzioni a un’altra persona"
              content={{
                title: "MAIA sul tuo telefono",
                text: "La guida per aggiungere MAIA al telefono e ritrovare checklist, letture e i materiali condivisi con il proprio account:",
                url: installation.url,
              }}
            />
            {!desktop && (
              <>
                <Pressable
                  accessibilityRole="button"
                  aria-expanded={showQr}
                  onPress={() => setShowQr((value) => !value)}
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
                  <Text style={{ color: colors.sageDark, fontSize: 16 }}>
                    {showQr
                      ? "Nascondi il QR code"
                      : "Mostra il QR per un altro telefono"}
                  </Text>
                </Pressable>
                {showQr && <InstallationQr />}
              </>
            )}
          </View>
        )}
        <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>
          Serve una connessione Internet per aprire i materiali e salvare i
          progressi.
        </Text>
        {pwa.updateAvailable && !pwa.standalone && (
          <View style={{ gap: 10 }}>
            <Text style={ui.body}>È pronta una nuova versione di MAIA.</Text>
            <Button disabled={pwa.updating} onPress={pwa.applyUpdate}>
              Aggiorna MAIA
            </Button>
            {!!pwa.updateMessage && <Notice>{pwa.updateMessage}</Notice>}
          </View>
        )}
      </View>
    </Screen>
  );
}
