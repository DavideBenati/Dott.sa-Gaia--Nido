# Pubblicare metiMaia da Windows con Wrangler

Il pannello Cloudflare continua a rispondere `401 Unauthorized` durante l’upload. La console mostra inoltre moduli JavaScript del pannello serviti come HTML. Questi messaggi riguardano il caricamento e l’autorizzazione nel pannello Cloudflare; non indicano un errore nel codice delle videochiamate.

Questo pacchetto offre una pubblicazione con **Wrangler 4.157.0**, lo strumento ufficiale suggerito dalla stessa pagina Cloudflare. Usa l’API ufficiale tramite un nuovo accesso nel browser e non passa dall’uploader che resta fermo. Può comunque essere bloccato se l’account non dispone dei permessi necessari o se la connessione impedisce le richieste Cloudflare: in tal caso si ferma mostrando l’errore.

## Come usarlo

1. Installa **Node.js LTS** dal sito ufficiale: **https://nodejs.org/it/download**. Per Windows scegli l’installer e mantieni il componente **npm** previsto dall’installazione. Se hai già Node.js 22 o successivo con npm, puoi procedere.
2. Scarica **MAIA-Pubblicazione-Windows-v14.2.zip**. Scegli **Estrai tutto** e apri la cartella estratta, per esempio sul Desktop.
3. Fai doppio clic su **PUBBLICA-MAIA.cmd**, dalla cartella estratta. La finestra verifica tutti i file e scarica la versione fissata dello strumento ufficiale Wrangler; serve una connessione a Internet.
4. Quando si apre il browser, accedi a Cloudflare e autorizza Wrangler. L’accesso avviene nel browser ufficiale: la procedura non richiede di incollare chiavi o password nella finestra.
5. Torna alla finestra della procedura. Leggi la destinazione **Worker metimaia**. Quando viene richiesto, scrivi **PUBBLICA** e premi **Invio** per caricare e attivare il sito completo v14.2.
6. Attendi il messaggio **Pubblicazione verificata: nuova versione attiva al 100%**. Poi apri **https://metimaia.com/videochiamate** e verifica il funzionamento. Il numero dell’app nel piè di pagina è **v14.2**.

Questo ZIP serve alla procedura Windows: non caricarlo nel pannello Cloudflare. I file del sito sono nella sottocartella `site`; il programma, le istruzioni e le informazioni di verifica rimangono fuori dai file pubblicati.

Se Windows o il computer aziendale impediscono l’esecuzione o l’installazione, usa un computer su cui hai autorizzazione a installare Node.js oppure rivolgiti al suo amministratore. Se la finestra si ferma, conserva il messaggio esatto e il nome della fase. Non interpretare il solo caricamento riuscito come conferma che il sito è stato aggiornato.

## Cosa controlla prima di pubblicare

La destinazione è il Worker **metimaia** nell’account identificato dall’indirizzo del pannello fornito nello screenshot. Nessun altro Worker viene scelto automaticamente.

La procedura verifica le impronte dei **111 file** del sito. Poi legge il deployment attuale e richiede una sola versione attiva al 100%, senza codice Worker personalizzato, binding a risorse, variabili, segreti o impostazioni runtime non previste. In presenza di questi elementi si interrompe, evitando di rimuoverli. Conserva data e flag di compatibilità dichiarati dalla versione attuale.

Il caricamento crea prima una nuova versione senza spostare il traffico. Un conflitto segnalato da Wrangler interrompe la procedura. Prima dell’attivazione viene controllato che nessun altro abbia cambiato il deployment nel frattempo. Solo dopo viene richiesta l’attivazione della nuova versione al 100%, seguita da una rilettura dello stato effettivo.

Si usano i comandi delle **versioni**, che non ripubblicano route, domini personalizzati, cron o impostazioni `workers.dev`. Le impostazioni non versionate di osservabilità, logpush e tail consumers non sono impostate dal pacchetto.

Per gli asset viene richiesta esplicitamente la gestione HTML **auto-trailing-slash** e il fallback **single-page-application**, adatti a questa applicazione. Le API delle versioni non espongono tutte le opzioni avanzate degli asset configurate nel pannello: non si promette la conservazione di impostazioni arbitrarie diverse da queste. I conflitti di configurazione rilevati da Wrangler fanno fermare l’upload; non vanno forzati senza esaminarli.

## File generati e risultato

Il programma genera localmente `cf-config.json` e, dopo un caricamento valido, `maia-publicazione-risultato.json`. Quest’ultimo conserva gli identificativi delle versioni precedente e caricata, insieme allo stato verificato. Il file di eventi dell’upload è `.maia-upload.jsonl`. Questi file restano fuori dalla cartella pubblicata.

Un upload valido può essere seguito da un’attivazione non confermata o da un errore di lettura. La procedura non segnala successo in questi casi. Se non può verificare l’esito, controlla il deployment del Worker prima di ripetere la pubblicazione.

Per un eventuale ripristino, conserva l’identificativo precedente e usa il rollback del deployment nel pannello Cloudflare dopo aver controllato quale versione è attiva. Non è inclusa una procedura automatica di ripristino che possa sovrascrivere modifiche successive di altre persone.

## Verifiche e limiti

Il report allegato registra i test del programma con risposte Cloudflare simulate e la simulazione `--dry-run` con il vero Wrangler. Queste prove non effettuano un accesso all’account, non modificano deployment in produzione e non provano la consegna email o una chiamata Hostpoint reale.

Il launcher Windows è stato revisionato; l’ambiente dell’assistente è Linux e non consente una prova diretta con doppio clic su Windows. La pubblicazione reale richiede il tuo accesso e il tuo comando **PUBBLICA**. Le eventuali autorizzazioni insufficienti dell’account devono essere risolte su Cloudflare.

Gli inviti email della v14.2 richiedono sempre la migrazione Supabase 019 e la funzione `video-call-invite` già fornite. Questa procedura pubblica il sito; non applica modifiche a Supabase.
