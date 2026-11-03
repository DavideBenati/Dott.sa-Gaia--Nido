import React, { useEffect, useRef, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import { useApp } from "../src/state";
import { useEditorAccess } from "../src/editor-access";
import { Text, TextInput } from "../src/typography";
import { Button, Notice, Screen, ui } from "../src/ui";
import { useUnsavedChanges } from "../src/unsaved-changes";
import {
  callInvitationLink,
  invitationId,
  prepareHostpointLink,
} from "../src/video-call-links";
import {
  createCallInvitation,
  listCallInvitations,
  listCallEmailStatus,
  openCallInvitation,
  revokeCallInvitation,
  searchCallRecipients,
  sendCallInvitation,
  type CallInvitation,
  type CallRecipient,
  type CallEmailStatus,
} from "../src/video-calls";

export default function VideoCalls() {
  const { email } = useApp();
  const focused = useIsFocused();
  const params = useLocalSearchParams<{ invito?: string }>();
  const requested = invitationId(params.invito);
  return (
    <Screen
      back
      title="Videochiamate con Gaia"
      subtitle="Gli incontri concordati, in un solo posto."
    >
      {params.invito && !requested ? (
        <Notice>
          Questo link non è valido. Chiedi a Gaia un nuovo invito.
        </Notice>
      ) : !email ? (
        <>
          <Notice>
            Per aprire la videochiamata, accedi con l’account a cui Gaia ha
            mandato l’invito.
          </Notice>
          <Button
            onPress={() =>
              router.push(
                `/account?mode=login&returnTo=${encodeURIComponent(requested ? `video_calls:${requested}` : "video_calls")}`,
              )
            }
          >
            Accedi
          </Button>
        </>
      ) : focused ? (
        <Workspace key={email} requested={requested} />
      ) : null}
    </Screen>
  );
}

function Workspace({ requested }: { requested: string | null }) {
  const { allowed, checking } = useEditorAccess();
  const [invitations, setInvitations] = useState<CallInvitation[]>([]);
  const [emailStates, setEmailStates] = useState<
    Record<string, CallEmailStatus>
  >({});
  const [emailError, setEmailError] = useState("");
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
  const [saved, setSaved] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);
  const mounted = useRef(true);
  const actionLock = useRef(false);
  const { confirmDiscard } = useUnsavedChanges(
    Boolean(selected || room || term.trim()),
  );
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
    setEmailError("");
    setInvitations([]);
    setEmailStates({});
    void (async () => {
      try {
        const data = await listCallInvitations(allowed);
        if (!active) return;
        setInvitations(data);
        if (allowed && data.length) {
          try {
            const states = await listCallEmailStatus(data.map((row) => row.id));
            if (active)
              setEmailStates(
                Object.fromEntries(
                  states.map((row) => [row.invitation_id, row]),
                ),
              );
          } catch {
            if (active)
              setEmailError(
                "Le videochiamate sono disponibili, ma non riusciamo a verificare gli invii email. Aggiorna gli inviti; se il problema continua, verifica la configurazione del servizio email.",
              );
          }
        }
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Caricamento non riuscito.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [allowed, checking, version]);
  useEffect(() => {
    let active = true;
    setResults([]);
    setSearchError("");
    if (!allowed || selected || term.trim().length < 2) {
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
  }, [term, allowed, selected]);

  async function run(operation: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operation();
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error ? cause.message : "Operazione non riuscita.",
        );
    } finally {
      actionLock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function create() {
    if (!selected) return;
    void run(async () => {
      const id = await createCallInvitation(selected.user_id, room);
      if (!mounted.current) return;
      setRoom("");
      setSelected(null);
      setTerm("");
      setSaved(id);
      setPreparing(false);
      setMessage(
        "Videochiamata salvata. L’email non è ancora partita: premi «Invia invito» nella scheda qui sotto.",
      );
      setVersion((v) => v + 1);
    });
  }
  function act(
    invitation: CallInvitation,
    action: "open" | "revoke" | "email",
  ) {
    void run(async () => {
      if (action === "email") {
        try {
          const result = await sendCallInvitation(invitation.id);
          if (mounted.current)
            setEmailStates((previous) => ({
              ...previous,
              [invitation.id]: { ...result, invitation_id: invitation.id },
            }));
        } catch (cause) {
          if (mounted.current)
            setEmailStates((previous) => {
              const next = { ...previous };
              delete next[invitation.id];
              return next;
            });
          throw cause;
        }
      } else if (action === "revoke") {
        await revokeCallInvitation(invitation.id);
        if (mounted.current) {
          setMessage("Invito rimosso dall’area personale.");
          setVersion((v) => v + 1);
        }
      } else {
        const url = await openCallInvitation(invitation.id);
        if (!mounted.current) return;
        // Same-tab navigation avoids a popup blocked after async authorization.
        if (Platform.OS === "web") window.location.assign(url);
        else await Linking.openURL(url);
      }
    });
  }
  const visible = requested
    ? invitations.filter((row) => row.id === requested)
    : invitations;
  if (checking) return <Notice>Verifica dell’account…</Notice>;
  return (
    <>
      {allowed && !preparing && (
        <Button variant="secondary" onPress={() => setPreparing(true)}>
          Prepara un’altra videochiamata
        </Button>
      )}
      {allowed && preparing && (
        <View style={ui.card}>
          <Text accessibilityRole="header" style={ui.heading}>
            Prepara una videochiamata
          </Text>
          <Text style={ui.body}>
            Concorda prima giorno e ora con la paziente. Poi prepara qui
            l’accesso e inviale l’invito.
          </Text>
          <Text accessibilityRole="header" style={ui.heading}>
            1. Scegli la paziente
          </Text>
          {selected ? (
            <>
              <Text style={ui.body}>
                {selected.nickname || "Account selezionato"}
              </Text>
              <Text style={ui.body}>{selected.email}</Text>
              <Button
                variant="quiet"
                disabled={busy}
                onPress={() => {
                  setSelected(null);
                  setTerm("");
                }}
              >
                Cambia destinataria
              </Button>
            </>
          ) : (
            <>
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
                  <Notice>
                    Nessun account confermato trovato. La paziente deve prima
                    registrarsi e confermare la sua email.
                  </Notice>
                )}
              {results.map((user) => (
                <View key={user.user_id} style={ui.card}>
                  <Text style={ui.heading}>
                    {user.nickname || "Nickname non impostato"}
                  </Text>
                  <Text style={ui.body}>{user.email}</Text>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onPress={() => setSelected(user)}
                  >
                    Scegli questo account
                  </Button>
                </View>
              ))}
            </>
          )}
          <Text accessibilityRole="header" style={ui.heading}>
            2. Prepara il link della stanza
          </Text>
          <Text style={ui.body}>
            Il pulsante prepara un indirizzo casuale, senza dati personali. La
            stanza Hostpoint si apre quando entri nella videochiamata.
          </Text>
          <Button
            variant="secondary"
            disabled={busy || Boolean(room)}
            onPress={() => {
              try {
                setRoom(prepareHostpointLink());
              } catch {
                setError(
                  "Non riusciamo a generare il link qui. Apri meet.hostpoint.ch nel browser, prepara una stanza con un nome casuale e incolla il link.",
                );
              }
            }}
          >
            Prepara link della stanza
          </Button>
          <Text style={ui.body}>
            Puoi anche incollare il link di una nuova stanza Hostpoint già
            preparata. Usa una stanza diversa per ogni incontro.
          </Text>
          <TextInput
            style={ui.input}
            accessibilityLabel="Link della stanza Hostpoint"
            value={room}
            onChangeText={setRoom}
            placeholder="https://meet.hostpoint.ch/…"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
          />
          <Text accessibilityRole="header" style={ui.heading}>
            3. Salva, poi invia l’invito
          </Text>
          <Text style={ui.body}>
            Salvare rende l’incontro disponibile nell’area della paziente per 7
            giorni. L’email parte solo quando premi «Invia invito».
          </Text>
          <Button disabled={busy || !selected || !room.trim()} onPress={create}>
            Salva videochiamata
          </Button>
          {Boolean(selected || room || term.trim()) && (
            <Button
              variant="quiet"
              disabled={busy}
              onPress={() => {
                if (
                  confirmDiscard(
                    "Annullare la videochiamata non ancora salvata?",
                  )
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
      {!!message && <Notice>{message}</Notice>}
      {!!error && <Notice>{error}</Notice>}
      {!!emailError && <Notice>{emailError}</Notice>}
      <View style={ui.card}>
        <Text accessibilityRole="header" style={ui.heading}>
          {allowed ? "Videochiamate salvate" : "I tuoi inviti"}
        </Text>
        {loading ? (
          <Notice>Caricamento degli inviti…</Notice>
        ) : visible.length ? (
          visible.map((invitation) => (
            <InvitationCard
              key={invitation.id}
              invitation={invitation}
              manage={allowed}
              busy={busy}
              state={emailStates[invitation.id]}
              highlighted={invitation.id === (saved || requested)}
              act={act}
            />
          ))
        ) : (
          !error && (
            <Notice>
              {requested
                ? "Questo invito è scaduto, è stato revocato oppure appartiene a un altro account. Accedi con l’email a cui Gaia lo ha inviato o chiedile un nuovo invito."
                : allowed
                  ? "Nessuna videochiamata salvata. Scegli la paziente e prepara il primo incontro."
                  : "Non hai inviti attivi. Se hai concordato un incontro, chiedi a Gaia di abilitarlo per il tuo account."}
            </Notice>
          )
        )}
        {requested && (
          <Button
            variant="quiet"
            onPress={() => router.replace("/videochiamate")}
          >
            Mostra tutti i miei inviti
          </Button>
        )}
        <Button
          variant="quiet"
          disabled={busy || loading}
          onPress={() => setVersion((v) => v + 1)}
        >
          Aggiorna inviti
        </Button>
      </View>
      <Notice>
        L’incontro si apre su Hostpoint Meet, un servizio esterno. Entra
        all’orario concordato con Gaia e consenti l’uso di microfono e
        telecamera quando richiesto.
      </Notice>
      {allowed && (
        <Notice>
          Proteggi l’accesso con le opzioni disponibili su Hostpoint. La revoca
          chiude l’accesso dall’area riservata, ma non termina una chiamata già
          aperta o un link Hostpoint già condiviso: gestisci la stanza anche nel
          servizio esterno.
        </Notice>
      )}
    </>
  );
}

function InvitationCard({
  invitation,
  manage,
  busy,
  state,
  highlighted,
  act,
}: {
  invitation: CallInvitation;
  manage: boolean;
  busy: boolean;
  state?: CallEmailStatus;
  highlighted: boolean;
  act: (
    invitation: CallInvitation,
    action: "open" | "revoke" | "email",
  ) => void;
}) {
  const [copyMessage, setCopyMessage] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [preview, setPreview] = useState(false);
  const link = callInvitationLink(invitation.id);
  const status = state?.status;
  async function copy() {
    try {
      if (Platform.OS !== "web" || !navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(link);
      setManualCopy(false);
      setCopyMessage(
        "Link copiato. Puoi incollarlo in un’email o in un messaggio alla paziente.",
      );
    } catch {
      setManualCopy(true);
      setCopyMessage(
        "Seleziona e copia il link qui sotto, poi incollalo nell’email o nel messaggio.",
      );
    }
  }
  return (
    <View style={ui.card}>
      {highlighted && <Text style={ui.body}>Invito selezionato</Text>}
      <Text accessibilityRole="header" style={ui.heading}>
        {manage
          ? invitation.nickname || "Account selezionato"
          : "Incontro con Gaia"}
      </Text>
      {manage && <Text style={ui.body}>{invitation.email}</Text>}
      <Text style={ui.body}>
        Accesso disponibile fino al{" "}
        {new Date(invitation.expires_at).toLocaleString("it-IT")}. Questa è la
        scadenza del link, non l’orario dell’appuntamento.
      </Text>
      {manage && (
        <>
          <Text accessibilityLiveRegion="polite" style={ui.body}>
            {status === "not_sent"
              ? "Email non ancora inviata."
              : status === "accepted"
                ? "Invito affidato al servizio email. La consegna alla destinataria non è verificata."
                : status === "sending"
                  ? "Invio in corso. Attendi qualche minuto e aggiorna gli inviti per controllare l’esito."
                  : status === "retry"
                    ? "Invio non riuscito o non confermato. Puoi riprovare senza creare un nuovo invito."
                    : status === "failed"
                      ? "Invio sospeso: il destinatario potrebbe essere cambiato o il tempo per riprovare è terminato. Puoi copiare il link e inoltrarlo personalmente."
                      : status === "uncertain"
                        ? "L’esito del precedente invio non è confermato. Puoi riprovare: il servizio usa lo stesso invito per evitare email duplicate."
                        : "Stato email non disponibile. Aggiorna gli inviti prima di inviare."}
          </Text>
          <Button
            disabled={
              busy ||
              !state ||
              !["not_sent", "retry", "uncertain"].includes(state.status)
            }
            onPress={() => act(invitation, "email")}
          >
            {status === "accepted"
              ? "Invito già inviato al servizio email"
              : status === "retry" || status === "uncertain"
                ? "Riprova invio"
                : "Invia invito"}
          </Button>
          <Button
            variant="quiet"
            disabled={busy}
            onPress={() => setPreview((value) => !value)}
          >
            {preview ? "Nascondi anteprima email" : "Cosa riceve la paziente?"}
          </Button>
          {preview && (
            <Notice>
              L’email invita la paziente alla videochiamata con Gaia, con un
              pulsante per aprire questo invito nell’area riservata. Dovrà
              accedere con {invitation.email}. Giorno e ora restano quelli
              concordati con Gaia.
            </Notice>
          )}
          <Button
            variant="secondary"
            disabled={busy}
            onPress={() => void copy()}
          >
            Copia link
          </Button>
          {!!copyMessage && (
            <Text accessibilityLiveRegion="polite" style={ui.body}>
              {copyMessage}
            </Text>
          )}
          {manualCopy && (
            <Text selectable style={ui.body}>
              {link}
            </Text>
          )}
        </>
      )}
      <Button
        variant={manage ? "secondary" : "primary"}
        disabled={busy}
        onPress={() => act(invitation, "open")}
      >
        Entra nella videochiamata
      </Button>
      {manage &&
        (confirmRevoke ? (
          <>
            <Notice>
              La paziente non potrà più aprire questo invito dall’area
              riservata, anche se ha già ricevuto l’email.
            </Notice>
            <Button
              variant="secondary"
              disabled={busy}
              onPress={() => act(invitation, "revoke")}
            >
              Conferma revoca
            </Button>
            <Button
              variant="quiet"
              disabled={busy}
              onPress={() => setConfirmRevoke(false)}
            >
              Mantieni invito
            </Button>
          </>
        ) : (
          <Button
            variant="quiet"
            disabled={busy}
            onPress={() => setConfirmRevoke(true)}
          >
            Revoca questo invito
          </Button>
        ))}
    </View>
  );
}
