# metiMaia — aggiornamento v8.1

Il sito usa **Dott.sa Gaia**, senza cognome, nei testi pubblici, nei titoli e nelle descrizioni per Google. È una versione completa cumulativa: include tutte le pagine e le correzioni Studio della v8.

## Caricamento su Cloudflare

1. Scarica **MAIA-Sito-v8.1-Dott-sa-Gaia.zip**.
2. Apri Cloudflare > Workers & Pages > lively-tooth-64c2.
3. Premi **New deployment**, carica lo ZIP e premi **Deploy**.
4. Se viene chiesta una cartella, estrai lo ZIP e seleziona quella con index.html direttamente al suo interno.
5. Riapri https://metimaia.com/gaia e aggiorna la pagina; deve comparire **Dott.sa Gaia**. Aggiorna anche le altre schede del sito rimaste aperte.

Per questo aggiornamento del nome non devi eseguire nuove query Supabase. Restano necessarie le configurazioni già installate per le funzioni Studio/documenti. Dominio e DNS non richiedono interventi.

## Che cosa comprende

- Nome visibile nelle pagine Gaia, home, account, chat, messaggi, Shop, newsletter e privacy.
- Metadati HTML, anteprime social e dati strutturati per Google aggiornati.
- Anche i riferimenti precedenti alla professionista negli articoli, nelle checklist, nel profilo e nei prodotti ricevuti dal database vengono presentati con il nome scelto.
- Nuovi articoli e saluto della richiesta di disponibilità usano il nome scelto.
- Email, identificativi degli account, collegamenti originali e messaggi degli utenti conservano i propri valori.
- Il file HTML di verifica Google originale resta incluso; non è aggiunto il tag meta di verifica.

Questa modifica riguarda la visualizzazione del sito. Non riscrive le righe del database, i messaggi privati o il contenuto dei file caricati. Nei campi di modifica di Studio possono essere presenti i testi originali. I template email e le funzioni email di Supabase/Resend si aggiornano separatamente: caricare lo ZIP Cloudflare non li modifica. La guida PDF non è stata modificata.

## Verifiche

94 test automatici passati; controlli TypeScript, lint e build di produzione completati. 31 controlli browser su larghezze 390 e 1440 pixel, con dati fittizi intercettati: testi remoti precedenti, articoli, checklist, Shop, privacy, metadati e conservazione di email/collegamenti. Nessun invio email, pagamento, account o modifica reale al database durante le prove.

## Abilitare l’accesso Studio richiesto

Questa è una procedura separata dal caricamento del sito. L’indirizzo indicato è **ostetricamaia@gmail.com**.

1. L’account deve essere già stato creato dal sito e confermato tramite email.
2. Apri Supabase > progetto metimaia > SQL Editor > New query.
3. Copia tutto il file **ABILITA-ADMIN-STUDIO.sql** nella query e premi **Run**.
4. La query si ferma se non trova un unico account confermato corrispondente all’email. Non crea account né invia messaggi.
5. Il risultato deve indicare email_confermata=true e studio_abilitato=true.
6. Esci dal sito e accedi di nuovo con quell’email, quindi apri https://metimaia.com/studio.

L’abilitazione concede gli strumenti editoriali e di amministrazione del sito. Non concede nuovi permessi per conversazioni o documenti privati e non attribuisce una qualifica di revisore clinico. Eventuali permessi, qualifiche e obbligo del codice di sicurezza già presenti vengono conservati.
