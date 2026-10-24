import React, { useEffect, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { router } from "expo-router";
import { client, useApp } from "../src/state";
import { useEditorAccess } from "../src/editor-access";
import { Screen, Button, Notice, ui } from "../src/ui";
import { Text } from "../src/typography";
import { exportConfirmedSubscribers } from "../src/newsletter-export";
type Status = {
  pending: number;
  errors: number;
  synced: number;
  confirmed: number;
  last_update: string | null;
  last_webhook: string | null;
};
export default function NewsletterAdmin() {
  const { email } = useApp();
  return (
    <Screen
      professional
      back
      title="Newsletter e revoche"
      subtitle="Verifica lo stato prima di esportare o inviare una campagna."
    >
      {email ? (
        <Management key={email} />
      ) : (
        <Button onPress={() => router.push("/account?mode=login")}>
          Accedi
        </Button>
      )}
    </Screen>
  );
}
function Management() {
  const { allowed, checking } = useEditorAccess();
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState("");
  const [feedbackVersion, setFeedbackVersion] = useState(0);
  const [operation, setOperation] = useState<"sync" | "export">("sync");
  useEffect(() => {
    let active = true;
    if (allowed && client) {
      setLoading(true);
      setStatusError("");
      void client.rpc("newsletter_sync_status").then(({ data, error }) => {
        if (active) {
          setLoading(false);
          if (
            error ||
            !data ||
            ["pending", "errors", "synced", "confirmed"].some(
              (key) =>
                typeof data[key] !== "number" ||
                !Number.isFinite(data[key]) ||
                data[key] < 0,
            )
          ) {
            setStatus(null);
            setStatusError(
              "Stato non disponibile. Controlla connessione, autorizzazioni e configurazione della newsletter, poi riprova.",
            );
          } else setStatus(data as Status);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [allowed, version]);
  useEffect(() => {
    if (!feedbackVersion || Platform.OS !== "web") return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById("newsletter-operation-feedback");
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [feedbackVersion]);
  function notify(text: string) {
    setMessage(text);
    setFeedbackVersion((value) => value + 1);
  }
  async function exportCsv() {
    if (busy) return;
    setBusy(true);
    setOperation("export");
    notify("Preparazione dell’elenco confermato…");
    try {
      const count = await exportConfirmedSubscribers();
      notify(
        count
          ? `Esportati ${count} indirizzi confermati. Conserva il CSV con accesso riservato e usa un elenco aggiornato prima di ogni invio.`
          : "Nessuna iscrizione confermata. Gli indirizzi in attesa o disiscritti non vengono esportati.",
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Esportazione non riuscita.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function sync(reconcile: boolean) {
    if (!client || busy) return;
    setBusy(true);
    setOperation("sync");
    notify("Controllo in corso: non chiudere la pagina.");
    try {
      let action = reconcile ? "reconcile" : "retry";
      for (let batch = 0; batch < 40; batch++) {
        const { data, error } = await client.functions.invoke(
          "newsletter-sync",
          { body: { action }, timeout: 25000 },
        );
        if (error || data?.error)
          throw new Error(
            data?.error ??
              "Sincronizzazione non riuscita. Verifica funzione newsletter-sync, chiave contatti Resend e configurazione.",
          );
        if (
          !data ||
          ["errors", "pending", "processed"].some(
            (key) =>
              typeof data[key] !== "number" ||
              !Number.isFinite(data[key]) ||
              data[key] < 0,
          )
        )
          throw new Error(
            "Il servizio non ha restituito uno stato valido. Aggiorna lo stato e riprova.",
          );
        if (data.errors > 0) {
          notify(
            "Restano aggiornamenti non riusciti. Non inviare campagne: controlla la configurazione e premi Riprova aggiornamenti in attesa.",
          );
          break;
        }
        if (data.pending === 0) {
          notify(
            "Controllo terminato. Usa solo un elenco aggiornato e mantieni la disiscrizione nelle campagne Resend.",
          );
          break;
        }
        if (data.processed === 0) {
          notify(
            "Alcuni aggiornamenti sono già in elaborazione. Attendi due minuti, poi riprova.",
          );
          break;
        }
        notify(`Aggiornamenti ancora in attesa: ${data.pending}.`);
        action = "retry";
        if (batch === 39)
          notify(
            "Il controllo continua in altri blocchi. Premi Riprova aggiornamenti in attesa prima di inviare campagne.",
          );
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : "Servizio non disponibile.");
    } finally {
      setBusy(false);
      setVersion((v) => v + 1);
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
          Accesso riservato. Verifica i permessi e il secondo fattore, se
          richiesto.
        </Notice>
      ) : (
        <>
          <Notice>
            Le campagne si preparano su Resend. Questo pannello non invia
            newsletter e non abilita iscrizioni senza conferma. Le revoche del
            provider non vengono riattivate automaticamente.
          </Notice>
          {status && (
            <View style={[ui.card, { gap: 12 }]}>
              <Text style={ui.heading}>Stato degli aggiornamenti</Text>
              <Text style={ui.body}>
                Confermati: {status.confirmed}
                {"\n"}In attesa: {status.pending}
                {"\n"}Da riprovare: {status.errors}
                {"\n"}Allineati: {status.synced}
              </Text>
              <Text style={ui.body}>
                {status.last_update
                  ? `Ultimo aggiornamento: ${new Date(status.last_update).toLocaleString("it-IT")}`
                  : "Nessun aggiornamento registrato."}
              </Text>
              <Text style={ui.body}>
                {status.last_webhook
                  ? `Ultima revoca ricevuta dal provider: ${new Date(status.last_webhook).toLocaleString("it-IT")}`
                  : "Nessuna revoca del provider registrata: questo non verifica da solo che il webhook sia configurato."}
              </Text>
            </View>
          )}
          {loading && <Notice>Caricamento dello stato newsletter…</Notice>}
          {statusError !== "" && (
            <View accessibilityRole="alert" style={{ gap: 10 }}>
              <Notice>{statusError}</Notice>
              <Button
                variant="secondary"
                disabled={busy || loading}
                onPress={() => setVersion((value) => value + 1)}
              >
                Riprova caricamento stato
              </Button>
            </View>
          )}
          <View style={{ gap: 12 }}>
            <Button
              disabled={busy || loading || !status}
              onPress={() => void sync(true)}
            >
              Sincronizza iscritti e revoche
            </Button>
            {message !== "" && operation === "sync" && (
              <View
                nativeID="newsletter-operation-feedback"
                tabIndex={-1}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                <Notice>{message}</Notice>
              </View>
            )}
            <Button
              variant="secondary"
              disabled={busy || loading || !status}
              onPress={() => void sync(false)}
            >
              Riprova aggiornamenti in attesa
            </Button>
            <Button
              variant="quiet"
              disabled={busy || loading}
              onPress={() => setVersion((value) => value + 1)}
            >
              Aggiorna stato
            </Button>
          </View>
          <View style={[ui.card, { gap: 12 }]}>
            <Text style={ui.heading}>Elenco e campagne</Text>
            <Text style={ui.body}>
              Il CSV comprende solo gli iscritti confermati. Le campagne si
              preparano e inviano da Resend.
            </Text>
            <Button
              variant="secondary"
              disabled={busy || !status || loading}
              onPress={() => void exportCsv()}
            >
              Esporta iscritti confermati (CSV)
            </Button>
            {message !== "" && operation === "export" && (
              <View
                nativeID="newsletter-operation-feedback"
                tabIndex={-1}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
              >
                <Notice>{message}</Notice>
              </View>
            )}
            <Button
              variant="secondary"
              onPress={() =>
                void Linking.openURL("https://resend.com/emails").catch(() => {
                  setOperation("export");
                  notify(
                    "Impossibile aprire Resend. Apri https://resend.com dal browser.",
                  );
                })
              }
            >
              Apri Resend (sito esterno)
            </Button>
            <Button variant="quiet" onPress={() => router.push("/newsletter")}>
              Newsletter: iscrizione e informazioni
            </Button>
          </View>
          <Notice>
            Prima di una campagna completa il controllo, risolvi gli errori e
            prova il link di disiscrizione con una tua email. Una copia CSV già
            scaricata non si aggiorna da sola. Nessun dato del percorso o della
            chat viene utilizzato per segmentare gli iscritti.
          </Notice>
          <Button variant="quiet" onPress={() => router.push("/studio")}>
            Torna a Studio
          </Button>
        </>
      )}
    </View>
  );
}
