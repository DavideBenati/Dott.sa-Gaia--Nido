# metiMaia v14.2 — pacchetto Cloudflare con header consolidati

**File da caricare: MAIA-Sito-v14.2-Cloudflare.zip.** È il sito completo v14.2, con la stessa applicazione e una correzione delle regole di pubblicazione. Non è una patch da aggiungere al vecchio ZIP: usa questo pacchetto completo.

## Per il caricamento che resta fermo

Lo screenshot ricevuto mostra il pannello di upload, senza un errore esplicito. Il pacchetto precedente è integro e sotto i limiti di dimensione; anche il suo file `_headers` è accettato dal parser ufficiale Cloudflare. Non abbiamo quindi una causa confermata per il caricamento bloccato. La prova seguente usa una cartella estratta e una nuova sessione del pannello.

1. Scarica **MAIA-Sito-v14.2-Cloudflare.zip** e scegli **Estrai tutto** sul computer.
2. Riapri Cloudflare in una nuova finestra privata di Chrome o Edge e accedi. Da **Workers & Pages**, apri il progetto che pubblica **metimaia.com**, poi il caricamento dei file statici per aggiornarlo.
3. Scegli il caricamento di una **cartella**, oppure trascina la cartella estratta nel riquadro. La cartella da scegliere deve contenere direttamente `index.html`, `_headers`, le cartelle `_expo`, `assets` e `icons`. Non selezionare soltanto i file visibili al primo livello: servono anche tutte le sottocartelle.
4. Attendi la fine del caricamento dei file, poi premi **Deploy** una sola volta. Mantieni il file `_headers` nel pacchetto.
5. Dopo il successo apri `https://metimaia.com/videochiamate` e controlla **v14.2** nel piè di pagina. Il numero dell’app resta 14.2 perché sono cambiate le regole di pubblicazione, non le funzioni dell’app.

Il sito già pubblicato continua a essere servito finché un nuovo deployment non viene completato. Non occorre cancellare Worker, domini o deployment precedenti.

Se anche la cartella estratta resta ferma senza errore, prova un altro browser aggiornato o un’altra connessione. Se compare un errore, conserva il testo esatto. Se il pannello continua a bloccarsi, serviranno il nome del Worker e il dettaglio della richiesta che fallisce nel pannello di rete del browser; senza questi dati non è possibile attribuire il problema a un file del sito o al servizio Cloudflare.

## Correzione verificata del pacchetto

Il file precedente conteneva più blocchi `_headers` per lo stesso percorso. Il parser ufficiale li accetta, ma la costruzione della configurazione Workers conserva l’ultimo blocco per ciascun percorso. Questo può perdere impostazioni precedenti come `Cache-Control: no-store` e, per la newsletter, `Referrer-Policy: no-referrer`.

Il nuovo pacchetto unifica gli header in **un solo blocco per percorso**, preservando le impostazioni di cache, indicizzazione, sicurezza, manifest e service worker. La verifica usa sia i test locali sia il parser e il costruttore ufficiali di Wrangler. Il report allegato registra gli esiti. Questa correzione è certa; non è una conferma che fosse la causa del caricamento fermo.

## Inviti alle videochiamate

Le funzioni videochiamate sono quelle della v14.2. L’invio via email richiede la migrazione 019 e la funzione Supabase `video-call-invite`, come descritto nel pacchetto **MAIA-Config-v14.2-Videochiamate.zip** già fornito. Questa correzione Cloudflare non richiede altre migrazioni o nuove chiavi email.
