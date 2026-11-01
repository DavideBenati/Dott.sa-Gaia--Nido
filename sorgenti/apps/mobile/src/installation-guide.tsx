import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Text } from "./typography";
import { Button, Notice } from "./ui";
import { usePwa } from "./pwa";
import { colors } from "./theme";
import installation from "./app-installation.json";

function ShareSymbol() {
  return (
    <Svg
      width={23}
      height={25}
      viewBox="0 0 24 26"
      fill="none"
      stroke={colors.sageDark}
      strokeWidth={1.8}
    >
      <Path d="M7 9H3v15h18V9h-4M12 17V2M7 7l5-5 5 5" />
    </Svg>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={styles.number}>
        <Text
          style={{ color: colors.sageDark, fontSize: 16, fontWeight: "700" }}
        >
          {number}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text accessibilityRole="header" style={styles.stepTitle}>
          {title}
        </Text>
        {children}
      </View>
    </View>
  );
}

export function InstallationGuide({
  phone,
  onPhoneChange,
}: {
  phone: "ios" | "android";
  onPhoneChange: (phone: "ios" | "android") => void;
}) {
  const pwa = usePwa();
  const [showHelp, setShowHelp] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  async function copyLink() {
    try {
      if (Platform.OS !== "web" || !navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(installation.url);
      setCopyMessage(
        "Indirizzo copiato. Incollalo nella barra del browser e premi Vai.",
      );
    } catch {
      setCopyMessage(
        "Tieni premuto sull’indirizzo qui sotto e scegli Copia, poi incollalo nel browser.",
      );
    }
  }
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", gap: 8 }}>
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
            onPress={() => {
              onPhoneChange(value);
              setShowHelp(false);
              setCopyMessage("");
            }}
            style={[
              styles.choice,
              phone === value && {
                backgroundColor: colors.sageDark,
                borderColor: colors.sageDark,
              },
            ]}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: phone === value ? colors.white : colors.sageDark,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.body}>
        {phone === "ios"
          ? "Su iPhone usa Safari. I comandi sono nella barra del browser."
          : "Su Android apri questa pagina in Chrome."}
      </Text>
      {phone === "android" && pwa.canInstall && (
        <Button disabled={pwa.installing} onPress={() => void pwa.install()}>
          {pwa.installing ? "Apertura installazione…" : "Installa MAIA"}
        </Button>
      )}
      {pwa.installMessage !== "" && (
        <View accessibilityLiveRegion="polite">
          <Notice>{pwa.installMessage}</Notice>
        </View>
      )}
      {phone === "ios" ? (
        <>
          <Step number={1} title="Apri il menu di Safari">
            <Text style={styles.body}>
              Tocca i tre puntini (…) in basso a destra, accanto all’indirizzo.
            </Text>
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel="Esempio della barra di Safari: indirizzo metimaia.com e pulsante con tre puntini sulla destra"
              style={styles.browserBar}
            >
              <Text style={{ fontSize: 14, color: colors.ink }}>
                metimaia.com
              </Text>
              <View style={styles.dots}>
                <Text
                  style={{
                    fontSize: 24,
                    lineHeight: 28,
                    color: colors.sageDark,
                  }}
                >
                  …
                </Text>
              </View>
            </View>
            <Text style={styles.caption}>Esempio della barra di Safari</Text>
          </Step>
          <Step number={2} title="Scegli Condividi / Share">
            <View
              style={{ flexDirection: "row", gap: 9, alignItems: "center" }}
            >
              <ShareSymbol />
              <Text style={[styles.body, { flex: 1 }]}>
                Il simbolo è un quadrato con la freccia verso l’alto.
              </Text>
            </View>
            <Text style={styles.caption}>
              Se è già visibile nella barra di Safari, puoi toccarlo
              direttamente.
            </Text>
          </Step>
          <Step number={3} title="Aggiungi MAIA alla Home">
            <Text style={styles.body}>
              Scorri l’elenco: scegli «Aggiungi alla schermata Home» / «Add to
              Home Screen», poi «Aggiungi» / «Add».
            </Text>
            <Text style={styles.caption}>
              Se compare «Apri come app web», lascialo attivo.
            </Text>
          </Step>
        </>
      ) : (
        <>
          <Step number={1} title="Apri il menu di Chrome">
            <Text style={styles.body}>
              Tocca i tre puntini (⋮) nella barra del browser.
            </Text>
          </Step>
          <Step number={2} title="Scegli Installa app">
            <Text style={styles.body}>
              La voce può chiamarsi anche «Aggiungi alla schermata Home».
            </Text>
          </Step>
          <Step number={3} title="Conferma con Installa o Aggiungi">
            <Text style={styles.body}>
              Troverai l’icona MAIA tra le app del telefono.
            </Text>
          </Step>
        </>
      )}
      <Pressable
        accessibilityRole="button"
        aria-expanded={showHelp}
        onPress={() => setShowHelp((value) => !value)}
        style={{
          minHeight: 44,
          justifyContent: "center",
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 8,
        }}
      >
        <Text
          style={{ color: colors.sageDark, fontSize: 15, fontWeight: "600" }}
        >
          {showHelp
            ? "Chiudi l’aiuto per installare"
            : "Non trovi questi comandi?"}
        </Text>
      </Pressable>
      {showHelp && (
        <View style={{ gap: 10 }}>
          <Text style={styles.body}>
            {phone === "ios"
              ? "Se hai aperto il link da WhatsApp, Instagram o un’altra app, torna alla Home dell’iPhone e apri l’app Safari (la bussola blu)."
              : "Se hai aperto il link da WhatsApp, Instagram o un’altra app, apri direttamente l’app Chrome."}
          </Text>
          <Text style={styles.body}>
            Scrivi o incolla questo indirizzo nella barra del browser e premi
            Vai. Poi segui i passaggi qui sopra.
          </Text>
          <Text selectable style={[styles.body, { color: colors.sageDark }]}>
            {installation.url}
          </Text>
          <Button variant="secondary" onPress={() => void copyLink()}>
            Copia l’indirizzo della guida
          </Button>
          {!!copyMessage && (
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              {copyMessage}
            </Text>
          )}
          <Text style={styles.body}>
            Per aggiungere l’icona usa il comando Condividi del browser. Il
            pulsante «Invia le istruzioni» di questa pagina serve a mandare il
            link a un’altra persona.
          </Text>
          <Text style={styles.caption}>
            Se hai già aggiunto MAIA, cerca l’icona nella schermata Home o tra
            le app. Questa pagina nel browser può continuare a mostrare le
            istruzioni.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  body: { fontSize: 16, lineHeight: 23, color: colors.ink },
  caption: { fontSize: 13, lineHeight: 19, color: colors.muted },
  stepTitle: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "600",
    color: colors.ink,
  },
  number: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.sagePale,
  },
  choice: {
    minHeight: 44,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  browserBar: {
    backgroundColor: colors.quiet,
    borderRadius: 13,
    padding: 8,
    paddingLeft: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  dots: {
    width: 38,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.sageDark,
    backgroundColor: colors.paper,
  },
});
