import React, { useState } from "react";
import { View, Text, Switch, Platform, Share } from "react-native";
import { router } from "expo-router";
import { calculateJourney, disclaimer } from "@nido/core";
import { useApp } from "../../src/state";
import { Screen, Button, Notice, SectionHeader, ui } from "../../src/ui";
export default function Profile() {
  const {
    state,
    demo,
    email,
    updatePreferences,
    exportData,
    eraseData,
    signOut,
  } = useApp();
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");
  const journey = calculateJourney(state.preferences);
  function change(patch: Partial<typeof state.preferences>) {
    void updatePreferences({ ...state.preferences, ...patch }).catch(() => {});
  }
  async function exportFile() {
    setBusy(true);
    try {
      const content = JSON.stringify(await exportData(), null, 2);
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(
          new Blob([content], { type: "application/json" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "nido-i-miei-dati.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else await Share.share({ title: "I miei dati Nido", message: content });
      setMessage(
        "Esportazione preparata. Il file può contenere dati personali.",
      );
    } catch {
      setMessage("Esportazione non riuscita. Riprova.");
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    try {
      await eraseData();
      router.replace("/welcome");
    } catch {
      setMessage("Cancellazione non riuscita. Riprova.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen
      eyebrow="PROFILO"
      title="Il tuo spazio, le tue scelte."
      subtitle="Le preferenze possono cambiare, proprio come il tuo percorso."
    >
      <Notice>
        {email ??
          (demo
            ? "Ospite · DEMO MODE · dati su questo dispositivo"
            : "Ospite · dati su questo dispositivo")}
      </Notice>
      <SectionHeader title="Il mio percorso" />
      <View style={[ui.card, { gap: 12 }]}>
        <Text style={ui.heading}>{journey.label}</Text>
        <Text style={ui.body}>{journey.description}</Text>
        {state.preferences.date && (
          <Text style={ui.body}>
            Data facoltativa: {state.preferences.date}
          </Text>
        )}
        <Button variant="quiet" onPress={() => router.push("/welcome?edit=1")}>
          Modifica il mio percorso
        </Button>
        {state.preferences.sensitiveConsent && (
          <Button
            variant="quiet"
            onPress={() =>
              change({
                date: null,
                sensitiveConsent: false,
                personalized: false,
              })
            }
          >
            Ritira il consenso e rimuovi la data
          </Button>
        )}
      </View>
      <SectionHeader title="Da ritrovare" />
      <Button variant="secondary" onPress={() => router.push("/saved")}>
        Articoli salvati
      </Button>
      <SectionHeader title="Le tue preferenze" />
      <View style={[ui.card, { gap: 22 }]}>
        <View style={ui.row}>
          <View style={{ flex: 1 }}>
            <Text style={ui.label}>Promemoria del percorso</Text>
            <Text style={ui.body}>
              Preferenza salvata. L’invio arriverà in un prossimo aggiornamento.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Promemoria del percorso"
            value={state.preferences.notifications}
            onValueChange={(notifications) => change({ notifications })}
          />
        </View>
        <View style={ui.row}>
          <View style={{ flex: 1 }}>
            <Text style={ui.label}>Novità di Nido</Text>
            <Text style={ui.body}>
              Consenso marketing facoltativo, nessun invio attivo.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Consenso marketing facoltativo"
            value={state.preferences.marketing}
            onValueChange={(marketing) => change({ marketing })}
          />
        </View>
      </View>
      <SectionHeader title="Conosci Nido" />
      <Button
        variant="quiet"
        onPress={() => setInfo(info === "midwife" ? "" : "midwife")}
      >
        L’ostetrica di Nido
      </Button>
      {info === "midwife" && (
        <Notice>
          Nessuna ostetrica è stata ancora associata a questa demo. Prima della
          produzione saranno verificati identità, qualifica e revisione dei
          contenuti. Non attribuiamo approvazioni agli esempi.
        </Notice>
      )}
      <Button
        variant="quiet"
        onPress={() => setInfo(info === "contact" ? "" : "contact")}
      >
        Contatti
      </Button>
      {info === "contact" && (
        <Notice>
          I contatti professionali reali saranno pubblicati prima del lancio.
          Per esigenze sanitarie rivolgiti ai tuoi servizi abituali.
        </Notice>
      )}
      <Button variant="quiet" onPress={() => router.push("/help")}>
        Quando chiedere aiuto
      </Button>
      <Button variant="quiet" onPress={() => router.push("/privacy")}>
        Privacy e informazioni educative
      </Button>
      <SectionHeader title="Account e dati" />
      <Button variant="secondary" onPress={() => router.push("/account")}>
        {email ? "Il mio account" : "Accedi o crea un account"}
      </Button>
      <Button
        variant="quiet"
        disabled={busy}
        onPress={() => {
          void exportFile();
        }}
      >
        Esporta i miei dati
      </Button>
      <Button variant="quiet" onPress={() => setConfirm(true)}>
        {email ? "Elimina account e dati" : "Cancella i dati del dispositivo"}
      </Button>
      {email && (
        <Button
          variant="quiet"
          onPress={() => {
            void signOut().catch(() => setMessage("Uscita non riuscita."));
          }}
        >
          Esci dall’account
        </Button>
      )}
      {confirm && (
        <View style={[ui.card, { gap: 16 }]}>
          <Text style={ui.heading}>Confermi la cancellazione?</Text>
          <Text style={ui.body}>
            Rimuove definitivamente preferenze, data facoltativa, salvati e
            progressi. Puoi esportarli prima di continuare.
          </Text>
          <Button
            disabled={busy}
            onPress={() => {
              void remove();
            }}
          >
            Conferma cancellazione
          </Button>
          <Button
            variant="quiet"
            disabled={busy}
            onPress={() => setConfirm(false)}
          >
            Annulla
          </Button>
        </View>
      )}
      {message && <Notice>{message}</Notice>}
      <Notice>{disclaimer}</Notice>
    </Screen>
  );
}
