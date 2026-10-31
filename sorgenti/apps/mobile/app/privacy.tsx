import { Text } from "../src/typography";
import React, { useEffect, useState } from "react";
import {
  loadProfile,
  defaultProfile,
  publicProfile,
} from "../src/professional";
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
      if (active) setProfile(publicProfile(p));
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
      "Nickname e scheda condivisa con Gaia",
      "Durante la registrazione scegli un nickname, anche di fantasia; puoi modificarlo dal profilo. L’email resta il riferimento per l’accesso e permette al personale autorizzato di distinguere eventuali omonimi. Gli altri iscritti non possono consultare un elenco di nickname o email. Puoi usare il sito senza condividere il percorso con lo studio. La condivisione della scheda richiede una scelta separata, facoltativa e inizialmente disattivata: puoi indicare una fase e alcuni temi che desideri approfondire, che possono riguardare la salute. La finalità è preparare l’accompagnamento con Gaia; la scelta esplicita di condivisione è distinta dalla personalizzazione dei contenuti e dalla newsletter. Il percorso condiviso è consultabile soltanto dalla professionista specificamente autorizzata e con la protezione a due fattori prevista; i soli permessi editoriali permettono di gestire le identità degli iscritti, non di leggere il percorso. Date, letture salvate, progressi e conversazioni non vengono trasferiti alla scheda. Dal profilo puoi modificare o ritirare la condivisione: il ritiro rimuove la fase e i temi condivisi dalle nuove consultazioni di Studio senza cancellare le tue preferenze personali. Sono registrati la scelta, la versione del testo e la data delle variazioni, senza conservare in quel registro i contenuti dei percorsi. Questi dati non sono usati per segmentare newsletter o pubblicità. La scheda e lo storico delle scelte vengono rimossi dalla base dati attiva quando elimini l’account; gli eventuali backup seguono i termini indicati nell’informativa. Il titolare deve verificare e completare finalità, basi giuridiche e condizioni per i dati sulla salute prima dell’uso effettivo; l’interfaccia non certifica la conformità del servizio.",
    ],
    [
      "Documenti e allegati delle sessioni",
      "La professionista può caricare materiali e assegnarne l’accesso ad account confermati. Titoli, descrizioni, nomi dei file, destinatari e registrazioni delle variazioni di accesso sono trattati per questa condivisione. I file sono conservati in un’area privata Supabase; il download verifica l’account e il permesso attuale. Quando Gaia aggiunge un nuovo destinatario, viene preparato un avviso di servizio via Resend all’indirizzo confermato dell’account: contiene il titolo del materiale e il collegamento alla pagina riservata I miei documenti. Non contiene il file allegato, la descrizione o un collegamento pubblico al documento. L’avviso è distinto dalla newsletter. Una coda privata registra gli identificativi, il titolo e l’indirizzo usati per il tentativo, lo stato e gli esiti tecnici, per evitare duplicati e riprovare gli errori temporanei. Un invio accettato dal fornitore non prova la consegna o la lettura. La revoca dell’accesso annulla gli avvisi ancora in coda; le email già inviate o in elaborazione presso il fornitore non possono essere richiamate. Archiviare un file revoca i destinatari ma conserva il file privato; revocare non cancella copie già scaricate. La cancellazione dell’account rimuove le sue assegnazioni, senza eliminare il materiale caricato dalla professionista. I documenti si scaricano separatamente: l’esportazione JSON del profilo non include il contenuto dei file. Il titolare deve precisare nel testo definitivo finalità, basi giuridiche, eventuali condizioni per dati sanitari, tempi di conservazione, gestione dei file e copie di sicurezza. I contatti privacy indicati nella presente pagina restano disponibili per esercitare i diritti.",
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
      "6. Messaggi alla Dott.sa Gaia",
      "La chat reale richiederà l’accesso e l’abilitazione della professionista. La gestione delle conversazioni è affidata esclusivamente alla Dott.sa Gaia. L’utente vede la propria conversazione; la redazione non accede alle chat per il solo ruolo editoriale. Anche il gestore del servizio e i fornitori possono avere accessi tecnici nei limiti delle proprie funzioni: non è una chat con cifratura end-to-end. Evita referti, foto, dettagli sanitari o dati di terzi non necessari. La base giuridica e l’eventuale gestione di dati sanitari devono essere definite prima di ricevere messaggi reali. Le risposte non sono immediate: per urgenze contatta i servizi di emergenza.",
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
      "Il modulo serve a preparare una richiesta da inviare via email. I campi restano nella memoria della pagina; aprendo l’email il riepilogo passa alla tua app email, dove controlli il contenuto e confermi l’invio. Il modulo attuale non salva la richiesta nel database del sito. Il testo contiene nome, email di ricontatto e preferenze di data/modalità. Non inserire dati sanitari o referti. I messaggi email effettivamente inviati saranno trattati dal titolare e dai fornitori email per rispondere alla richiesta precontrattuale; conservazione e fornitori devono essere definiti nella presente informativa. Non è una prenotazione confermata e non iscrive alla newsletter.",
    ],
    [
      "Consigli d’acquisto e Amazon",
      "MetiMaia presenta consigli d’acquisto con collegamenti esterni ad Amazon e non vende direttamente prodotti, non raccoglie ordini e non gestisce pagamenti, spedizioni o resi. I link affiliati sono segnalati: se acquisti tramite questi link, MetiMaia può ricevere una commissione. Il clic apre Amazon su tua scelta; prezzi, disponibilità e condizioni sono quelli indicati da Amazon. Il sito non carica strumenti pubblicitari Amazon prima del clic. Nessun dato della scheda del percorso, della chat o dei documenti viene aggiunto ai link. Un acquisto non comporta l’iscrizione alla newsletter. Per i trattamenti effettuati da Amazon dopo l’apertura del collegamento consulta la sua informativa.",
    ],
    [
      "Condivisioni con familiari e amici",
      "Il nickname identifica una persona ma non è una password. Per collegare due account confermati servono un codice privato generato dalla persona interessata e la sua successiva approvazione. I collegamenti autorizzano soltanto la lettura dei progressi nelle checklist pubblicate e dei titoli degli articoli pubblicati salvati nei preferiti. Non concedono accesso a email, date, scheda della gravidanza, altre preferenze, messaggi o documenti. I codici scadono dopo 7 giorni; il collegamento approvato resta attivo fino alla revoca. Puoi revocarlo nelle Condivisioni: da quel momento le nuove letture sono negate. Le informazioni già viste o copiate non possono essere ritirate dal dispositivo altrui. La pagina si aggiorna su richiesta e non permette di modificare le attività dell’altra persona. Anche titoli e progressi possono rivelare interessi personali: scegli con chi condividerli. I collegamenti e i relativi stati restano nel servizio fino alla cancellazione dell’account, salvo ulteriori tempi definiti dal titolare.",
    ],
    [
      "Scheda facoltativa della gravidanza",
      "Puoi indicare ultima mestruazione, corrispondenza con la datazione ecografica, settimane e giorni ecografici con data di riferimento, precedenti gravidanze ed esiti. Il calcolo è orientativo, non diagnostico. Questi dati sono conservati separatamente dalle preferenze generali e richiedono un consenso esplicito alla conservazione. Due ulteriori scelte indipendenti permettono di condividerli con Gaia e di usarli per suggerire letture. Non sono obbligatori per creare l’account o usare le checklist. La lettura da parte di Gaia richiede l’autorizzazione professionale dedicata e il secondo fattore; il solo ruolo di redazione non basta. Familiari e amici non possono leggerli. Puoi ritirare ogni finalità o eliminare i dati attivi della scheda dal Profilo. I dati non vengono salvati nella memoria locale del sito né inviati ad Amazon o Resend. L’esportazione personale li include; la cancellazione dell’account rimuove la scheda e le registrazioni del consenso nel database attivo. I log minimi del consenso riportano finalità, versione e momento della scelta, senza copiare date o storia ostetrica; tempi di conservazione e backup restano da definire dal titolare.",
    ],
    [
      "Condivisione di contenuti e badge",
      "Il pulsante Condividi apre gli strumenti del dispositivo o propone di copiare il testo. Per una checklist, il messaggio può includere attività completate e mancanti: controlla il destinatario prima di inviarlo. I badge sono ricavati dal tuo accesso, dal completamento delle preferenze iniziali, dalle letture salvate e dalle attività delle checklist. Un badge di checklist compare quando tutte le attività sono spuntate e torna da completare se ne riapri una; il badge delle letture segue la presenza di preferiti. Il traguardo Prima selezione registra nell’account soltanto se hai scelto almeno un collegamento nei Consigli d’acquisto. Non memorizza quali prodotti hai scelto e non verifica né registra acquisti Amazon. Questo traguardo è conservato separatamente dalle preferenze, fino alla cancellazione dell’account. Il pulsante Condividi non invia messaggi automaticamente e non aggiunge email, nickname o dati della scheda gravidanza al testo. Il riepilogo condiviso è una fotografia e non si aggiorna da solo; per una consultazione aggiornata serve il collegamento autorizzato tra gli account.",
    ],
    [
      "Videochiamate concordate",
      "Gli inviti alle videochiamate sono associati al singolo account autorizzato, hanno una scadenza e possono essere revocati da Gaia. Il sito conserva il collegamento di invito, l’account destinatario e le date di creazione, scadenza e revoca. Non registra audio o video e non attiva fotocamera o microfono. Solo quando scegli di partecipare si apre Hostpoint Meet, servizio esterno con proprie condizioni e informativa: lì decidi se consentire fotocamera e microfono. Non condividere l’invito con altre persone. Gaia deve creare una stanza diversa per ogni incontro e chiuderla al termine; revocare l’invito nel sito impedisce ulteriori aperture dal sito, ma non annulla un collegamento già copiato né chiude una stanza presso il fornitore. Gli incontri e le modalità si concordano via email.",
    ],
    [
      "Newsletter facoltativa",
      "L’iscrizione alla newsletter è separata dall’account e richiede una scelta positiva e la conferma via email. Trattiamo email, stato dell’iscrizione, date di richiesta/conferma/revoca e versione del consenso per inviare contenuti, aggiornamenti e novità sui servizi di metiMaia. La base è il consenso (art. 6, par. 1, lett. a, GDPR e art. 130 del Codice privacy). Il rifiuto non limita l’account o i servizi. Non vengono usati dati sanitari o preferenze del percorso per segmentare la newsletter. Supabase conserva l’iscrizione e Resend gestisce l’invio: il titolare deve completare le informazioni sui fornitori, gli accordi e gli eventuali trasferimenti nella presente informativa prima dell’attivazione. Le richieste non confermate scadono dopo 24 ore e vengono eliminate dal database attivo durante le successive richieste. L’iscrizione resta attiva fino alla revoca; la revoca ferma gli invii, ma la cancellazione dell’account non cancella automaticamente un’iscrizione indipendente. Il collegamento di revoca è nell’email; è possibile anche scrivere a ostetricamaia@gmail.com. I termini per conservare le prove del consenso e i log dopo la revoca devono essere definiti dal titolare. L’informativa non certifica la conformità del servizio.",
    ],
    [
      "12. Personalizzazione, minori e aggiornamenti",
      "I suggerimenti sono selezionati in base alle preferenze e non prendono decisioni con effetti giuridici o analogamente significativi ai sensi dell’art. 22 GDPR. MAIA non è progettata per raccogliere account di bambini o dati identificativi del neonato. Per utenti minorenni, eventuali servizi sanitari e relativi consensi occorre verificare le regole applicabili prima dell’attivazione; non si presume una soglia di età unica per tutti i trattamenti. Versione del testo: 31 ottobre 2026. Il testo deve essere aggiornato se cambiano servizi, fornitori o finalità.",
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
