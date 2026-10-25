import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { sendCareMessage, type CareMessage } from "@nido/data";
import { client, useApp } from "../src/state";
import { Text, TextInput } from "../src/typography";
import { Screen, StageHeading, Button, Notice, ui } from "../src/ui";
import { useUnsavedChanges } from "../src/unsaved-changes";
import { colors } from "../src/theme";
type Conversation = {
  user_id: string;
  nickname: string;
  email: string | null;
  last_message_at: string | null;
  last_message_preview: string;
};
const conversationLabel = (item: Conversation) =>
  item.nickname || item.email || `Conversazione ${item.user_id.slice(0, 8)}`;
export default function Inbox() {
  const { email } = useApp();
  const [phase, setPhase] = useState("list");
  useEffect(() => setPhase("list"), [email]);
  return (
    <Screen
      back
      professional
      stageKey={`${email ?? "guest"}:${phase}`}
      focusTargetId={
        phase === "list" ? "conversation-list-heading" : "conversation-heading"
      }
      stageScroll="heading"
      title="Le conversazioni di Gaia"
      subtitle="Casella riservata alla professionista autorizzata."
    >
      {email ? (
        <InboxContent key={email} onSelectionChange={setPhase} />
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
function InboxContent({
  onSelectionChange,
}: {
  onSelectionChange: (phase: string) => void;
}) {
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
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [legacy, setLegacy] = useState(false);
  const [nicknameLookup, setNicknameLookup] = useState(true);
  const [loading, setLoading] = useState(true);
  const composer = useRef<React.ComponentRef<typeof TextInput>>(null);
  const { allowNavigation } = useUnsavedChanges(Boolean(body.trim()));
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    let active = true;
    if (!client) return;
    setLoading(true);
    void (async () => {
      try {
        const { data: user, error: userError } = await client.auth.getUser();
        if (userError || !user.user) throw new Error();
        const { data, error } = await client.rpc("is_chat_staff");
        if (error || data !== true) {
          if (active) {
            setAllowed(false);
            setList([]);
          }
          return;
        }
        let contacts = await client.rpc(
          "professional_conversation_contacts_v2",
          {
            search_term: search,
            page_offset: page * 50,
            page_limit: 50,
          },
        );
        let hasNicknames = true;
        if (
          contacts.error &&
          ["PGRST202", "42883"].includes(contacts.error.code)
        ) {
          hasNicknames = false;
          contacts = await client.rpc("professional_conversation_contacts", {
            search_term: search,
            page_offset: page * 50,
            page_limit: 50,
          });
        }
        let conversations: Conversation[];
        let legacyMode = false;
        if (contacts.error) {
          // Older projects retain the protected ID list until migration 008 is
          // installed. Network/permission failures must never masquerade as an
          // empty inbox or authorize an otherwise denied lookup.
          if (!["PGRST202", "42883"].includes(contacts.error.code))
            throw contacts.error;
          const result = await client
            .from("care_conversations")
            .select("user_id,created_at")
            .order("created_at", { ascending: false })
            .order("user_id")
            .range(page * 50, page * 50 + 49);
          if (result.error) throw result.error;
          conversations = (result.data ?? []).map((item) => ({
            user_id: item.user_id,
            nickname: "",
            email: null,
            last_message_at: item.created_at,
            last_message_preview: "",
          }));
          legacyMode = true;
        } else {
          if (
            !Array.isArray(contacts.data) ||
            contacts.data.some(
              (item: Conversation) =>
                typeof item.user_id !== "string" ||
                (hasNicknames && typeof item.nickname !== "string") ||
                (item.email !== null && typeof item.email !== "string") ||
                (item.last_message_at !== null &&
                  typeof item.last_message_at !== "string") ||
                typeof item.last_message_preview !== "string",
            )
          )
            throw new Error("Elenco contatti non valido.");
          conversations = contacts.data.map((item: Conversation) => ({
            ...item,
            nickname: hasNicknames ? item.nickname : "",
          })) as Conversation[];
        }
        if (active) {
          setAllowed(true);
          setLegacy(legacyMode);
          setNicknameLookup(hasNicknames);
          setList(conversations);
          setError("");
        }
      } catch {
        if (active) {
          setList([]);
          setError(
            "Impossibile caricare le conversazioni. Verifica l’accesso e riprova.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [page, refresh, search]);
  useEffect(() => {
    let active = true;
    let inflight = false;
    if (!client || !selected || allowed !== true) return;
    setMessages([]);
    setOffset(0);
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
  const visibleList =
    legacy && search
      ? list.filter((item) =>
          item.user_id.toLowerCase().includes(search.toLowerCase()),
        )
      : list;
  const selectedConversation = list.find((item) => item.user_id === selected);
  function chooseConversation(item: Conversation) {
    allowNavigation(() => {
      setBody("");
      setSelected(item.user_id);
      setNotice("");
      setError("");
      onSelectionChange(item.user_id);
    }, "Cambiare conversazione? La risposta non inviata sarà scartata.");
  }
  function backToList() {
    allowNavigation(() => {
      setSelected("");
      setBody("");
      setNotice("");
      setError("");
      onSelectionChange("list");
    }, "Tornare alle conversazioni? La risposta non inviata sarà scartata.");
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
          <Button
            variant="secondary"
            onPress={() => allowNavigation(() => router.push("/sicurezza"))}
          >
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
              <StageHeading id="conversation-list-heading">
                Conversazioni
              </StageHeading>
              <TextInput
                accessibilityLabel={
                  legacy
                    ? "Cerca identificativo in questa pagina"
                    : nicknameLookup
                      ? "Cerca conversazioni per nickname o email"
                      : "Cerca conversazioni per email"
                }
                placeholder={
                  legacy
                    ? "Identificativo in questa pagina"
                    : nicknameLookup
                      ? "Cerca per nickname o email"
                      : "Cerca per email"
                }
                value={query}
                onChangeText={setQuery}
                maxLength={254}
                style={ui.input}
              />
              <Button
                variant="secondary"
                disabled={loading}
                onPress={() => setRefresh((value) => value + 1)}
              >
                Aggiorna conversazioni
              </Button>
              {legacy && (
                <Notice>
                  Le conversazioni sono disponibili per identificativo. Per
                  mostrare email e ultima attività applica l’aggiornamento
                  Supabase 008. La ricerca per identificativo riguarda solo
                  questa pagina.
                </Notice>
              )}
              {!legacy && !nicknameLookup && (
                <Notice>
                  I nickname saranno disponibili con l’aggiornamento degli
                  iscritti. Puoi cercare le conversazioni per email.
                </Notice>
              )}
              {loading ? (
                <Text style={ui.body}>Caricamento conversazioni…</Text>
              ) : error && list.length === 0 ? null : visibleList.length ===
                0 ? (
                <Text style={ui.body}>
                  {search
                    ? "Nessuna conversazione corrisponde alla ricerca."
                    : "Nessuna conversazione in questa pagina."}
                </Text>
              ) : (
                visibleList.map((item) => (
                  <View key={item.user_id} style={[ui.card, { gap: 10 }]}>
                    <Text style={ui.heading}>{conversationLabel(item)}</Text>
                    {item.nickname && item.email && (
                      <Text selectable style={ui.body}>
                        {item.email}
                      </Text>
                    )}
                    <Text style={ui.body}>
                      {item.last_message_at
                        ? `${legacy ? "Creata il " : "Ultima attività: "}${new Date(item.last_message_at).toLocaleString("it-IT")}`
                        : "Nessun messaggio"}
                    </Text>
                    {item.last_message_preview !== "" && (
                      <Text numberOfLines={2} style={ui.body}>
                        {item.last_message_preview}
                      </Text>
                    )}
                    <Button
                      variant="secondary"
                      accessibilityLabel={
                        legacy
                          ? undefined
                          : `Apri conversazione: ${conversationLabel(item)}${item.nickname && item.email ? ` · ${item.email}` : ""}`
                      }
                      onPress={() => chooseConversation(item)}
                    >
                      {legacy
                        ? `Conversazione ${item.user_id.slice(0, 8)} · ${item.last_message_at ? new Date(item.last_message_at).toLocaleDateString("it-IT") : "Nessun messaggio"}`
                        : `Apri conversazione: ${conversationLabel(item)}`}
                    </Button>
                  </View>
                ))
              )}
              <Text style={ui.body}>{`Pagina ${page + 1}`}</Text>
              <Button
                variant="quiet"
                disabled={loading || page === 0}
                onPress={() => setPage((v) => v - 1)}
              >
                Pagina precedente
              </Button>
              <Button
                variant="quiet"
                disabled={loading || list.length < 50}
                onPress={() => setPage((v) => v + 1)}
              >
                Altre conversazioni
              </Button>
            </>
          ) : (
            <>
              <Button variant="quiet" disabled={busy} onPress={backToList}>
                Torna alle conversazioni
              </Button>
              <StageHeading id="conversation-heading">
                {selectedConversation
                  ? conversationLabel(selectedConversation)
                  : `Conversazione ${selected.slice(0, 8)}`}
              </StageHeading>
              {selectedConversation?.nickname && selectedConversation.email && (
                <Text selectable style={ui.body}>
                  {selectedConversation.email}
                </Text>
              )}
              <Button
                variant="secondary"
                onPress={() => composer.current?.focus()}
              >
                Vai alla risposta
              </Button>
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
                    {m.sender_id === selected
                      ? selectedConversation?.nickname
                        ? `Iscritto/a · ${selectedConversation.nickname}`
                        : "Utente"
                      : "Dott.sa Gaia"}
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
                ref={composer}
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
              {body.trim() !== "" && (
                <Text style={ui.body}>
                  Risposta non inviata. Conferma prima di uscire per scartarla.
                </Text>
              )}
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
