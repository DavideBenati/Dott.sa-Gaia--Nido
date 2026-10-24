import React, { useState } from "react";
import { View, Linking, Platform, Share } from "react-native";
import {
  bookingTopics,
  bookingIssues,
  bookingText,
  type BookingRequest,
} from "@nido/core";
import { Text, TextInput } from "../src/typography";
import { Button, Notice, Screen, StageHeading, ui } from "../src/ui";
import { useApp } from "../src/state";
import { invokeSiteAction } from "../src/professional";
const contact = "ostetricamaia@gmail.com";
export default function Booking() {
  const { email } = useApp();
  const [request, setRequest] = useState<BookingRequest>({
    name: "",
    email: email ?? "",
    topic: bookingTopics[0],
    date: "",
    time: "Da concordare",
    mode: "Da concordare",
  });
  const [review, setReview] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestId] = useState(() => globalThis.crypto?.randomUUID?.() ?? "");
  const [sent, setSent] = useState(false);
  async function sendRequest() {
    if (busy || sent) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await invokeSiteAction({
        action: "booking",
        id: requestId,
        request,
      });
      setSent(true);
      setMessage(result.message);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Invio non confermato. Riprova dalla stessa pagina, oppure usa l’email.",
      );
    } finally {
      setBusy(false);
    }
  }
  function update(patch: Partial<BookingRequest>) {
    setRequest((r) => ({ ...r, ...patch }));
    setMessage("");
  }
  async function openEmail() {
    setBusy(true);
    setMessage("");
    try {
      await Linking.openURL(
        `mailto:${contact}?subject=${encodeURIComponent("metiMaia — richiesta di disponibilità")}&body=${encodeURIComponent(bookingText(request))}`,
      );
      setMessage(
        "Abbiamo richiesto l’apertura della tua app email. Controlla il testo e premi Invia lì: questa pagina non invia email e non conferma appuntamenti. Se l’app non si apre, copia la richiesta e inviala a " +
          contact +
          ".",
      );
    } catch {
      setMessage(
        "Non è stato possibile aprire l’app email. Copia il testo e invialo a " +
          contact +
          ".",
      );
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    try {
      if (Platform.OS === "web")
        await navigator.clipboard.writeText(bookingText(request));
      else await Share.share({ message: bookingText(request) });
      setMessage(
        "Richiesta preparata. Inviala a " +
          contact +
          ": l’appuntamento non è ancora confermato.",
      );
    } catch {
      setMessage(
        "Seleziona e copia manualmente il riepilogo, poi invialo a " +
          contact +
          ".",
      );
    }
  }
  return (
    <Screen
      back
      stageKey={review ? "review" : "form"}
      stageScroll="heading"
      focusTargetId={review ? "booking-review-heading" : "booking-form-heading"}
      eyebrow="UN INCONTRO, CON I TUOI TEMPI"
      title="Chiedi disponibilità a Gaia."
      subtitle="Una richiesta semplice, senza scegliere orari che non sono stati confermati."
    >
      <View
        style={{ width: "100%", maxWidth: 640, alignSelf: "center", gap: 20 }}
      >
        <Notice>
          Questa è una richiesta di disponibilità, non una prenotazione
          confermata. Data, modalità, luogo ed eventuale costo saranno
          concordati direttamente con la dottoressa. Non è disponibile un
          calendario con disponibilità in tempo reale.
        </Notice>
        <Notice warm>
          Per urgenze chiama il 112 o rivolgiti ai servizi sanitari. Non inviare
          qui referti o informazioni sanitarie.
        </Notice>
        {review ? (
          <>
            <StageHeading id="booking-review-heading">
              Controlla la tua richiesta
            </StageHeading>
            <Text selectable style={[ui.body, ui.card]}>
              {bookingText(request)}
            </Text>
            {message !== "" && (
              <View accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Notice>{message}</Notice>
              </View>
            )}
            <Button
              disabled={busy || sent || !requestId}
              onPress={() => void sendRequest()}
            >
              {sent
                ? "Richiesta acquisita"
                : busy
                  ? "Invio…"
                  : "Invia richiesta a Gaia"}
            </Button>
            {!sent && (
              <Notice>
                Se l’invio non è disponibile, puoi usare l’alternativa email qui
                sotto. Evita di inviare due volte la stessa richiesta.
              </Notice>
            )}
            <Button
              variant="secondary"
              disabled={busy || sent}
              onPress={() => void openEmail()}
            >
              Apri l’email per inviare
            </Button>
            <Button
              disabled={busy}
              variant="secondary"
              onPress={() => void copy()}
            >
              Copia richiesta
            </Button>
            <Text selectable style={ui.body}>
              Destinatario: {contact}
            </Text>
            <Button
              variant="quiet"
              disabled={busy || sent}
              onPress={() => {
                setReview(false);
                setMessage("");
              }}
            >
              Modifica richiesta
            </Button>
          </>
        ) : (
          <>
            <StageHeading id="booking-form-heading">
              Completa la tua richiesta
            </StageHeading>
            <Text style={ui.label}>Di cosa vorresti parlare?</Text>
            {bookingTopics.map((topic) => (
              <Button
                key={topic}
                variant={request.topic === topic ? "secondary" : "quiet"}
                onPress={() => update({ topic })}
              >{`${request.topic === topic ? "✓ " : ""}${topic}`}</Button>
            ))}
            <Text style={ui.label}>Nome</Text>
            <TextInput
              accessibilityLabel="Nome per la richiesta"
              style={ui.input}
              value={request.name}
              maxLength={100}
              autoComplete="given-name"
              onChangeText={(name) => update({ name })}
            />
            <Text style={ui.label}>Email di ricontatto</Text>
            <TextInput
              accessibilityLabel="Email di ricontatto"
              style={ui.input}
              value={request.email}
              keyboardType="email-address"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(email) => update({ email })}
            />
            <Text style={ui.label}>Data preferita (facoltativa)</Text>
            <TextInput
              accessibilityLabel="Data preferita"
              placeholder="AAAA-MM-GG, oppure lascia vuoto"
              value={request.date}
              maxLength={10}
              style={ui.input}
              onChangeText={(date) => update({ date })}
            />
            <Text style={ui.label}>Fascia oraria</Text>
            {["Da concordare", "Mattina", "Pomeriggio"].map((time) => (
              <Button
                key={time}
                variant={request.time === time ? "secondary" : "quiet"}
                onPress={() => update({ time })}
              >{`${request.time === time ? "✓ " : ""}${time}`}</Button>
            ))}
            <Text style={ui.label}>Modalità preferita</Text>
            {[
              "Da concordare",
              "In presenza, se disponibile",
              "A distanza, se disponibile",
            ].map((mode) => (
              <Button
                key={mode}
                variant={request.mode === mode ? "secondary" : "quiet"}
                onPress={() => update({ mode })}
              >{`${request.mode === mode ? "✓ " : ""}${mode}`}</Button>
            ))}
            <Text style={ui.body}>
              Prima dell’invio i campi restano nella memoria della pagina. Con
              “Invia richiesta a Gaia” nome, email e preferenze vengono salvati
              in Supabase e resi disponibili nel pannello riservato. Con
              l’alternativa email il testo passa alla tua app email. Nessuna
              iscrizione newsletter è collegata alla richiesta.
            </Text>
            {message !== "" && (
              <View accessibilityRole="alert">
                <Notice>{message}</Notice>
              </View>
            )}
            <Button
              onPress={() => {
                const issues = bookingIssues(request);
                if (issues.length) setMessage(issues.join(" "));
                else {
                  setReview(true);
                  setMessage("");
                }
              }}
            >
              Rivedi la richiesta
            </Button>
          </>
        )}
      </View>
    </Screen>
  );
}
