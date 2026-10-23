import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { client, useApp } from "../src/state";
import { useEditorAccess } from "../src/editor-access";
import { Screen, Button, Notice, ui } from "../src/ui";
import { Text } from "../src/typography";
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
  useEffect(() => {
    let active = true;
    if (allowed && client)
      void client.rpc("newsletter_sync_status").then(({ data, error }) => {
        if (active) {
          if (error)
            setMessage(
              "Sincronizzazione non ancora configurata. Applica il pacchetto Supabase v5 prima di inviare campagne.",
            );
          else setStatus(data as Status);
        }
      });
    return () => {
      active = false;
    };
  }, [allowed, version]);
  async function sync(reconcile: boolean) {
    if (!client || busy) return;
    setBusy(true);
    setMessage("Controllo in corso: non chiudere la pagina.");
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
        if (data.errors > 0) {
          setMessage(
            "Restano aggiornamenti non riusciti. Non inviare campagne: controlla la configurazione e premi Riprova aggiornamenti in attesa.",
          );
          break;
        }
        if (data.pending === 0) {
          setMessage(
            "Controllo terminato. Usa solo un elenco aggiornato e mantieni la disiscrizione nelle campagne Resend.",
          );
          break;
        }
        if (data.processed === 0) {
          setMessage(
            "Alcuni aggiornamenti sono già in elaborazione. Attendi due minuti, poi riprova.",
          );
          break;
        }
        setMessage(`Aggiornamenti ancora in attesa: ${data.pending}.`);
        action = "retry";
        if (batch === 39)
          setMessage(
            "Il controllo continua in altri blocchi. Premi Riprova aggiornamenti in attesa prima di inviare campagne.",
          );
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Servizio non disponibile.");
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
          <Button disabled={busy || !status} onPress={() => void sync(true)}>
            Controlla iscritti e revoche su Resend
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !status}
            onPress={() => void sync(false)}
          >
            Riprova aggiornamenti in attesa
          </Button>
          <Button
            variant="quiet"
            disabled={busy}
            onPress={() => setVersion((v) => v + 1)}
          >
            Aggiorna stato
          </Button>
          <Notice>
            Prima di una campagna completa il controllo, risolvi gli errori e
            prova il link di disiscrizione con una tua email. Una copia CSV già
            scaricata non si aggiorna da sola. Nessun dato del percorso o della
            chat viene utilizzato per segmentare gli iscritti.
          </Notice>
          <Button variant="quiet" onPress={() => router.push("/studio")}>
            Torna a Studio per esportare i confermati
          </Button>
        </>
      )}
      {message !== "" && (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Notice>
            {busy ? "Operazione in corso. " : ""}
            {message}
          </Notice>
        </View>
      )}
    </View>
  );
}
