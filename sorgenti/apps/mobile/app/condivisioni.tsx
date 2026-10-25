import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router, useIsFocused } from "expo-router";
import { client, useApp } from "../src/state";
import { Text, TextInput } from "../src/typography";
import { Button, Notice, Progress, Screen, ui } from "../src/ui";
import { useUnsavedChanges } from "../src/unsaved-changes";
import {
  createFamilyInvite,
  decideFamilyShareRequest,
  loadFamilySharing,
  loadFamilySnapshot,
  requestFamilyShare,
  revokeFamilyShare,
  type FamilyInvite,
  type FamilySharing,
  type FamilySnapshot,
} from "../src/family-sharing";

export default function FamilySharingScreen() {
  const { email } = useApp();
  const focused = useIsFocused();
  return (
    <Screen
      back
      title="Condivisioni familiari"
      subtitle="Condividi con una persona fidata le checklist e gli articoli che hai salvato."
    >
      {!email ? (
        <>
          <Notice>Accedi per gestire le condivisioni del tuo account.</Notice>
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
  const { memberProfile } = useApp();
  const [sharing, setSharing] = useState<FamilySharing>({
    incoming: [],
    outgoing: [],
  });
  const [invite, setInvite] = useState<FamilyInvite | null>(null);
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<FamilySnapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const generation = useRef(0);
  useUnsavedChanges(Boolean(nickname || code));

  useEffect(() => {
    const token = ++generation.current;
    let currentUser: string | null | undefined;
    const subscription = client?.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user.id ?? null;
      if (
        event === "SIGNED_OUT" ||
        (currentUser !== undefined && currentUser !== nextUser)
      ) {
        generation.current++;
        setSharing({ incoming: [], outgoing: [] });
        setInvite(null);
        setSnapshot(null);
        setSelected(null);
        setNickname("");
        setCode("");
        setMessage("");
        setError("L’account è cambiato. Riapri le condivisioni.");
        setBusy(false);
      }
      currentUser = nextUser;
    }).data.subscription;
    void loadFamilySharing()
      .then((data) => {
        if (generation.current === token) setSharing(data);
      })
      .catch((cause: unknown) => {
        if (generation.current === token)
          setError(
            cause instanceof Error
              ? cause.message
              : "Caricamento non riuscito.",
          );
      })
      .finally(() => {
        if (generation.current === token) setBusy(false);
      });
    return () => {
      generation.current++;
      subscription?.unsubscribe();
    };
  }, []);

  async function act(
    action: () => Promise<void>,
    success: string,
    nextSelected = selected,
  ) {
    if (busy) return;
    const token = ++generation.current;
    setBusy(true);
    setSnapshot(null);
    setError("");
    setMessage("");
    try {
      await action();
      const data = await loadFamilySharing();
      if (generation.current !== token) return;
      setSharing(data);
      const approved = data.outgoing.some(
        (link) => link.id === nextSelected && link.status === "approved",
      );
      setSelected(approved ? nextSelected : null);
      if (approved && nextSelected) {
        const view = await loadFamilySnapshot(nextSelected);
        if (generation.current !== token) return;
        setSnapshot(view);
      }
      setMessage(success);
    } catch (cause) {
      if (generation.current === token)
        setError(
          cause instanceof Error ? cause.message : "Operazione non riuscita.",
        );
    } finally {
      if (generation.current === token) setBusy(false);
    }
  }

  const pending = sharing.incoming.filter((link) => link.status === "pending");
  const approved = sharing.incoming.filter(
    (link) => link.status === "approved",
  );
  return (
    <View style={{ gap: 20 }}>
      <Notice>
        La persona autorizzata può leggere l’avanzamento delle checklist
        pubblicate e i titoli degli articoli salvati. Puoi revocare l’accesso in
        ogni momento. I dati si aggiornano premendo Aggiorna.
      </Notice>
      {!!error && <Notice>{error}</Notice>}
      {!!message && <Notice>{message}</Notice>}
      <Button
        variant="secondary"
        disabled={busy}
        onPress={() => {
          void act(async () => {}, "Condivisioni aggiornate.");
        }}
      >
        {busy ? "Caricamento…" : "Aggiorna condivisioni"}
      </Button>

      <View style={[ui.card, { gap: 14 }]}>
        <Text style={ui.heading}>Invita un familiare o un’amica</Text>
        <Text style={ui.body}>
          Comunica privatamente il tuo nickname e il codice alla persona fidata.
          Dopo la sua richiesta, verifica con lei il codice richiesta e approva
          qui. Il nickname da solo non dà accesso.
        </Text>
        <Text
          style={ui.label}
        >{`Il tuo nickname: ${memberProfile?.nickname || "da scegliere nel Profilo"}`}</Text>
        {!memberProfile?.nickname && (
          <Button
            variant="secondary"
            onPress={() => router.push("/(tabs)/profile")}
          >
            Apri il Profilo
          </Button>
        )}
        <Text style={ui.body}>
          Il codice scade dopo 7 giorni. Un nuovo codice annulla quello
          precedente e le richieste ancora in attesa; i collegamenti già
          approvati restano attivi.
        </Text>
        <Button
          disabled={busy || !memberProfile?.nickname}
          onPress={() => {
            void act(async () => {
              const next = await createFamilyInvite();
              setInvite(next);
            }, "Codice creato: comunicalo soltanto alla persona che vuoi invitare.");
          }}
        >
          Crea nuovo codice privato
        </Button>
        {invite && (
          <View style={{ gap: 10 }}>
            <Text style={ui.label}>
              Codice privato, visibile solo in questa schermata
            </Text>
            <Text selectable style={ui.body}>
              {invite.code}
            </Text>
            <Text
              style={ui.body}
            >{`Scade il ${new Date(invite.expires_at).toLocaleString("it-IT")}`}</Text>
            <Button variant="quiet" onPress={() => setInvite(null)}>
              Nascondi il codice
            </Button>
          </View>
        )}
      </View>

      <View style={[ui.card, { gap: 14 }]}>
        <Text style={ui.heading}>Richieste da approvare</Text>
        <Text style={ui.body}>
          Controlla con la persona il codice richiesta completo prima di
          approvare: più persone possono avere lo stesso nickname.
        </Text>
        {!pending.length && (
          <Text style={ui.body}>Nessuna richiesta in attesa.</Text>
        )}
        {pending.map((link) => (
          <View key={link.id} style={[ui.card, { gap: 10 }]}>
            <Text style={ui.heading}>
              {link.nickname || "Familiare senza nickname"}
            </Text>
            <Text
              selectable
              style={ui.body}
            >{`Codice richiesta: ${link.id}`}</Text>
            <Button
              disabled={busy}
              onPress={() => {
                void act(
                  () => decideFamilyShareRequest(link.id, true),
                  "Richiesta approvata.",
                );
              }}
            >
              Approva la condivisione
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onPress={() => {
                void act(
                  () => decideFamilyShareRequest(link.id, false),
                  "Richiesta rifiutata.",
                );
              }}
            >
              Rifiuta la richiesta
            </Button>
          </View>
        ))}
        <Text style={ui.heading}>Persone autorizzate</Text>
        {!approved.length && (
          <Text style={ui.body}>Nessuna persona autorizzata.</Text>
        )}
        {approved.map((link) => (
          <View key={link.id} style={[ui.card, { gap: 10 }]}>
            <Text style={ui.heading}>
              {link.nickname || "Familiare senza nickname"}
            </Text>
            <Text
              selectable
              style={ui.body}
            >{`Codice richiesta: ${link.id}`}</Text>
            <Button
              variant="secondary"
              disabled={busy}
              onPress={() => {
                void act(
                  () => revokeFamilyShare(link.id),
                  "Accesso revocato: non si possono più caricare i tuoi contenuti.",
                );
              }}
            >
              Revoca l’accesso
            </Button>
          </View>
        ))}
      </View>

      <View style={[ui.card, { gap: 14 }]}>
        <Text style={ui.heading}>Collegati alla persona che accompagni</Text>
        <Text style={ui.body}>
          Inserisci il nickname esistente della persona e il codice privato che
          ti ha dato. Dopo l’invio, attendi la sua approvazione.
        </Text>
        <TextInput
          style={ui.input}
          accessibilityLabel="Nickname della persona da accompagnare"
          placeholder="Nickname della persona"
          value={nickname}
          onChangeText={setNickname}
          autoCapitalize="none"
          editable={!busy}
        />
        <TextInput
          style={ui.input}
          accessibilityLabel="Codice privato di condivisione"
          placeholder="Incolla il codice privato"
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
        />
        <Button
          disabled={busy || !nickname.trim() || !code.trim()}
          onPress={() => {
            void act(async () => {
              await requestFamilyShare(nickname, code);
              setNickname("");
              setCode("");
            }, "Richiesta inviata. Confronta il codice richiesta con la persona e attendi l’approvazione.");
          }}
        >
          Invia richiesta di collegamento
        </Button>
        {!sharing.outgoing.length && (
          <Text style={ui.body}>Non hai ancora collegamenti.</Text>
        )}
        {sharing.outgoing.map((link) => (
          <View key={link.id} style={[ui.card, { gap: 10 }]}>
            <Text style={ui.heading}>
              {link.nickname || "Persona accompagnata"}
            </Text>
            <Text style={ui.body}>
              {
                {
                  pending: "In attesa di approvazione",
                  approved: "Condivisione approvata",
                  declined: "Richiesta rifiutata",
                  revoked: "Condivisione revocata",
                  expired: "Richiesta scaduta: chiedi un nuovo codice",
                }[link.status]
              }
            </Text>
            <Text
              selectable
              style={ui.body}
            >{`Codice richiesta: ${link.id}`}</Text>
            {link.status === "approved" && (
              <Button
                disabled={busy}
                onPress={() => {
                  void act(
                    async () => {},
                    "Vista condivisa aggiornata.",
                    link.id,
                  );
                }}
              >
                Vedi checklist e articoli salvati
              </Button>
            )}
            {(link.status === "approved" || link.status === "pending") && (
              <Button
                variant="quiet"
                disabled={busy}
                onPress={() => {
                  void act(
                    () => revokeFamilyShare(link.id),
                    "Collegamento rimosso.",
                    null,
                  );
                }}
              >
                Rimuovi collegamento
              </Button>
            )}
          </View>
        ))}
      </View>

      {snapshot && (
        <View style={[ui.card, { gap: 16 }]}>
          <Text
            style={ui.heading}
          >{`Lo spazio condiviso di ${snapshot.nickname}`}</Text>
          <Text style={ui.body}>
            Vista in sola lettura. Premi Aggiorna condivisioni per vedere gli
            ultimi cambiamenti.
          </Text>
          <Text style={ui.heading}>Checklist</Text>
          {!snapshot.checklists.length && (
            <Text style={ui.body}>
              Nessuna checklist pubblicata disponibile.
            </Text>
          )}
          {snapshot.checklists.map((checklist) => (
            <View key={checklist.id} style={[ui.card, { gap: 10 }]}>
              <Text style={ui.heading}>{checklist.title}</Text>
              <Progress
                completed={
                  checklist.items.filter((item) => item.completed).length
                }
                total={checklist.items.length}
              />
              {checklist.items.map((item) => (
                <Text
                  key={item.id}
                  style={ui.body}
                >{`${item.completed ? "Completato" : "Da completare"}: ${item.label}`}</Text>
              ))}
            </View>
          ))}
          <Text style={ui.heading}>Articoli salvati</Text>
          {!snapshot.articles.length && (
            <Text style={ui.body}>Nessun articolo pubblicato salvato.</Text>
          )}
          {snapshot.articles.map((article) => (
            <Button
              key={article.id}
              variant="secondary"
              onPress={() =>
                router.push({
                  pathname: "/article",
                  params: { id: article.id },
                })
              }
            >
              {article.title}
            </Button>
          ))}
          <Button
            variant="quiet"
            onPress={() => {
              setSelected(null);
              setSnapshot(null);
            }}
          >
            Chiudi vista condivisa
          </Button>
        </View>
      )}
    </View>
  );
}
