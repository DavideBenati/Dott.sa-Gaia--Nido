import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { sendCareMessage, type CareMessage } from "@nido/data";
import { client, useApp } from "../src/state";
import { Text, TextInput } from "../src/typography";
import { Screen, Button, Notice, ui } from "../src/ui";
import { colors } from "../src/theme";
type Conversation = { user_id: string; created_at: string };
export default function Inbox() {
  const { email } = useApp();
  return (
    <Screen
      back
      title="Le conversazioni di Gaia"
      subtitle="Casella riservata alla professionista autorizzata."
    >
      {email ? (
        <InboxContent key={email} />
      ) : (
        <>
          <Notice>Accedi con l’account professionale di Gaia.</Notice>
          <Button onPress={() => router.push("/account?mode=login")}>
            Accedi
          </Button>
        </>
      )}
    </Screen>
  );
}
function InboxContent() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [list, setList] = useState<Conversation[]>([]);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState("");
  const [messages, setMessages] = useState<CareMessage[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [older, setOlder] = useState(false);
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    if (!client) return;
    void (async () => {
      try {
        const { data: user, error: userError } = await client.auth.getUser();
        if (userError || !user.user) throw new Error();
        const { data, error } = await client.rpc("is_chat_staff");
        if (error || data !== true) {
          if (active) setAllowed(false);
          return;
        }
        const result = await client
          .from("care_conversations")
          .select("user_id,created_at")
          .order("created_at", { ascending: false })
          .order("user_id")
          .range(page * 50, page * 50 + 49);
        if (result.error) throw result.error;
        if (active) {
          setAllowed(true);
          setList(result.data ?? []);
          setError("");
        }
      } catch {
        if (active)
          setError(
            "Impossibile caricare le conversazioni. Verifica l’accesso e riprova.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [page, refresh]);
  useEffect(() => {
    let active = true;
    let inflight = false;
    if (!client || !selected || allowed !== true) return;
    setMessages([]);
    setOffset(0);
    setBody("");
    setNotice("");
    async function load() {
      if (inflight) return;
      inflight = true;
      try {
        const { data, error } = await client!
          .from("care_messages")
          .select("id,conversation_id,sender_id,body,created_at")
          .eq("conversation_id", selected)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(100);
        if (error) throw error;
        if (active) {
          const latest = (data ?? []) as CareMessage[];
          setMessages((previous) =>
            [
              ...previous.filter((m) => !latest.some((n) => n.id === m.id)),
              ...latest,
            ].sort(
              (a, b) =>
                a.created_at.localeCompare(b.created_at) ||
                a.id.localeCompare(b.id),
            ),
          );
          setOlder(latest.length === 100);
          setError("");
        }
      } catch {
        if (active)
          setError(
            "Aggiornamento non riuscito. I messaggi già caricati restano visibili; nessuna risposta viene inviata automaticamente.",
          );
      } finally {
        inflight = false;
      }
    }
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selected, allowed]);
  async function loadOlder() {
    if (!client || busy) return;
    setBusy(true);
    try {
      const next = offset + 100;
      const { data, error } = await client
        .from("care_messages")
        .select("id,conversation_id,sender_id,body,created_at")
        .eq("conversation_id", selected)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(next, next + 99);
      if (error) throw error;
      setMessages((previous) =>
        [
          ...(data as CareMessage[]).filter(
            (m) => !previous.some((p) => p.id === m.id),
          ),
          ...previous,
        ].sort(
          (a, b) =>
            a.created_at.localeCompare(b.created_at) ||
            a.id.localeCompare(b.id),
        ),
      );
      setOffset(next);
      setOlder(data.length === 100);
    } catch {
      setError("Non è stato possibile caricare i messaggi precedenti.");
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!client || busy || !body.trim() || !selected) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sendCareMessage(client, body, selected);
      setBody("");
      setNotice(
        "Risposta salvata. La lettura da parte della destinataria non è verificabile.",
      );
      const { data, error } = await client
        .from("care_messages")
        .select("id,conversation_id,sender_id,body,created_at")
        .eq("conversation_id", selected)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(100);
      if (!error)
        setMessages((previous) =>
          [
            ...previous.filter((m) => !data.some((n) => n.id === m.id)),
            ...data,
          ].sort(
            (a, b) =>
              a.created_at.localeCompare(b.created_at) ||
              a.id.localeCompare(b.id),
          ),
        );
    } catch {
      setError(
        "Invio non confermato. Il testo è conservato: controlla la conversazione prima di riprovare, per evitare duplicati.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <View
      style={{ gap: 20, maxWidth: 900, width: "100%", alignSelf: "center" }}
    >
      <Notice>
        Le conversazioni contengono dati personali. Usa un dispositivo riservato
        e chiudi la sessione dopo l’uso. Il ruolo editoriale da solo non
        permette di leggere queste chat.
      </Notice>
      {allowed === null && !error && (
        <Text style={ui.body}>Verifica accesso…</Text>
      )}
      {allowed === false && (
        <>
          <Notice>
            Accesso chat non autorizzato. Occorre il permesso dedicato a Gaia;
            se hai attivato la protezione a due fattori, verifica prima il
            codice.
          </Notice>
          <Button variant="secondary" onPress={() => router.push("/sicurezza")}>
            Verifica accesso a due fattori
          </Button>
        </>
      )}
      {error !== "" && (
        <View accessibilityRole="alert">
          <Notice warm>{error}</Notice>
          <Button variant="quiet" onPress={() => setRefresh((v) => v + 1)}>
            Riprova caricamento casella
          </Button>
        </View>
      )}
      {allowed && (
        <>
          {!selected ? (
            <>
              <Text style={ui.heading}>Conversazioni</Text>
              {list.length === 0 && (
                <Text style={ui.body}>
                  Nessuna conversazione in questa pagina.
                </Text>
              )}
              {list.map((item) => (
                <Button
                  key={item.user_id}
                  variant="secondary"
                  onPress={() => setSelected(item.user_id)}
                >{`Conversazione ${item.user_id.slice(0, 8)} · ${new Date(item.created_at).toLocaleDateString("it-IT")}`}</Button>
              ))}
              <Button
                variant="quiet"
                disabled={page === 0}
                onPress={() => setPage((v) => v - 1)}
              >
                Pagina precedente
              </Button>
              <Button
                variant="quiet"
                disabled={list.length < 50}
                onPress={() => setPage((v) => v + 1)}
              >
                Altre conversazioni
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="quiet"
                disabled={busy}
                onPress={() => {
                  setSelected("");
                  setNotice("");
                  setError("");
                }}
              >
                Torna alle conversazioni
              </Button>
              <Text
                style={ui.label}
              >{`Conversazione ${selected.slice(0, 8)}`}</Text>
              {older && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onPress={() => void loadOlder()}
                >
                  Carica messaggi precedenti
                </Button>
              )}
              {messages.map((m) => (
                <View
                  key={m.id}
                  style={[
                    ui.card,
                    {
                      gap: 8,
                      backgroundColor:
                        m.sender_id === selected
                          ? colors.paper
                          : colors.sagePale,
                    },
                  ]}
                >
                  <Text style={ui.label}>
                    {m.sender_id === selected ? "Utente" : "Gaia Brunetti"}
                  </Text>
                  <Text selectable style={ui.body}>
                    {m.body}
                  </Text>
                  <Text style={ui.label}>
                    {new Date(m.created_at).toLocaleString("it-IT")}
                  </Text>
                </View>
              ))}
              <TextInput
                accessibilityLabel="Risposta di Gaia"
                placeholder="Scrivi una risposta…"
                value={body}
                onChangeText={setBody}
                multiline
                maxLength={4000}
                editable={!busy}
                style={[ui.input, { minHeight: 100, textAlignVertical: "top" }]}
              />
              <Text style={ui.body}>{body.length}/4000 caratteri</Text>
              {notice !== "" && (
                <View accessibilityRole="status">
                  <Notice>{notice}</Notice>
                </View>
              )}
              <Button
                disabled={busy || !body.trim()}
                onPress={() => void send()}
              >
                {busy ? "Invio…" : "Invia risposta"}
              </Button>
            </>
          )}
        </>
      )}
    </View>
  );
}
