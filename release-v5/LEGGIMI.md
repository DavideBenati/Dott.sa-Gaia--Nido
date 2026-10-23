# metiMaia — chiarezza, verifiche e newsletter v5

## Pacchetti
- MAIA-Qualita-v5.zip: sito completo da caricare su Cloudflare, cumulativo rispetto a v4.
- MAIA-Configurazione-v5.zip: migrazione SQL 006, funzione newsletter-sync, versione aggiornata della funzione newsletter, istruzioni e pianificazione facoltativa.
Non caricare lo ZIP di configurazione come sito.

## Modifiche al sito
- Il percorso personale precede il richiamo allo Shop, che rimane nelle tab e nell’intestazione.
- Nuova pagina Contatti: distingue richiesta d’incontro senza account, informazioni sui servizi via email e conversazione privata collegata all’account. Non promette risposte immediate.
- Gaia e servizi spiega i passaggi successivi alla richiesta; non sono stati inventati servizi, qualifiche, zone, prezzi o disponibilità. I dati rimangono modificabili da Studio.
- Nuova pagina Verifiche del sito in Studio: evidenzia dati mancanti, stato dei contenuti e prodotti. Non certifica correttezza clinica, qualifiche o conformità legale.
- Conferma pagamento con venditore, spedizioni e resi, scorrimento su schermi piccoli, focus da tastiera, Escape e ritorno del focus al pulsante di acquisto. I pagamenti rimangono esterni su Stripe.
- Guida pubblica GESTIONE-E-BACKUP.txt con procedura per backup completo, prova di ripristino separata e verifica dei pagamenti in ambiente di test. Il backup completo non è stato eseguito: richiede accesso al progetto e una procedura adeguata al piano Supabase.
- File Google originale nella radice: googlee8a922f3d8a9d320.html. Nessun tag meta di verifica Google è stato aggiunto, come richiesto.

## Pubblica il sito
Cloudflare > Workers & Pages > lively-tooth-64c2 > New deployment > carica MAIA-Qualita-v5.zip > Deploy. Se viene richiesta una cartella, estrai il pacchetto e seleziona quella che contiene direttamente index.html.
Le nuove pagine Contatti/Verifiche sono utilizzabili con la configurazione v3/v4 esistente. La sincronizzazione newsletter richiede i passaggi seguenti; fino ad allora non è attiva.

## Configura la sincronizzazione newsletter
Prerequisiti: migrazioni 001–005 già applicate, funzione newsletter esistente, segreto RESEND_API_KEY funzionante. Non rieseguire Database Creation né le vecchie migrazioni.

1. Su Resend > API Keys crea una chiave separata per la gestione contatti, con permesso Full access. Nome suggerito: metiMaia contatti. La chiave Sending access esistente non basta per leggere/modificare i contatti. Non sostituire la vecchia chiave d’invio.
2. Su Supabase > Edge Functions > Secrets salva la nuova chiave come RESEND_CONTACTS_API_KEY. Non condividerla e non inserirla negli asset del sito.
3. Supabase > SQL Editor > New query: incolla tutto 202610230006_newsletter_sync.sql, Run, attendi Success. Esegui una volta sola. La migrazione accoda gli iscritti confermati e revocati esistenti senza iscrivere nuovi utenti. L’esportazione CSV viene bloccata finché rimangono aggiornamenti da allineare.
4. Edge Functions > Deploy a new function > Via Editor: nome esatto newsletter-sync, copia newsletter-sync/index.ts, Deploy. Settings > Verify JWT: disattivato. L’endpoint pubblico del webhook verifica la firma; le altre operazioni richiedono un amministratore verificato con MFA se attiva, oppure un segreto riservato alle chiamate server.
5. Apri la funzione newsletter già esistente, sostituisci il codice con newsletter/index.ts del pacchetto e ridistribuiscila, mantenendo Verify JWT disattivato. Non sostituire site-actions: è una funzione diversa e resta invariata.
6. Su Resend > Webhooks > Add webhook inserisci questo endpoint:
   https://gwepsvlxwjptbchhlldm.supabase.co/functions/v1/newsletter-sync?webhook=resend
7. Seleziona gli eventi contact.updated, contact.deleted e suppression.added. Salva e copia il Signing secret del webhook, che inizia con whsec_. Non è la chiave API.
8. Su Supabase > Edge Functions > Secrets salva il Signing secret come RESEND_WEBHOOK_SECRET.
9. Dal sito, accedi con Gaia > Studio > Gestisci newsletter e revoche > Controlla iscritti e revoche su Resend. Il controllo elabora blocchi di cinque contatti. Per elenchi grandi può richiedere più passaggi: usa Riprova aggiornamenti in attesa finché non restano attese o errori. Nessuna campagna viene inviata dal pulsante.
10. Verifica con una tua email di prova: iscrizione, conferma, presenza nei contatti Resend; poi revoca dal sito e controllo su Resend. Prova anche una revoca dal provider e controlla lo stato locale. Una revoca del provider ha precedenza: non viene riattivata automaticamente da un vecchio consenso. Per una nuova iscrizione dopo revoca dal provider occorre una verifica dedicata con Gaia.

## Ritenti automatici ogni cinque minuti
Le conferme e revoche dal sito tentano subito la sincronizzazione. Per recuperare errori o interruzioni anche a pagina chiusa, configura il ritento pianificato.

1. Genera una stringa casuale di almeno 48 caratteri nel gestore password.
2. Supabase > Edge Functions > Secrets: salvala come NEWSLETTER_SYNC_JOB_TOKEN.
3. Supabase > Vault: crea un segreto con nome maia_newsletter_sync_token e lo stesso valore. Il valore resta lato server.
4. Database > Extensions: verifica che pg_cron e pg_net siano abilitati.
5. SQL Editor: esegui ATTIVA-NEWSLETTER.sql una sola volta. Lo script recupera il token da Vault; non contiene segreti da incollare nel codice.
6. Nella sezione Cron verifica che maia-newsletter-sync sia attivo ogni cinque minuti e controlla le esecuzioni. Un job HTTP avviato non equivale a un aggiornamento riuscito: controlla anche attese/errori nel pannello del sito.

Gli aggiornamenti hanno una prenotazione temporanea di due minuti per evitare esecuzioni duplicate. Se una chiamata si interrompe, attendi due minuti prima di riprovare. Errori di chiave, permesso o limite Resend non vengono considerati sincronizzazioni riuscite.

## Prima di inviare campagne
Completa il controllo e risolvi gli errori. Esporta un elenco nuovo solo dopo la riconciliazione e mantieni in Resend soppressioni e disiscrizione. Un CSV già scaricato non si aggiorna da solo, quindi non riutilizzarlo come prova del consenso attuale.
La sincronizzazione trasferisce email e stato d’iscrizione, senza dati del percorso o della chat. Gli identificativi tecnici dei webhook sono eliminati dopo 30 giorni durante l’elaborazione degli eventi; le iscrizioni e le prove di consenso non vengono eliminate da questa pulizia. Conservazione e garanzie sui dati personali devono essere definite dal titolare nell’informativa.
Non sono implementate campagne automatiche o riattivazioni automatiche dopo una soppressione del provider.

## Verifica Google
Dopo il deployment apri:
https://metimaia.com/googlee8a922f3d8a9d320.html
Deve mostrare esattamente:
google-site-verification: googlee8a922f3d8a9d320.html
Quindi torna in Google Search Console e premi Verifica per il metodo file HTML. Mantieni il file anche negli aggiornamenti futuri. Non è stato aggiunto alcun tag meta di verifica alla homepage. Una verifica di proprietà non garantisce indicizzazione o posizionamento.

## Dati che mancano ancora
Gaia deve definire servizi effettivi, zone/modalità, eventuali costi, qualifiche verificabili e tempi di risposta. Non sono stati aggiunti articoli clinici approvati, prodotti inventati, condizioni di vendita arbitrarie, orari o promesse di risposta.
Dal pannello Verifiche apri la guida a backup e prove finali. Esegui ripristino e pagamenti solo in ambienti separati di prova; questi controlli reali non sono stati eseguiti dall’assistente e non sono simulati come completati.
