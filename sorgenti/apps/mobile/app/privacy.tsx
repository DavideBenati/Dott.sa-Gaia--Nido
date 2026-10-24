import { Text } from "../src/typography";
import React, { useEffect, useState } from "react";
import { loadProfile, defaultProfile } from "../src/professional";
import { Linking, View } from "react-native";
import { router } from "expo-router";
import { useApp } from "../src/state";
import {
  privacyComplete,
  privacyDetails as basePrivacyDetails,
} from "../src/privacy";
import { Screen, Notice, Button, ui } from "../src/ui";
const missing =
  "Da completare prima dell’attivazione del servizio con dati personali.";
export default function Privacy() {
  const [profile, setProfile] = useState(defaultProfile);
  useEffect(() => {
    let active = true;
    void loadProfile().then((p) => {
      if (active) setProfile(p);
    });
    return () => {
      active = false;
    };
  }, []);
  const privacyDetails = {
    ...basePrivacyDetails,
    providers: profile.privacy_providers || basePrivacyDetails.providers,
    retention: profile.privacy_retention || basePrivacyDetails.retention,
    transfers: profile.privacy_transfers || basePrivacyDetails.transfers,
  };
  const { demo } = useApp();
  const sections: [string, string][] = [
    [
      "Documenti e allegati delle sessioni",
      "La professionista può caricare materiali e assegnarne l’accesso ad account confermati. Titoli, descrizioni, nomi dei file, destinatari e registrazioni delle variazioni di accesso sono trattati per questa condivisione. I file sono conservati in un’area privata Supabase; il download verifica l’account e il permesso attuale. Non vengono inviati link pubblici o iscrizioni newsletter. Archiviare un file revoca i destinatari ma conserva il file privato; revocare non cancella copie già scaricate. La cancellazione dell’account rimuove le sue assegnazioni, senza eliminare il materiale caricato dalla professionista. I documenti si scaricano separatamente: l’esportazione JSON del profilo non include il contenuto dei file. Il titolare deve precisare nel testo definitivo finalità, basi giuridiche, eventuali condizioni per dati sanitari, tempi di conservazione, gestione dei file e copie di sicurezza. I contatti privacy indicati nella presente pagina restano disponibili per esercitare i diritti.",
    ],
    [
      "1. Chi gestisce i dati",
      `Titolare del trattamento: ${privacyDetails.controller || missing}\nSede e recapito postale: ${privacyDetails.address || missing}\nContatto privacy: ${privacyDetails.email || missing}\n${privacyDetails.dpo ? `Responsabile della protezione dei dati (DPO): ${privacyDetails.dpo}` : "Contatto DPO: da indicare se nominato; la nomina e la sua eventuale obbligatorietà devono essere verificate dal titolare."}`,
    ],
    [
      "2. Cosa succede nella demo",
      "Puoi esplorare senza account. Preferenze, data eventualmente scelta, letture salvate e progressi sono conservati nel browser o sul dispositivo. Non è prevista una cifratura locale dedicata: usa un dispositivo personale e rimuovi i dati se è condiviso. Cancellare i dati su un browser non cancella quelli eventualmente presenti su altri dispositivi. Registrazione e chat sono disabilitate nella demo; le conversazioni mostrate sono esempi, non messaggi inviati.",
    ],
    [
      "3. Account e dati del servizio previsto",
      "Con l’attivazione dell’account saranno trattati email, identificativo utente, dati di autenticazione e le preferenze che scegli di salvare, per riconoscerti e ritrovare lo stesso percorso sul sito e nell’app. Le password sono gestite dal sistema di autenticazione; non sono mostrate alla professionista. Le scelte di percorso, gli argomenti e una data di gravidanza o nascita possono rivelare informazioni sulla salute. Non inserire nomi o dati di bambini, partner o altre persone se non necessari e senza averne verificato i presupposti.",
    ],
    [
      "4. Finalità e basi giuridiche",
      "L’account e la sincronizzazione, quando attivi, sono finalizzati a fornire il servizio richiesto: la base da verificare è l’esecuzione del contratto o di misure precontrattuali (art. 6, par. 1, lett. b, GDPR). La personalizzazione facoltativa che utilizza dati sulla salute richiede una specifica condizione dell’art. 9 GDPR e una base dell’art. 6: il consenso esplicito, ove applicabile, deve essere separato, informato, dimostrabile e revocabile (artt. 6, par. 1, lett. a, e 9, par. 2, lett. a). Le basi per sicurezza, adempimenti e chat, e l’eventuale distinto trattamento sanitario della professionista, devono essere definite dal titolare prima dell’attivazione; non si presume che una chat educativa sia una prestazione sanitaria. Leggere l’informativa o creare un account non equivale a prestare un consenso generale.",
    ],
    [
      "5. Cosa è facoltativo",
      "La consultazione come ospite non richiede email, password o una data. Per un account servono i dati di autenticazione; senza questi non è possibile accedere ai servizi personali. Puoi non fornire la data e usare un percorso generico. La rinuncia alla personalizzazione facoltativa non impedisce di leggere i contenuti. Le notifiche push non sono attive. La newsletter ha un consenso distinto, facoltativo e non preselezionato, seguito da conferma email.",
    ],
    [
      "6. Messaggi alla Dott.ssa Brunetti",
      "La chat reale richiederà l’accesso e l’abilitazione della professionista. La gestione delle conversazioni è affidata esclusivamente alla Dott.ssa Gaia Brunetti. L’utente vede la propria conversazione; la redazione non accede alle chat per il solo ruolo editoriale. Anche il gestore del servizio e i fornitori possono avere accessi tecnici nei limiti delle proprie funzioni: non è una chat con cifratura end-to-end. Evita referti, foto, dettagli sanitari o dati di terzi non necessari. La base giuridica e l’eventuale gestione di dati sanitari devono essere definite prima di ricevere messaggi reali. Le risposte non sono immediate: per urgenze contatta i servizi di emergenza.",
    ],
    [
      "7. Fornitori e destinatari",
      `Il sito dimostrativo è distribuito tramite GitHub Pages. Le richieste al sito possono comportare il trattamento di indirizzo IP, dati del browser e log tecnici da parte del fornitore. Il servizio account e la chat sono predisposti per Supabase; il pannello professionale richiede un hosting separato. Fornitori effettivi, ruoli privacy, eventuali responsabili nominati ai sensi dell’art. 28 GDPR e destinatari: ${privacyDetails.providers || missing} I dati non sono destinati alla diffusione pubblica; eventuali comunicazioni ad autorità avvengono nei casi previsti dalla legge.`,
    ],
    [
      "8. Paesi e trasferimenti",
      `Regioni dei servizi, eventuali accessi da paesi esterni allo SEE e relative garanzie: ${privacyDetails.transfers || missing} Scegliere un server nell’UE non esclude da solo trasferimenti o accessi extra SEE. Il titolare deve verificare la catena dei fornitori e, ove necessario, le condizioni del capo V GDPR, quali decisioni di adeguatezza o garanzie appropriate.`,
    ],
    [
      "9. Quanto conserviamo i dati",
      `Nella demo i dati locali restano finché li cancelli dal profilo o dal dispositivo/browser. Per il servizio reale devono essere fissati termini o criteri distinti per account, messaggi, log, eventuali prove del consenso e backup: ${privacyDetails.retention || missing} La cancellazione tramite l’app rimuove i dati applicativi attivi previsti dal servizio; non prova l’eliminazione immediata da backup, log dei fornitori o documentazione professionale eventualmente soggetta a distinti obblighi. Tali casi e relativi termini devono essere chiariti prima dell’attivazione.`,
    ],
    [
      "10. Cookie e memoria del dispositivo",
      "MAIA utilizza memoria locale per preferenze e progressi; con l’account attivo utilizza anche strumenti tecnici per la sessione e l’autenticazione. Il codice attuale non integra banner pubblicitari, profilazione pubblicitaria o strumenti di analisi del comportamento. Per strumenti strettamente necessari si applicano le condizioni dell’art. 122 del Codice privacy; non serve un consenso generico al loro uso. Se saranno aggiunti tracker non necessari, dovranno restare bloccati fino al consenso, con possibilità di rifiuto e revoca. L’informativa andrà aggiornata. I link esterni si aprono su tua richiesta e portano a servizi con proprie informative.",
    ],
    [
      "11. I tuoi diritti",
      "Nei casi e nei limiti previsti dagli artt. 15–22 GDPR puoi chiedere accesso, rettifica, cancellazione, limitazione, portabilità e opposizione. Puoi revocare un consenso in ogni momento, senza pregiudicare la liceità del trattamento precedente. Dal profilo puoi modificare le preferenze, ritirare il consenso alla data, esportare i dati disponibili e cancellare dati locali o account. Puoi inoltre contattare il titolare: queste funzioni non sostituiscono tutti i diritti. La risposta è normalmente dovuta entro un mese; eventuali proroghe motivate sono comunicate nei termini dell’art. 12 GDPR. Puoi proporre reclamo al Garante per la protezione dei dati personali e ricorrere all’autorità giudiziaria.",
    ],
    [
      "Richieste di incontro",
      "Prima dell’invio il modulo mantiene i campi nella memoria della pagina. Premendo Invia richiesta a Gaia, nome, email e preferenze vengono salvati nel database Supabase e consultati dagli editor autorizzati per rispondere alla richiesta. Resend invia alla professionista una notifica priva dei dati del modulo. L’alternativa email passa invece il riepilogo alla tua app email, dove confermi l’invio. Il testo contiene nome, email di ricontatto e preferenze di data/modalità. Non inserire dati sanitari o referti. I messaggi email effettivamente inviati saranno trattati dal titolare e dai fornitori email per rispondere alla richiesta precontrattuale; conservazione e fornitori devono essere definiti nella presente informativa. Non è una prenotazione confermata e non iscrive alla newsletter.",
    ],
    [
      "Shop e pagamenti",
      "L’anteprima del negozio non raccoglie ordini o pagamenti. Quando gli acquisti sono attivi, il sito mostra prodotti e dati del venditore e, su scelta dell’utente, apre un collegamento esterno a Stripe per i prodotti venduti direttamente. I prodotti selezionati su Amazon aprono invece Amazon, dove sono indicati prezzo, disponibilità, venditore, spedizione e resi. Gli eventuali link affiliati sono segnalati nello shop; il sito non imposta cookie pubblicitari Amazon prima del clic. I dati della carta non vengono inseriti nel sito metiMaia. Prima dell’attivazione il venditore deve precisare ruoli e fornitori, basi giuridiche, dati di ordine/fatturazione/spedizione, conservazione e condizioni della vendita nell’informativa e nei termini dedicati. L’acquisto non comporta l’iscrizione automatica alla newsletter e non viene associato dal codice attuale a preferenze sanitarie o chat. Non sono presenti tracciamento pubblicitario, carrello locale, archivio ordini o integrazione automatica con fornitori di stampa/spedizione.",
    ],
    [
      "Newsletter facoltativa",
      "L’iscrizione alla newsletter è separata dall’account e richiede una scelta positiva e la conferma via email. Trattiamo email, stato dell’iscrizione, date di richiesta/conferma/revoca e versione del consenso per inviare contenuti, aggiornamenti e novità sui servizi di metiMaia. La base è il consenso (art. 6, par. 1, lett. a, GDPR e art. 130 del Codice privacy). Il rifiuto non limita l’account o i servizi. Non vengono usati dati sanitari o preferenze del percorso per segmentare la newsletter. Supabase conserva l’iscrizione e Resend gestisce l’invio: il titolare deve completare le informazioni sui fornitori, gli accordi e gli eventuali trasferimenti nella presente informativa prima dell’attivazione. Le richieste non confermate scadono dopo 24 ore e vengono eliminate dal database attivo durante le successive richieste. L’iscrizione resta attiva fino alla revoca; la revoca ferma gli invii, ma la cancellazione dell’account non cancella automaticamente un’iscrizione indipendente. Il collegamento di revoca è nell’email; è possibile anche scrivere a ostetricamaia@gmail.com. I termini per conservare le prove del consenso e i log dopo la revoca devono essere definiti dal titolare. L’informativa non certifica la conformità del servizio.",
    ],
    [
      "12. Personalizzazione, minori e aggiornamenti",
      "I suggerimenti sono selezionati in base alle preferenze e non prendono decisioni con effetti giuridici o analogamente significativi ai sensi dell’art. 22 GDPR. MAIA non è progettata per raccogliere account di bambini o dati identificativi del neonato. Per utenti minorenni, eventuali servizi sanitari e relativi consensi occorre verificare le regole applicabili prima dell’attivazione; non si presume una soglia di età unica per tutti i trattamenti. Versione del testo: 23 ottobre 2026. Il testo deve essere aggiornato se cambiano servizi, fornitori o finalità.",
    ],
  ];
  return (
    <Screen
      back
      title="Privacy e dati personali"
      subtitle="Le informazioni che ti servono per scegliere cosa condividere."
    >
      <View style={{ width: "100%", maxWidth: 760, alignSelf: "center" }}>
        <Notice>{profile.privacy_providers}</Notice>
        {profile.privacy_retention !== "" && (
          <Notice>{`Conservazione: ${profile.privacy_retention}`}</Notice>
        )}
        {profile.privacy_transfers !== "" && (
          <Notice>{`Trasferimenti e garanzie: ${profile.privacy_transfers}`}</Notice>
        )}
        <Notice icon="lock">
          {demo
            ? "Stai usando la demo: i dati delle tue scelte restano su questo dispositivo. Account e invio di messaggi non sono attivi."
            : "Stai usando il servizio con un backend configurato. Le informazioni seguenti devono corrispondere alla sua configurazione effettiva."}
        </Notice>
        {!privacyComplete && (
          <Notice warm>
            Informativa in completamento. I dati del titolare, i recapiti e le
            condizioni del servizio reale non sono ancora tutti definiti. Le
            sezioni sul servizio futuro non costituiscono un’informativa
            definitiva per la sua attivazione.
          </Notice>
        )}
        <View style={{ gap: 28, marginVertical: 28 }}>
          {sections.map(([heading, body]) => (
            <View key={heading} style={{ gap: 12 }}>
              <Text accessibilityRole="header" style={ui.heading}>
                {heading}
              </Text>
              <Text selectable style={ui.body}>
                {body}
              </Text>
            </View>
          ))}
        </View>
        {privacyDetails.email && (
          <Button
            variant="secondary"
            onPress={() =>
              void Linking.openURL(`mailto:${privacyDetails.email}`)
            }
          >
            Contatta il titolare per la privacy
          </Button>
        )}
        <Button
          variant="secondary"
          onPress={() => router.push("/(tabs)/profile")}
        >
          Gestisci preferenze e dati
        </Button>
        <Button
          variant="quiet"
          onPress={() =>
            void Linking.openURL(
              "https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita",
            )
          }
        >
          Regolamento europeo sulla protezione dei dati
        </Button>
        <Button
          variant="quiet"
          onPress={() =>
            void Linking.openURL("https://www.garanteprivacy.it/codice")
          }
        >
          Codice italiano in materia di protezione dei dati
        </Button>
        <Button
          variant="quiet"
          onPress={() => void Linking.openURL("https://www.garanteprivacy.it/")}
        >
          Garante: informazioni e tutela dei tuoi diritti
        </Button>
      </View>
    </Screen>
  );
}
