# MetiMaia v12 — cinque iterazioni di miglioramento

Lo ZIP del sito è completo e comprende anche la v11.3: email automatiche dei documenti, materiale originale di Gaia, iscrizione uniforme, badge, condivisioni e area riservata.

Le cinque iterazioni intervengono su navigazione, cartella personale, Studio, affidabilità dei contenuti e SEO. Le modifiche e le verifiche sono descritte in **CINQUE-ITERAZIONI.md**.

## Cosa cambia per chi usa il sito

- **I miei documenti** compare all’inizio della pagina personale, con un pulsante diretto visibile anche da telefono.
- **Letture salvate** indica chiaramente i preferiti; **Argomenti** apre la biblioteca completa. Dalla pagina iniziale si può esplorare la biblioteca anche come ospite.
- Nella cartella privata si cercano i materiali per titolo o nome file e si filtrano per PDF, Word e PowerPoint. La ricerca mostra sempre soltanto i documenti assegnati all’account.
- Studio presenta tre attività principali: documenti, contenuti e iscritti. Gli altri strumenti rimangono visibili in righe più compatte.
- Il caricamento di una copertina non disponibile non blocca più tutta la biblioteca. Caricamento, errore, biblioteca vuota e ricerca senza risultati hanno messaggi distinti.
- Le pagine pubbliche hanno dati strutturati coerenti con la pagina aperta. Le aree private conservano il blocco dell’indicizzazione.

## 1. Supabase: aggiungere le due checklist

Se hai già completato la configurazione v11.3, il nuovo passaggio è soltanto questo:

1. Scarica ed estrai **MAIA-Configurazione-v12.zip**.
2. Apri la cartella **AGGIORNAMENTO-018**.
3. Apri **202610310018_practical_checklist_drafts.sql** con un editor di testo e copia tutto.
4. Apri **Supabase → progetto metimaia → SQL Editor → nuova query**.
5. Incolla il contenuto e premi **Run**.
6. Nel risultato devono comparire le due checklist con stato **draft** e approvazione **false**.

Il file SQL va eseguito in SQL Editor, non in Edge Functions.

Le checklist aggiunte sono:

- **Organizzare il trasporto verso il punto nascita** — 8 attività, percorso Gravidanza.
- **Casa pronta per un bambino che inizia a muoversi** — 9 attività, percorso Dopo la nascita.

Sono **bozze private**, disponibili in **Studio → Apri articoli e checklist → Checklist → Bozze**. Gaia può rileggerle, modificarle e pubblicarle con l’account professionale autorizzato. Non vengono attribuite revisioni o approvazioni automaticamente.

L’importazione conserva le checklist e i progressi già presenti. Può essere rieseguita senza duplicare queste due bozze o sovrascrivere le modifiche salvate in Studio.

La cartella **SOLO-SE-MANCA-LA-v11.3** contiene la configurazione precedente per chi non l’avesse completata. Se le email documenti sono già configurate, **non occorre ripetere il file 017, sostituire document-notify, creare nuovi token o modificare Resend**. La guida precedente rimane inclusa in quella cartella.

## 2. Cloudflare: aggiornare il sito completo

1. Scarica **MAIA-Sito-v12-Cinque-Iterazioni.zip**.
2. Apri **Cloudflare → Workers & Pages → lively-tooth-64c2 → Deployments → New deployment**.
3. Carica lo ZIP del sito. Se viene richiesta una cartella, estrailo e caricane il contenuto: `index.html` deve trovarsi direttamente al primo livello.
4. Premi **Deploy** e attendi **Ready**.
5. Apri il sito in una finestra privata per verificare la nuova versione.

Lo ZIP Supabase non va caricato come sito pubblico. I file personali e le letture già presenti rimangono nel progetto Supabase; il nuovo ZIP Cloudflare non è un backup del database o dell’archivio privato.

## 3. Prova pratica dopo il caricamento

1. Accedi con un normale account di prova: nella pagina personale deve comparire subito **I miei documenti**.
2. Apri la cartella. Cerca il titolo di un documento assegnato a quell’account, prova i filtri e poi **Mostra tutti i materiali**.
3. Accedi con un secondo account non assegnato: la ricerca non deve mostrare il documento del primo.
4. Apri **Argomenti**, salva una lettura e ritrovala in **Letture salvate**. Se non ci sono ancora letture pubblicate, la pagina lo deve spiegare chiaramente.
5. Come Gaia, apri Studio: verifica le tre attività principali e ritrova le due nuove checklist tra le bozze.
6. Completa la prova reale dei documenti già prevista: secondo fattore, condivisione di un PDF fittizio, email ricevuta, accesso del destinatario e revoca.

La protezione a due fattori e le assegnazioni dei file rimangono necessarie. Il completamento dei test di sviluppo non sostituisce questa prova sul tuo progetto reale.

## Cosa rimane da completare con Gaia

Servizi effettivi, disponibilità, modalità degli incontri e materiali originali devono essere forniti o verificati dalla professionista. Non sono state inventate queste informazioni.

Le nuove checklist richiedono la revisione e la pubblicazione da Studio. I materiali di Gaia non ancora allegati in chat non sono stati aggiunti all’archivio.

Il miglioramento SEO riguarda i dati strutturati delle pagine pubbliche. Un elenco completo degli articoli pubblicati nella sitemap e un’esportazione con il loro contenuto già nell’HTML richiedono il catalogo effettivamente pubblicato; non sono stati inseriti articoli dimostrativi o dati di recensioni inventati. L’indicizzazione e il posizionamento restano decisioni di Google.

Le prove automatiche usano un database separato e servizi simulati; i controlli browser usano dimensioni da telefono e PC. Nessuna email reale o modifica al database produttivo è stata eseguita dall’assistente durante queste verifiche.
