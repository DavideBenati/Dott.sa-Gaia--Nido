import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { client, useApp } from "../src/state";
import { useEditorAccess } from "../src/editor-access";
import { Text } from "../src/typography";
import { Screen, Button, Notice, ui } from "../src/ui";
type Booking = {
  id: string;
  name: string;
  email: string;
  topic: string;
  preferred_date: string | null;
  preferred_time: string;
  preferred_mode: string;
  status: string;
  created_at: string;
  mail_sent: boolean;
};
export default function Requests() {
  const { email } = useApp();
  return (
    <Screen
      back
      title="Richieste d’incontro"
      subtitle="La richiesta non è un appuntamento confermato."
    >
      {email ? (
        <RequestsContent key={email} />
      ) : (
        <Button onPress={() => router.push("/account?mode=login")}>
          Accedi
        </Button>
      )}
    </Screen>
  );
}
function RequestsContent() {
  const { allowed, checking } = useEditorAccess();
  const [items, setItems] = useState<Booking[]>([]);
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (!allowed || !client) return;
    void client
      .from("booking_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id")
      .range(page * 25, page * 25 + 24)
      .then(({ data, error }) => {
        if (active) {
          if (error)
            setMessage(
              "Richieste non disponibili: verifica la configurazione v3 in Supabase.",
            );
          else {
            setItems(data as Booking[]);
            setMessage("");
          }
        }
      });
    return () => {
      active = false;
    };
  }, [allowed, page, version]);
  async function status(id: string, value: string) {
    if (!client || busy) return;
    setBusy(true);
    const { error } = await client
      .from("booking_requests")
      .update({ status: value })
      .eq("id", id);
    if (error) setMessage("Aggiornamento non riuscito.");
    else setVersion((v) => v + 1);
    setBusy(false);
  }
  return (
    <View
      style={{ gap: 20, maxWidth: 800, width: "100%", alignSelf: "center" }}
    >
      {checking ? (
        <Notice>Verifica permessi…</Notice>
      ) : !allowed ? (
        <Notice>
          Accesso riservato agli account professionali autorizzati.
        </Notice>
      ) : (
        <>
          <Notice>
            Contatta la persona per concordare disponibilità, modalità e costi.
            “Contattata” e “Chiusa” sono stati interni, non inviano conferme
            automatiche.
          </Notice>
          <Button variant="secondary" onPress={() => setVersion((v) => v + 1)}>
            Aggiorna richieste
          </Button>
          {items.length === 0 && !message && (
            <Text style={ui.body}>Nessuna richiesta in questa pagina.</Text>
          )}
          {items.map((item) => (
            <View key={item.id} style={[ui.card, { gap: 12 }]}>
              <Text style={ui.heading}>{item.name}</Text>
              <Text selectable style={ui.body}>
                {item.email}
                {"\n"}
                {item.topic}
                {"\n"}
                {item.preferred_date ?? "Data da concordare"} ·{" "}
                {item.preferred_time}
                {"\n"}
                {item.preferred_mode}
              </Text>
              <Text style={ui.label}>
                {new Date(item.created_at).toLocaleString("it-IT")} ·{" "}
                {item.status === "new"
                  ? "Nuova"
                  : item.status === "contacted"
                    ? "Contattata"
                    : "Chiusa"}
              </Text>
              {!item.mail_sent && (
                <Notice>
                  La richiesta è salvata qui; la notifica email non risulta
                  inviata.
                </Notice>
              )}
              <Button
                variant="secondary"
                disabled={busy}
                onPress={() => void status(item.id, "contacted")}
              >
                Segna come contattata
              </Button>
              <Button
                variant="quiet"
                disabled={busy}
                onPress={() => void status(item.id, "closed")}
              >
                Chiudi richiesta
              </Button>
            </View>
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
            disabled={items.length < 25}
            onPress={() => setPage((v) => v + 1)}
          >
            Altre richieste
          </Button>
        </>
      )}
      {message !== "" && (
        <View accessibilityRole="alert">
          <Notice>{message}</Notice>
        </View>
      )}
    </View>
  );
}
