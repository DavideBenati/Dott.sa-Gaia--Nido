import React, { useEffect, useRef, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { router, useIsFocused } from "expo-router";
import { useApp } from "../src/state";
import { useEditorAccess } from "../src/editor-access";
import { Text, TextInput } from "../src/typography";
import { Button, Notice, Screen, ui } from "../src/ui";
import { useUnsavedChanges } from "../src/unsaved-changes";
import {
  createCallInvitation,
  listCallInvitations,
  openCallInvitation,
  revokeCallInvitation,
  searchCallRecipients,
  type CallInvitation,
  type CallRecipient,
} from "../src/video-calls";

export default function VideoCalls() {
  const { email } = useApp();
  const focused = useIsFocused();
  return (
    <Screen
      back
      title="Videochiamate con Gaia"
      subtitle="Uno spazio per gli incontri concordati, anche a distanza."
    >
      {!email ? (
        <>
          <Notice>
            Accedi per vedere gli inviti riservati al tuo account.
          </Notice>
          <Button onPress={() => router.push("/account?mode=login")}>
            Accedi
          </Button>
        </>
      ) : focused ? (
        <Workspace key={email} />
      ) : null}
    </Screen>
  );
}
function Workspace() {
  const { allowed, checking } = useEditorAccess();
  const [invitations, setInvitations] = useState<CallInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CallRecipient[]>([]);
  const [selected, setSelected] = useState<CallRecipient | null>(null);
  const [room, setRoom] = useState("");
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [message, setMessage] = useState("");
  const mounted = useRef(true);
  const { confirmDiscard } = useUnsavedChanges(Boolean(selected || room));
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (checking) return;
    let active = true;
    setLoading(true);
    setError("");
    setInvitations([]);
    void listCallInvitations(allowed)
      .then((data) => {
        if (active) setInvitations(data);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Caricamento non riuscito.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [allowed, checking, version]);
  useEffect(() => {
    let active = true;
    setResults([]);
    setSearchError("");
    if (!allowed || term.trim().length < 2) {
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      void searchCallRecipients(term)
        .then((data) => {
          if (active) setResults(data);
        })
        .catch((cause: unknown) => {
          if (active)
            setSearchError(
              cause instanceof Error ? cause.message : "Ricerca non riuscita.",
            );
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term, allowed]);
  async function create() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await createCallInvitation(selected.user_id, room);
      if (!mounted.current) return;
      setRoom("");
      setSelected(null);
      setTerm("");
      setMessage(
        "Invito creato. La cliente lo trova in Profilo → Videochiamate. Avvisala via email dell’orario concordato: questo pannello non invia email.",
      );
      setVersion((v) => v + 1);
    } catch (cause) {
      if (mounted.current)
        setError(cause instanceof Error ? cause.message : "Invito non creato.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function act(invitation: CallInvitation, revoke: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (revoke) {
        await revokeCallInvitation(invitation.id);
        if (mounted.current) {
          setMessage("Invito rimosso dall’area personale.");
          setVersion((v) => v + 1);
        }
      } else {
        const url = await openCallInvitation(invitation.id);
        if (mounted.current) {
          // A verified invitation opens in this tab, so Safari cannot block a
          // new window after the asynchronous authorization request.
          if (Platform.OS === "web") window.location.assign(url);
          else await Linking.openURL(url);
        }
      }
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error ? cause.message : "Operazione non riuscita.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  if (checking) return <Notice>Verifica dell’account…</Notice>;
  return (
    <>
      <Notice>
        L’incontro si apre su Hostpoint Meet, un servizio esterno. Telecamera e
        microfono si gestiscono lì. L’orario va concordato con Gaia via email.
      </Notice>
      {allowed && (
        <View style={ui.card}>
          <Text style={ui.heading}>Prepara un incontro</Text>
          <Text style={ui.body}>
            1. Apri Hostpoint Meet e crea una stanza diversa per ogni incontro.
            Usa un nome casuale, senza nomi o dati delle clienti. Proteggi
            l’accesso con le opzioni disponibili nel servizio.
          </Text>
          <Button
            variant="secondary"
            onPress={() => {
              void Linking.openURL("https://meet.hostpoint.ch").catch(() =>
                setError("Non è stato possibile aprire Hostpoint Meet."),
              );
            }}
          >
            Apri Hostpoint Meet
          </Button>
          <Text style={ui.body}>
            2. Cerca l’account confermato. Controlla anche l’email: due persone
            possono usare lo stesso nickname.
          </Text>
          <TextInput
            style={ui.input}
            accessibilityLabel="Cerca destinatario videochiamata"
            value={term}
            onChangeText={setTerm}
            placeholder="Nickname o email (almeno 2 caratteri)"
            autoCapitalize="none"
            editable={!busy}
          />
          {searching && <Text style={ui.body}>Ricerca in corso…</Text>}
          {!!searchError && <Notice>{searchError}</Notice>}
          {!searching &&
            !searchError &&
            term.trim().length >= 2 &&
            !results.length && (
              <Text style={ui.body}>Nessun account confermato trovato.</Text>
            )}
          {results.map((user) => (
            <View key={user.user_id} style={ui.card}>
              <Text style={ui.heading}>
                {user.nickname || "Nickname non impostato"}
              </Text>
              <Text style={ui.body}>{user.email}</Text>
              <Button
                variant={
                  selected?.user_id === user.user_id ? "primary" : "secondary"
                }
                disabled={busy}
                onPress={() => setSelected(user)}
              >
                {selected?.user_id === user.user_id
                  ? "Destinatario selezionato"
                  : "Scegli questo account"}
              </Button>
            </View>
          ))}
          {selected && (
            <Notice>{`Invito per ${selected.nickname || "Account"} · ${selected.email}`}</Notice>
          )}
          <Text style={ui.body}>
            3. Incolla il link completo della stanza (senza parametri). L’invito
            resta disponibile per 7 giorni. Non viene inviata alcuna email
            automatica.
          </Text>
          <TextInput
            style={ui.input}
            accessibilityLabel="Link della stanza Hostpoint"
            value={room}
            onChangeText={setRoom}
            placeholder="https://meet.hostpoint.ch/nome-casuale-stanza"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
          />
          <Button
            disabled={busy || !selected || !room.trim()}
            onPress={() => {
              void create();
            }}
          >
            Condividi l’invito con questo account
          </Button>
          {(selected || room) && (
            <Button
              variant="quiet"
              disabled={busy}
              onPress={() => {
                if (
                  confirmDiscard("Annullare l’invito non ancora condiviso?")
                ) {
                  setRoom("");
                  setSelected(null);
                  setTerm("");
                }
              }}
            >
              Annulla preparazione
            </Button>
          )}
        </View>
      )}
      <View style={ui.card}>
        <Text style={ui.heading}>
          {allowed ? "Inviti attivi" : "I tuoi inviti"}
        </Text>
        {loading ? (
          <Notice>Caricamento degli inviti…</Notice>
        ) : invitations.length ? (
          invitations.map((invitation) => (
            <View key={invitation.id} style={ui.card}>
              <Text style={ui.heading}>
                {allowed
                  ? invitation.nickname || "Nickname non impostato"
                  : "Incontro con Gaia"}
              </Text>
              {allowed && <Text style={ui.body}>{invitation.email}</Text>}
              <Text style={ui.body}>
                Disponibile fino al{" "}
                {new Date(invitation.expires_at).toLocaleString("it-IT")}
              </Text>
              <Button
                disabled={busy}
                onPress={() => {
                  void act(invitation, false);
                }}
              >
                Entra nella videochiamata
              </Button>
              {allowed && (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onPress={() => {
                    void act(invitation, true);
                  }}
                >
                  Revoca questo invito
                </Button>
              )}
            </View>
          ))
        ) : (
          !error && (
            <Notice>
              {allowed
                ? "Nessun invito attivo. Prepara un incontro e scegli un account."
                : "Non hai inviti attivi. Se hai concordato un incontro, chiedi a Gaia di abilitarlo per il tuo account."}
            </Notice>
          )
        )}
        <Button
          variant="quiet"
          disabled={busy || loading}
          onPress={() => setVersion((v) => v + 1)}
        >
          Aggiorna inviti
        </Button>
      </View>
      {!!message && <Notice>{message}</Notice>}
      {!!error && <Notice>{error}</Notice>}
      {allowed && (
        <Notice>
          La revoca impedisce di aprire l’invito da questo sito, ma non chiude
          una chiamata già avviata e non annulla un link già copiato. Gestisci
          gli accessi e termina la stanza anche su Hostpoint. Non registrare gli
          incontri senza un accordo specifico con le partecipanti.
        </Notice>
      )}
    </>
  );
}
