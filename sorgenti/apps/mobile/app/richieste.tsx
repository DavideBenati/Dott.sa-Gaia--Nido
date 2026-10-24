import React, { useEffect, useRef, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { router } from "expo-router";
import { client, useApp } from "../src/state";
import { useEditorAccess } from "../src/editor-access";
import { Text, TextInput } from "../src/typography";
import { Screen, Button, Notice, StageHeading, ui } from "../src/ui";
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
type Status = "new" | "contacted" | "closed";
const label = (value: string) =>
  value === "new" ? "Nuova" : value === "contacted" ? "Contattata" : "Chiusa";
// PostgREST's OR grammar needs quoted values; LIKE wildcards are escaped so
// a name/email query remains a literal substring, not a filter expression.
const literalSearch = (value: string) => {
  const pattern = `%${value.replace(/[\\%_]/g, "\\$&")}%`;
  return `"${pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
};
function focusResults() {
  if (Platform.OS !== "web") return;
  requestAnimationFrame(() => {
    const target = document.getElementById("richieste-risultati");
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start", behavior: "instant" });
  });
}
export default function Requests() {
  const { email } = useApp();
  return (
    <Screen
      professional
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
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const pending = useRef(new Set<string>());
  useEffect(() => {
    let active = true;
    if (!allowed || !client) return;
    setLoading(true);
    setError("");
    let query = client.from("booking_requests").select("*", { count: "exact" });
    if (filter !== "all") query = query.eq("status", filter);
    if (search) {
      const pattern = literalSearch(search);
      query = query.or(`name.ilike.${pattern},email.ilike.${pattern}`);
    }
    void query
      .order("created_at", { ascending: false })
      .order("id")
      .range(page * 25, page * 25 + 24)
      .then(({ data, count, error: readError }) => {
        if (!active) return;
        if (readError) {
          setError(
            "Non è stato possibile caricare le richieste. Verifica la connessione e l’accesso, poi riprova.",
          );
        } else {
          setItems((data ?? []) as Booking[]);
          setTotal(typeof count === "number" ? count : null);
          if (typeof count === "number" && page > 0 && page * 25 >= count)
            setPage(Math.max(0, Math.ceil(count / 25) - 1));
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [allowed, page, version, filter, search]);
  async function status(item: Booking, value: Status) {
    if (!client || pending.current.has(item.id)) return;
    pending.current.add(item.id);
    setBusyIds((old) => ({ ...old, [item.id]: true }));
    setFeedback((old) => ({ ...old, [item.id]: "Aggiornamento in corso…" }));
    try {
      const { data, error: saveError } = await client
        .from("booking_requests")
        .update({ status: value })
        .eq("id", item.id)
        .select("id,status")
        .single();
      if (saveError || !data || data.id !== item.id || data.status !== value)
        throw new Error();
      const success = `Stato aggiornato: ${label(value).toLowerCase()}. Nessuna email inviata.`;
      setFeedback((old) => ({ ...old, [item.id]: success }));
      if (filter !== "all" && filter !== value)
        setNotice(
          `Richiesta di ${item.name}: ${label(value).toLowerCase()}. Non compare più nel filtro attuale.`,
        );
      setVersion((v) => v + 1);
    } catch {
      setFeedback((old) => ({
        ...old,
        [item.id]:
          "Aggiornamento non riuscito. La richiesta non risulta modificata: riprova.",
      }));
    } finally {
      pending.current.delete(item.id);
      setBusyIds((old) => ({ ...old, [item.id]: false }));
    }
  }
  async function openEmail(item: Booking) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) {
      setFeedback((old) => ({
        ...old,
        [item.id]:
          "Indirizzo email non valido: verifica il contatto prima di scrivere.",
      }));
      return;
    }
    try {
      await Linking.openURL(
        `mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent("Richiesta d’incontro — metiMaia")}`,
      );
    } catch {
      setFeedback((old) => ({
        ...old,
        [item.id]:
          "Non è stato possibile aprire l’app email. Puoi copiare l’indirizzo mostrato.",
      }));
    }
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
          <View style={[ui.card, { gap: 12 }]}>
            <Text style={ui.label}>Cerca per nome o email</Text>
            <TextInput
              accessibilityLabel="Cerca richieste per nome o email"
              value={searchInput}
              onChangeText={setSearchInput}
              maxLength={150}
              onSubmitEditing={() => {
                setSearch(searchInput.trim());
                setPage(0);
                setNotice("");
              }}
              style={ui.input}
            />
            <Button
              onPress={() => {
                setSearch(searchInput.trim());
                setPage(0);
                setNotice("");
              }}
            >
              Cerca richieste
            </Button>
            {(search || searchInput) && (
              <Button
                variant="quiet"
                onPress={() => {
                  setSearchInput("");
                  setSearch("");
                  setPage(0);
                  setNotice("");
                }}
              >
                Cancella ricerca richieste
              </Button>
            )}
            <Text style={ui.label}>Stato della richiesta</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(
                [
                  ["all", "Tutte le richieste"],
                  ["new", "Nuove"],
                  ["contacted", "Contattate"],
                  ["closed", "Chiuse"],
                ] as const
              ).map(([value, title]) => (
                <View key={value} style={{ flexGrow: 1, minWidth: 115 }}>
                  <Button
                    variant={filter === value ? "secondary" : "quiet"}
                    onPress={() => {
                      setFilter(value);
                      setPage(0);
                      setNotice("");
                    }}
                  >{`${filter === value ? "✓ " : ""}${title}`}</Button>
                </View>
              ))}
            </View>
          </View>
          <Button
            variant="secondary"
            disabled={loading}
            onPress={() => setVersion((v) => v + 1)}
          >
            Aggiorna richieste
          </Button>
          <StageHeading id="richieste-risultati">
            Risultati richieste
          </StageHeading>
          {notice !== "" && (
            <View accessibilityRole="status" accessibilityLiveRegion="polite">
              <Notice>{notice}</Notice>
            </View>
          )}
          {loading ? (
            <Notice>Caricamento richieste…</Notice>
          ) : error ? (
            <View accessibilityRole="alert" style={{ gap: 12 }}>
              <Notice>{error}</Notice>
              <Button onPress={() => setVersion((v) => v + 1)}>
                Riprova caricamento richieste
              </Button>
            </View>
          ) : (
            <>
              <Text style={ui.body}>
                Pagina {page + 1}
                {total !== null
                  ? ` di ${Math.max(1, Math.ceil(total / 25))} · ${total} richieste trovate`
                  : ""}
              </Text>
              {items.length === 0 && (
                <Text style={ui.body}>
                  {search || filter !== "all"
                    ? "Nessuna richiesta corrisponde alla ricerca e al filtro."
                    : "Nessuna richiesta in questa pagina."}
                </Text>
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
                    {label(item.status)}
                  </Text>
                  {!item.mail_sent && (
                    <Notice>
                      La richiesta è salvata qui; la notifica email non risulta
                      inviata.
                    </Notice>
                  )}
                  <Button
                    variant="secondary"
                    onPress={() => void openEmail(item)}
                  >{`Scrivi email a ${item.name}`}</Button>
                  {feedback[item.id] && (
                    <View
                      accessibilityRole="status"
                      accessibilityLiveRegion="polite"
                    >
                      <Notice>{feedback[item.id]}</Notice>
                    </View>
                  )}
                  <Button
                    variant="secondary"
                    disabled={busyIds[item.id] || item.status === "contacted"}
                    onPress={() => void status(item, "contacted")}
                  >
                    Segna come contattata
                  </Button>
                  <Button
                    variant="quiet"
                    disabled={busyIds[item.id] || item.status === "closed"}
                    onPress={() => void status(item, "closed")}
                  >
                    Chiudi richiesta
                  </Button>
                  {item.status === "closed" && (
                    <Button
                      variant="quiet"
                      disabled={busyIds[item.id]}
                      onPress={() => void status(item, "new")}
                    >
                      Riapri richiesta
                    </Button>
                  )}
                </View>
              ))}
              <Button
                variant="quiet"
                disabled={page === 0}
                onPress={() => {
                  setPage((v) => v - 1);
                  focusResults();
                }}
              >
                Pagina precedente
              </Button>
              <Button
                variant="quiet"
                disabled={
                  total !== null ? (page + 1) * 25 >= total : items.length < 25
                }
                onPress={() => {
                  setPage((v) => v + 1);
                  focusResults();
                }}
              >
                Altre richieste
              </Button>
            </>
          )}
        </>
      )}
    </View>
  );
}
