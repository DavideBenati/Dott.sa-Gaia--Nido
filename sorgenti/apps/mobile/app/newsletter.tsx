import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Text, TextInput } from "../src/typography";
import {
  confirmNewsletter,
  requestNewsletterSubscription,
} from "../src/newsletter";
import { Screen, Notice, Button, ui } from "../src/ui";
export default function Newsletter() {
  const params = useLocalSearchParams<{ action?: string; token?: string }>();
  const [completed, setCompleted] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function subscribe() {
    if (!consent || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMessage(
        "Inserisci un’email valida e seleziona il consenso facoltativo.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await requestNewsletterSubscription(email);
      setMessage(
        "Se la richiesta è valida, riceverai un’email: apri il link e conferma l’iscrizione. Controlla anche lo spam. Nessuna iscrizione viene attivata prima della conferma.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Servizio non disponibile.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirmLink() {
    if (
      (params.action !== "confirm" && params.action !== "unsubscribe") ||
      typeof params.token !== "string"
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      setMessage(await confirmNewsletter(params.action, params.token));
      setCompleted(true);
      router.setParams({ action: undefined, token: undefined });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Operazione non riuscita.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (params.action === "confirm" || params.action === "unsubscribe")
    return (
      <Screen
        back
        title={
          params.action === "confirm"
            ? "Conferma la newsletter"
            : "Disiscrizione newsletter"
        }
      >
        <Text style={ui.body}>
          {params.action === "confirm"
            ? "Confermo di voler ricevere via email contenuti, aggiornamenti e novità sui servizi di metiMaia. Posso revocare il consenso in ogni momento."
            : "Conferma di voler interrompere la newsletter. Il tuo account rimarrà attivo."}
        </Text>
        <Button disabled={busy} onPress={() => void confirmLink()}>
          {busy
            ? "Attendi…"
            : params.action === "confirm"
              ? "Confermo l’iscrizione"
              : "Confermo la disiscrizione"}
        </Button>
        {message !== "" && <Notice>{message}</Notice>}
        <Button variant="quiet" onPress={() => router.push("/privacy")}>
          Informativa privacy
        </Button>
      </Screen>
    );
  return (
    <Screen
      back
      title="La newsletter di metiMaia"
      subtitle="Uno spazio da leggere con i tuoi tempi."
    >
      <View
        style={{ maxWidth: 560, alignSelf: "center", width: "100%", gap: 20 }}
      >
        {completed && <Notice>{message}</Notice>}
        <Text style={ui.body}>
          Contenuti, aggiornamenti e novità sui servizi della Dott.sa Gaia.
          L’iscrizione è gratuita e indipendente dall’account: puoi usare il
          sito e l’app anche senza newsletter.
        </Text>
        <TextInput
          accessibilityLabel="Email newsletter"
          placeholder="La tua email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          style={ui.input}
          editable={!busy}
        />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="Consenso newsletter"
          accessibilityState={{ checked: consent, disabled: busy }}
          disabled={busy}
          onPress={() => setConsent(!consent)}
          style={{ paddingVertical: 12 }}
        >
          <Text style={ui.body}>
            {consent ? "☑" : "☐"} Acconsento a ricevere via email la newsletter
            metiMaia con contenuti, aggiornamenti e novità sui servizi. Posso
            revocare il consenso in ogni momento.
          </Text>
        </Pressable>
        <Button disabled={busy} onPress={() => void subscribe()}>
          {busy ? "Invio…" : "Richiedi iscrizione"}
        </Button>
        {!completed && message !== "" && (
          <View accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Notice>{message}</Notice>
          </View>
        )}
        <Text style={ui.body}>
          Titolare: Dott.sa Gaia, Via San Godenzo 33, Roma. Contatto:
          ostetricamaia@gmail.com. Utilizziamo email e prova del consenso per
          gestire l’iscrizione tramite Supabase e Resend. La base giuridica è il
          consenso, distinto dai servizi dell’account. Non usiamo le tue
          preferenze sanitarie per selezionare i destinatari. Conserviamo
          l’iscrizione fino alla revoca; le richieste non confermate scadono
          dopo 24 ore. Ogni newsletter deve includere il collegamento di
          disiscrizione. Per accesso, rettifica, cancellazione e altre richieste
          scrivi al contatto privacy; puoi proporre reclamo al Garante.
        </Text>
        <Button variant="quiet" onPress={() => router.push("/privacy")}>
          Leggi l’informativa privacy completa
        </Button>
      </View>
    </Screen>
  );
}
