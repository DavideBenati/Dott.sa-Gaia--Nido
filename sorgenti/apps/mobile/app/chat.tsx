import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import {
  loadCareMessages,
  sendCareMessage,
  type CareMessage,
} from "@nido/data";
import { client, useApp } from "../src/state";
import { Text, TextInput } from "../src/typography";
import { Button, Notice, Screen, ui } from "../src/ui";
import { colors } from "../src/theme";
const samples: CareMessage[] = [
  {
    id: "demo-1",
    conversation_id: "demo",
    sender_id: "demo",
    body: "Buongiorno, vorrei informazioni sugli incontri di accompagnamento alla nascita.",
    created_at: "2026-10-22T09:14:00",
  },
  {
    id: "demo-2",
    conversation_id: "demo",
    sender_id: "staff",
    body: "Buongiorno, quali giorni preferisci per un incontro?",
    created_at: "2026-10-22T09:18:00",
  },
];
function Conversation({
  demo,
  email,
}: {
  demo: boolean;
  email: string | null;
}) {
  const [messages, setMessages] = useState<CareMessage[]>(demo ? samples : []);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!demo && Boolean(email));
  const [reload, setReload] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [sentNotice, setSentNotice] = useState("");
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let alive = true;
    let inFlight = false;
    const backend = client;
    if (!backend || !email || demo) return;
    async function refresh() {
      if (inFlight) return;
      inFlight = true;
      try {
        const [data, status] = await Promise.all([
          loadCareMessages(backend!),
          backend!.rpc("care_chat_available"),
        ]);
        if (status.error) throw status.error;
        if (alive) {
          setMessages(data);
          setLastUpdated(
            new Date().toLocaleTimeString("it-IT", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          );
          setAvailable(status.data === true);
          setError("");
        }
      } catch {
        if (alive)
          setError(
            "Non riusciamo a caricare la conversazione. Riprova tra poco.",
          );
      } finally {
        if (alive) setLoading(false);
        inFlight = false;
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [demo, email, reload]);
  async function send() {
    if (!client || !email || demo || busy || !available || !body.trim()) return;
    setBusy(true);
    setError("");
    setSentNotice("");
    try {
      await sendCareMessage(client, body);
      setBody("");
      setSentNotice(
        "Messaggio salvato nella conversazione. Non sono disponibili conferme di lettura o garanzie sui tempi di risposta.",
      );
      // Delivery succeeded even if the following refresh fails. Never resend automatically.
      try {
        setMessages(await loadCareMessages(client));
      } catch {
        setError(
          "Messaggio inviato. Aggiorna la conversazione per visualizzarlo.",
        );
      }
    } catch {
      setError(
        "Invio non confermato. Il testo è ancora qui: aggiorna la conversazione e controlla se il messaggio compare prima di riprovare, per evitare duplicati.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View
      style={{ width: "100%", maxWidth: 720, alignSelf: "center", gap: 16 }}
    >
      <Button variant="quiet" onPress={() => router.push("/privacy")}>
        Privacy della conversazione
      </Button>
      <Notice warm icon="help">
        Le risposte non sono immediate e non è un servizio di assistenza
        continua. Orari e tempi di risposta sono da concordare con la
        dottoressa. Per urgenze chiama il 112 o rivolgiti ai servizi sanitari.
      </Notice>
      {demo && (
        <Notice>
          ESEMPIO VISIVO · Messaggi dimostrativi. Nessun messaggio è stato
          inviato alla dottoressa. L’invio non è ancora attivo.
        </Notice>
      )}
      {!demo && !email && (
        <View style={[ui.card, { gap: 16 }]}>
          <Text style={ui.body}>
            Accedi al tuo account per aprire la tua conversazione privata.
          </Text>
          <Button onPress={() => router.push("/account")}>
            Crea account o accedi
          </Button>
        </View>
      )}
      {!demo && email && available && (
        <Notice>
          Messaggistica attiva: questo non indica che la dottoressa sia online.
          La conversazione si aggiorna ogni 15 secondi; non vengono inviate
          notifiche email con il testo dei messaggi.
        </Notice>
      )}
      {lastUpdated && (
        <Text accessibilityLiveRegion="polite" style={ui.body}>
          Conversazione aggiornata alle {lastUpdated}
        </Text>
      )}
      {loading && <Text style={ui.body}>Caricamento della conversazione…</Text>}
      {!demo && email && !loading && !available && !error && (
        <Notice>
          La messaggistica non è ancora attiva. Potrai scrivere quando la
          Dott.sa Gaia sarà abilitata.
        </Notice>
      )}
      {messages.length === 0 && email && !loading && !error && (
        <Text style={ui.body}>
          La conversazione inizia qui. Puoi chiedere informazioni sugli incontri
          e sui servizi.
        </Text>
      )}
      {messages.length === 100 && (
        <Text style={ui.body}>Sono mostrati gli ultimi 100 messaggi.</Text>
      )}
      <View style={{ gap: 14, paddingVertical: 12 }}>
        {messages.map((message) => {
          const own = message.sender_id === message.conversation_id;
          return (
            <View
              key={message.id}
              style={{
                alignSelf: own ? "flex-end" : "flex-start",
                maxWidth: "88%",
                backgroundColor: own ? colors.sagePale : colors.paper,
                borderRadius: 18,
                padding: 18,
                gap: 8,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  color: colors.sageDark,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {own ? "Tu" : "Dott.sa Gaia"}
                {demo ? " · esempio" : ""}
              </Text>
              <Text selectable style={[ui.body, { color: colors.ink }]}>
                {message.body}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {new Date(message.created_at).toLocaleString("it-IT", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              {!demo && own && (
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Salvato nella conversazione · lettura non verificabile
                </Text>
              )}
            </View>
          );
        })}
      </View>
      {error !== "" && (
        <View accessibilityRole="alert">
          <Notice warm>{error}</Notice>
          <Button
            variant="quiet"
            onPress={() => {
              setLoading(true);
              setReload((value) => value + 1);
            }}
          >
            Ricarica conversazione
          </Button>
        </View>
      )}
      {sentNotice !== "" && (
        <View accessibilityRole="status" accessibilityLiveRegion="polite">
          <Notice>{sentNotice}</Notice>
        </View>
      )}
      <View style={[ui.card, { gap: 12, padding: 16 }]}>
        <TextInput
          accessibilityLabel="Scrivi un messaggio"
          placeholder={
            demo
              ? "Chat dimostrativa: invio non attivo"
              : "Scrivi un messaggio…"
          }
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={4000}
          editable={!demo && Boolean(email) && available && !busy}
          style={[ui.input, { minHeight: 90, textAlignVertical: "top" }]}
        />
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {body.length}/4000 caratteri · Evita informazioni sanitarie non
          necessarie.
        </Text>
        <Button
          disabled={demo || !email || !available || busy || !body.trim()}
          icon="arrow"
          onPress={() => void send()}
        >
          {busy ? "Invio in corso…" : "Invia messaggio"}
        </Button>
      </View>
    </View>
  );
}
export default function Chat() {
  const { demo, email } = useApp();
  return (
    <Screen
      back
      eyebrow="UNO SPAZIO PER LE TUE DOMANDE"
      title="Dott.sa Gaia"
      subtitle="La tua conversazione privata."
    >
      <Conversation key={email ?? "guest"} demo={demo} email={email} />
    </Screen>
  );
}
