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
  }, [demo, email]);
  async function send() {
    if (!client || !email || demo || busy || !available || !body.trim()) return;
    setBusy(true);
    setError("");
    try {
      await sendCareMessage(client, body);
      setBody("");
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
        "Invio non riuscito. Il testo è ancora qui: controlla la connessione prima di riprovare.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View
      style={{ width: "100%", maxWidth: 720, alignSelf: "center", gap: 16 }}
    >
      <Notice warm icon="help">
        Le risposte non sono immediate. Per urgenze contatta i servizi di
        emergenza.
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
      {loading && <Text style={ui.body}>Caricamento della conversazione…</Text>}
      {!demo && email && !loading && !available && !error && (
        <Notice>
          La messaggistica non è ancora attiva. Potrai scrivere quando la
          Dott.ssa Brunetti sarà abilitata.
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
                {own ? "Tu" : "Dott.ssa Brunetti"}
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
            </View>
          );
        })}
      </View>
      {error !== "" && (
        <View accessibilityRole="alert">
          <Notice warm>{error}</Notice>
          <Button variant="quiet" onPress={() => router.replace("/chat")}>
            Ricarica conversazione
          </Button>
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
      title="Dott.ssa Gaia Brunetti"
      subtitle="La tua conversazione privata."
    >
      <Conversation key={email ?? "guest"} demo={demo} email={email} />
    </Screen>
  );
}
