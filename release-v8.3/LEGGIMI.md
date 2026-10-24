# metiMaia — Solo email nei contatti pubblici, v8.3

Sito completo cumulativo per Cloudflare. Il contatto pubblico della Dott.sa Gaia è **ostetricamaia@gmail.com**.

## Cambiamenti

- Numero personale, pulsanti Chiama e WhatsApp rimossi dalla pagina Gaia e da Contatti.
- Eliminata anche la costante del numero dai file applicativi; la nuova esportazione è stata generata senza riutilizzare i vecchi file compilati.
- Contatti propone soltanto l’email, con indirizzo copiabile e pulsante che apre la propria app email.
- Anche le schede dei servizi aprono un’email, con il servizio già indicato nell’oggetto.
- Riquadri Home, richiami pubblici e metadati aggiornati per indicare l’email.
- Il modulo di richiesta incontro prepara il riepilogo da aprire o copiare nella propria app email. L’utente controlla il messaggio e preme Invia dalla propria app: il sito non invia la richiesta al database e non mostra una falsa conferma di invio.
- Testo privacy sulle richieste di incontro allineato al nuovo flusso.

La presentazione, il percorso formativo e i quattro servizi forniti nel documento sono conservati. Il nome pubblico resta Dott.sa Gaia. I contatti pubblici non propongono la chat; la conversazione riservata nell’account resta una funzione distinta, come i documenti privati.

## Caricare su Cloudflare

1. Scarica **MAIA-Sito-v8.3-Solo-Email.zip**. Questa è la versione da usare per l’aggiornamento attuale.
2. Apri **Cloudflare > Workers & Pages > lively-tooth-64c2**.
3. Premi **New deployment**, carica lo ZIP e premi **Deploy**.
4. Se viene richiesta una cartella, estrai lo ZIP e seleziona quella con index.html direttamente al suo interno.
5. Riapri https://metimaia.com/contatti e https://metimaia.com/gaia e aggiorna le pagine. Aggiorna anche eventuali altre schede del sito rimaste aperte.

Per questo aggiornamento non servono query SQL, migrazioni Supabase, nuove chiavi, modifiche a ruoli, dominio o DNS.

## Uso quotidiano

Per informazioni e nuove richieste di disponibilità, controlla la casella email. Le richieste inviate tramite app email non vengono aggiunte automaticamente all’elenco Richieste di Studio; le richieste già presenti restano consultabili.

L’email pubblica di Gaia e Contatti è modificabile da **Studio > Gaia, servizi e privacy > Email pubblica di contatto > Salva modifiche**. La preparazione della richiesta d’incontro usa l’indirizzo di metiMaia indicato sopra.

Il testo della presentazione rimane modificabile da Studio con **Usa la presentazione dal documento** e **Salva modifiche**. Foto e informazioni privacy già salvate sono conservate.

## Verifiche

97 test automatici passati, TypeScript, lint e build di produzione completati. 42 controlli browser a 390 e 1440 pixel: assenza del numero e di WhatsApp, email corretta, richieste preparate tramite app email senza invio al backend, profili personalizzati e flussi Studio.

Verificati anche la navigazione del modulo con focus e scorrimento a 320, 390, 1024 e 1440 pixel e i flussi precedenti di account, articoli, checklist, newsletter e Studio. I servizi esterni sono stati simulati: nessun messaggio reale è stato inviato e nessun dato di produzione è stato modificato dalle prove.

L’archivio completo conserva il file HTML originale di verifica Google; non contiene il tag meta di verifica Google, file .env, sorgenti Word, script SQL o mappe dei sorgenti.
