# metiMaia v14.2 — videochiamate e inviti via email

Questo aggiornamento comprende il sito completo e una piccola configurazione Supabase. **L’invio email funziona dopo aver applicato la migrazione 019 e pubblicato la funzione `video-call-invite`.** Caricare soltanto il sito non attiva il nuovo servizio email.

## Come lo usa Gaia

1. Da **Studio → Gestisci videochiamate**, cerca la paziente tramite nickname o email. Controlla l’indirizzo e scegli l’account corretto; deve avere già confermato la registrazione.
2. Premi **Prepara link della stanza**. Viene preparato un indirizzo Hostpoint casuale, senza nomi o altri dati della paziente. Puoi anche incollare il link di una nuova stanza Hostpoint. Ogni incontro deve usare una stanza diversa.
3. Premi **Salva videochiamata**. L’invito è disponibile nell’area riservata della paziente; **non parte nessuna email**. La preparazione si chiude e compare la scheda appena salvata.
4. Controlla destinataria e contenuto indicato in **Cosa riceve la paziente?**, poi premi **Invia invito**. L’email parte solo con questo pulsante. **Copia link** permette anche di inoltrare personalmente l’invito via email o messaggio; se il browser impedisce la copia, il link diventa selezionabile.
5. All’orario concordato, Gaia e paziente scelgono **Entra nella videochiamata**. La stanza si apre su Hostpoint Meet, dove si gestiscono microfono, telecamera e protezione dell’accesso.

Giorno e ora vanno concordati prima con la paziente, anche rispondendo all’email. Questo pannello non prenota un appuntamento in calendario. L’accesso dura **7 giorni dal salvataggio**: prepara l’invito vicino alla data dell’incontro. Preparare un indirizzo non avvia la videochiamata né conferma la disponibilità del servizio Hostpoint.

## Cosa riceve la paziente

Un’email da **Dott.sa Gaia | metiMaia <noreply@metimaia.com>**, con oggetto **Il tuo invito alla videochiamata con Gaia 🌿** e pulsante **Apri il tuo invito**. Le risposte arrivano a **ostetricamaia@gmail.com**.

Il pulsante apre il singolo invito nell’area riservata, senza esporre il link diretto della stanza nell’email. La paziente accede con l’account destinatario e poi sceglie **Entra nella videochiamata**. Il ritorno dopo login conserva l’invito selezionato; non viene avviata una chiamata automaticamente. Chi accede con un account diverso, oppure apre un invito scaduto o revocato, riceve una spiegazione senza vedere la stanza.

## Attivazione — nell’ordine

### 1. Database Supabase

Nel pacchetto **MAIA-Config-v14.2-Videochiamate.zip** apri `019-videochiamate-email.sql`. In Supabase, apri **SQL Editor → New query**, incolla tutto il contenuto e premi **Run**. Usa il progetto metiMaia già configurato con le migrazioni precedenti, inclusa la 010 per le videochiamate. Esegui la 019 una sola volta; non serve rieseguire le vecchie migrazioni.

### 2. Funzione email Supabase

In **Edge Functions** crea una funzione dal nome esatto **video-call-invite**. Sostituisci il contenuto di `index.ts` con il file omonimo incluso nel pacchetto di configurazione e pubblicala.

Nelle impostazioni della funzione disattiva **Verify JWT / Enforce JWT verification** del gateway. È lo stesso schema delle funzioni documenti: il codice verifica comunque il token reale dell’utente, l’appartenenza allo Studio e l’eventuale requisito di autenticazione a due fattori; il database ripete i controlli. Non eliminare questi controlli dal file.

In **Edge Functions → Secrets** verifica che esista **RESEND_API_KEY**, già usato dagli avvisi documenti, e che il dominio mittente `metimaia.com` sia verificato su Resend. Non occorrono una nuova chiave, un cron o un token di pianificazione. Le variabili Supabase server sono fornite dall’ambiente; non inserire chiavi nel sito o nel file SQL. Non modificare le funzioni documenti esistenti.

Per chi usa la CLI: il sorgente contiene già la migrazione in `supabase/migrations/202611030019_video_call_email_invitations.sql` e la funzione in `supabase/functions/video-call-invite/index.ts`; `supabase/config.toml` include `verify_jwt = false` per questa funzione.

### 3. Sito Cloudflare

Carica **MAIA-Sito-v14.2-Videochiamate.zip** come nuovo deployment del progetto del sito. Se Cloudflare richiede una cartella, estrai lo ZIP e carica il suo contenuto con `index.html` al primo livello. Non caricare il pacchetto di configurazione Supabase su Cloudflare.

Controlla la scritta **v14.2** in fondo alla pagina. Nell’app già aperta usa **Aggiorna MAIA** quando compare.

### 4. Prova finale con account di test

Con due account di prova, uno Studio e uno destinatario confermato, salva una videochiamata. Verifica che nessuna email parta prima del pulsante. Premi **Invia invito**, controlla l’email reale anche nello spam, apri il link da ospite e accedi con l’account destinatario. Prova l’apertura di Hostpoint su entrambi i dispositivi e le autorizzazioni microfono/telecamera. Infine revoca l’invito e controlla che dall’area metiMaia non si apra più.

Questa prova invierà un’email al solo account di test scelto da te. Non è stata eseguita dall’assistente sul progetto in produzione.

## Come leggere gli esiti

- **Email non ancora inviata**: l’incontro è salvato, ma nessuno ha richiesto l’invio.
- **Invito affidato al servizio email**: Resend ha accettato la richiesta. Non dimostra consegna o lettura; il pulsante non invia di nuovo lo stesso invito.
- **Invio in corso**: attendi qualche minuto e usa **Aggiorna inviti**.
- **Invio non riuscito / esito non confermato**: puoi usare **Riprova invio**. Il database conserva destinatario e richiesta; la stessa chiave Resend evita duplicati nella finestra consentita. I tentativi si fermano prima delle 24 ore di conservazione della chiave del fornitore.
- **Stato email non disponibile**: aggiorna gli inviti; se persiste, controlla migrazione e funzione. Il sito non mostra una falsa conferma di invio.
- **Invio sospeso**: non richiedere un nuovo invio automatico dello stesso invito. Controlla destinatario/configurazione e usa, se opportuno, il link copiabile per un inoltro personale.

La revoca interrompe l’apertura dall’area metiMaia, anche tramite un invito già ricevuto per email. Non chiude una chiamata già avviata e non revoca un eventuale link diretto Hostpoint già copiato: termina o proteggi la stanza anche nel servizio esterno.

## Verifiche e limiti

I controlli automatici usano database locali e servizi simulati: nessuna email reale, nessun account paziente e nessuna stanza reale sono stati modificati. Il report `VERIFICA.json` registra gli esiti finali. Cloudflare, Supabase, consegna email e collegamento audio/video reali richiedono l’attivazione e la prova descritte sopra. Questo aggiornamento non risolve né verifica il precedente blocco Play Protect sul telefono Android.
