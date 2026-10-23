import React, { useEffect, useState } from "react";
import { View, Linking } from "react-native";
import { router } from "expo-router";
import { Screen, Button, Notice, ui } from "../src/ui";
import { Text } from "../src/typography";
import { useApp } from "../src/state";
import { defaultProfile, loadProfile } from "../src/professional";
export default function Contacts() {
  const { email } = useApp();
  const [profile, setProfile] = useState(defaultProfile);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    void loadProfile().then((p) => {
      if (active) setProfile(p);
    });
    return () => {
      active = false;
    };
  }, []);
  return (
    <Screen
      back
      title="Come contattare Gaia"
      subtitle="Scegli il canale più adatto alla tua richiesta."
    >
      <View
        style={{ maxWidth: 800, width: "100%", alignSelf: "center", gap: 20 }}
      >
        <View style={[ui.card, { gap: 12 }]}>
          <Text accessibilityRole="header" style={ui.heading}>
            Vorrei un incontro
          </Text>
          <Text style={ui.body}>
            Invia le preferenze per essere ricontattata/o. Non è una
            prenotazione confermata: luogo, modalità, disponibilità ed eventuale
            costo saranno concordati direttamente. Nessun account necessario.
          </Text>
          <Button onPress={() => router.push("/prenota")}>
            Richiedi disponibilità per un incontro
          </Button>
        </View>
        <View style={[ui.card, { gap: 12 }]}>
          <Text accessibilityRole="header" style={ui.heading}>
            Vorrei informazioni sui servizi
          </Text>
          <Text style={ui.body}>
            Per sapere quali servizi sono disponibili e con quali modalità, puoi
            scrivere via email. Non inviare referti o informazioni sanitarie.
          </Text>
          <Text selectable style={ui.body}>
            {profile.contact_email}
          </Text>
          <Button
            variant="secondary"
            onPress={() =>
              void Linking.openURL(
                `mailto:${profile.contact_email}?subject=${encodeURIComponent("Informazioni sui servizi metiMaia")}`,
              ).catch(() =>
                setMessage(
                  "Non è stato possibile aprire l’app email. Copia l’indirizzo mostrato e scrivi dalla tua casella.",
                ),
              )
            }
          >
            Apri email per informazioni
          </Button>
        </View>
        <View style={[ui.card, { gap: 12 }]}>
          <Text accessibilityRole="header" style={ui.heading}>
            Vorrei usare la conversazione privata
          </Text>
          <Text style={ui.body}>
            La chat è collegata al tuo account e permette di ritrovare i
            messaggi. Non è una visita, una diagnosi o un servizio di assistenza
            continua. L’accesso non garantisce una risposta immediata.
          </Text>
          <Button variant="secondary" onPress={() => router.push("/chat")}>
            {email ? "Apri la mia conversazione" : "Scopri la chat e accedi"}
          </Button>
        </View>
        <Notice>
          Le risposte non sono immediate; giorni, orari e tempi non sono ancora
          definiti. Non usare email, modulo o chat per urgenze: chiama il 112 o
          rivolgiti ai servizi sanitari.
        </Notice>
        <Button variant="quiet" onPress={() => router.push("/gaia")}>
          Conosci Gaia e i servizi
        </Button>
        {message !== "" && (
          <View accessibilityRole="alert">
            <Notice>{message}</Notice>
          </View>
        )}
      </View>
    </Screen>
  );
}
