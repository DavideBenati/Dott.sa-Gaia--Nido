# metiMaia — documenti riservati v7

Il pannello Studio può caricare PDF, Word (.docx) e PowerPoint (.pptx) fino a 20 MB e scegliere gli utenti autorizzati per ogni file. I pazienti trovano i materiali in Profilo/Account > I miei documenti. Non vengono inviate notifiche email automatiche.

## File
- MAIA-Documenti-v7.zip: sito completo cumulativo, incluse le correzioni v6 e il file Google originale. Non aggiunge il tag meta Google.
- MAIA-Configurazione-Documenti-v7.zip: SQL 007, funzione document-file, script di abilitazione Gaia e questa guida. Non caricarlo come sito Cloudflare.

## 1. Aggiorna Supabase
Prerequisito: database originale e aggiornamento professionale 005 già installati. Non rieseguire vecchie migrazioni, Database Creation o aggiornamenti newsletter.

1. Estrai il pacchetto di configurazione.
2. Supabase > progetto metimaia > SQL Editor > New query.
3. Apri 202610240007_private_documents.sql, copia tutto, Run.
4. Attendi Success. Esegui il file una sola volta. La migrazione è transazionale: se compare un errore, fermati e verifica il testo prima di riprovare.
5. Storage: deve comparire il bucket session-documents, privato. Non cambiarlo in pubblico. Limite file 20 MB, tipi PDF/DOCX/PPTX.

Il solo ruolo editoriale o chat non concede la gestione dei documenti. Nessun account o file viene abilitato automaticamente dalla migrazione.

## 2. Abilita Gaia alla gestione
1. Authentication > Users: copia l’email dell’account personale confermato di Gaia.
2. Apri ABILITA-GAIA.sql. Sostituisci EMAIL_ESATTA_ACCOUNT_GAIA con l’email effettiva, mantenendo gli apici.
3. Esegui lo script in una nuova query. Se l’account non è confermato o non ha un ruolo editoriale attivo, lo script si ferma senza concedere il permesso.
4. La verifica finale deve mostrare l’email corretta con active=true e require_mfa=true.

Questo ruolo può gestire tutti i materiali riservati: non assegnarlo a pazienti o editor incaricati soltanto degli articoli.

## 3. Pubblica la funzione di download
1. Edge Functions > Deploy a new function > Via Editor.
2. Function name esatto: document-file (trattino, non underscore).
3. File principale index.ts: cancella il codice di esempio e incolla tutto document-file/index.ts dal pacchetto.
4. Deploy; verifica che l’indirizzo termini con /functions/v1/document-file.
5. Settings > Verify JWT / Verify JWT with legacy secret: disattivato, Save. Il codice verifica autonomamente il JWT reale dell’utente e i permessi attuali prima e dopo la lettura del file.
6. Non sostituire newsletter, newsletter-sync o site-actions. Non aggiungere chiavi Resend. SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY sono forniti dall’ambiente server Supabase e non vanno copiati nel sito o nella chat.

L’endpoint usa POST autenticato: aprirlo direttamente dal browser può mostrare Metodo non disponibile. Il test va fatto dal sito dopo l’accesso.

## 4. Carica il sito Cloudflare
Workers & Pages > lively-tooth-64c2 > New deployment > carica MAIA-Documenti-v7.zip > Deploy. Se viene richiesta una cartella, estrai lo ZIP e seleziona quella con index.html direttamente al suo interno. Non modificare dominio o DNS.

## 5. Usa il pannello
1. Accedi con Gaia e apri Studio > Documenti e allegati riservati.
2. Per la gestione è richiesto il secondo fattore. Se necessario apri Sicurezza, configura/verifica un codice dell’app di autenticazione, poi torna ai documenti e premi Aggiorna autorizzazioni documenti. Non condividere chiavi di recupero o codici.
3. Inserisci titolo, eventuale descrizione e scegli PDF, DOCX o PPTX. Premi Carica in area privata.
4. Il caricamento non assegna alcun paziente automaticamente.
5. Nel pannello del file cerca gli utenti per email, almeno tre caratteri. La ricerca mostra soltanto account confermati, fino a 20 risultati: completa l’email per restringere la ricerca.
6. Seleziona uno o più utenti e premi Salva destinatari. Le spunte non hanno effetto prima del salvataggio. Massimo 200 destinatari per documento.
Se un’altra sessione cambia i destinatari mentre stai lavorando, il salvataggio viene fermato: usa Ricarica destinatari attuali e verifica di nuovo le scelte.

7. I destinatari accedono con quell’account e aprono Profilo/Account > I miei documenti, oppure https://metimaia.com/miei-documenti. Possono scaricare soltanto i materiali assegnati e attivi.

Word e PowerPoint vengono scaricati nei formati originali; il dispositivo deve avere un’app adatta per aprirli. Il PDF può essere aperto dal dispositivo dopo il download. Non è presente un editor o visualizzatore Office incorporato. Per file .doc/.ppt o protetti usa una copia PDF/DOCX/PPTX compatibile.

## 6. Revoche e archivio
- Per revocare un utente: rimuovilo dalla selezione del documento e salva.
- Per revocare tutti: Deseleziona tutti > Salva destinatari.
- Archivia e revoca tutti gli accessi richiede conferma, disattiva il materiale e rimuove tutti i destinatari.
- Riattivare il documento non ripristina gli accessi precedenti: scegli e salva nuovamente i destinatari.
- Le nuove richieste di download verificano i permessi sul server. Il sito non crea link pubblici o firmati che possano sopravvivere alla revoca. Le copie già scaricate non possono essere cancellate a distanza; un utente autorizzato può sempre conservare o copiare un file ricevuto.

## 7. Prova reale dopo l’installazione
Usa un piccolo PDF fittizio privo di dati personali e due tuoi account di prova confermati.

1. Gaia carica il file; prima di scegliere destinatari entrambi gli account devono avere elenco vuoto.
2. Assegna soltanto il primo account. Da una finestra privata, questo deve vedere/scaricare il file; il secondo non deve vederlo.
3. Revoca il primo accesso, salva e prova un nuovo download dalla sua pagina già aperta: deve essere negato. Aggiorna poi l’elenco.
4. Assegna di nuovo e prova Archivia: i destinatari devono perdere accesso. Riattiva: l’assegnazione deve restare vuota.
5. Un account normale o un editor senza permesso documentale non deve poter gestire file, cercare gli utenti o modificare i destinatari.
6. Se una verifica fallisce, non usare documenti reali finché non è corretta. I test di sviluppo simulano Storage: l’upload nel progetto reale e metadata.size/mimetype vanno controllati con questa prova.

## Conservazione e limiti
- File, titoli, descrizioni e assegnazioni sono dati riservati. Sono conservati in Supabase; il download usa una verifica autenticata, con risposte no-store.
- Archiviare o interrompere un caricamento non elimina i bytes dal bucket. La cancellazione definitiva e la pulizia dei caricamenti falliti richiedono una procedura autorizzata nel progetto Supabase. Non eliminare alla cieca oggetti ancora usati.
- Per identificare un caricamento fallito, il titolare può consultare session_documents (state failed/uploading) nel Table Editor e il relativo storage_path; confermare prima che il file non sia utilizzato, poi gestire la rimozione dal bucket con gli strumenti amministrativi. Questa release non offre cancellazione definitiva dal sito.
- Cancellare l’account destinatario rimuove assegnazioni e registrazioni correlate, senza eliminare il materiale caricato dalla professionista.
- L’esportazione JSON del profilo non comprende i nuovi file: si scaricano separatamente. Non è un backup completo.
- Per il backup includi sia database sia oggetti del bucket privato. Definisci frequenza, conservazione, ruoli e procedura di ripristino e aggiorna l’informativa alla gestione effettiva. Il pacchetto non stabilisce termini legali automatici e non certifica conformità.
- La validazione di formato e dimensione non equivale a una scansione antivirus. Carica solo materiale affidabile e controllato. Non vengono convertiti o modificati i documenti.
- Non sono inclusi gruppi nominati, inviti a email non registrate, notifiche automatiche, firma digitale o un fascicolo clinico completo.

## Verifiche di sviluppo
81 test automatici passati, inclusi SQL/RLS/MFA in PostgreSQL locale con Auth/Storage simulati e controlli del proxy JWT, MIME, dimensioni e revoca. Browser con servizi simulati: upload privato senza grant automatici, selezione/salvataggio, utenti isolati, download binario, revoca, archivio/riattivazione e layout 320/390/1440. Nessun dato reale caricato, account creato, email inviata o pubblicazione live eseguita dall’assistente.
