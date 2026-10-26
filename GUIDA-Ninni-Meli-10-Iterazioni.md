# NinniMeli — dieci iterazioni su usabilità e professionalità (v10–v19)

## Pubblicazione

Usare **soltanto Ninni-Meli-Sito-v19.zip**: comprende tutti i miglioramenti. Le altre nove versioni sono conservate per confronto, non vanno caricate in sequenza.

Cloudflare → Compute → Workers & Pages → ninni-meli-shop → Create deployment → Production → caricare lo ZIP v19 → Deploy. Aprire ninnimeli.com e aggiornare con Ctrl+F5 o in finestra privata.

Non occorrono modifiche a Supabase, Stripe, Worker o DNS. Mantenere ENABLE_TEST_CHECKOUT=false. Il sito continua a leggere i prodotti pubblicati e a nascondere le bozze. Il logo rimane quello originale ospitato nel bucket Supabase; non rinominare o cancellare NinniMeli_Logo.jpeg.

## Le dieci iterazioni

1. **v10 — Gerarchia editoriale.** Apertura più concisa, messaggi di stato coerenti, intestazione meno ingombrante e sezioni principali identificate semanticamente. Il progetto resta orientato a cura, produzione italiana e filiera corta, distinguendo obiettivi da caratteristiche documentate.
2. **v11 — Orientamento.** Navigazione che indica la sezione visibile, collegamenti più agevoli da selezionare e riferimenti espliciti al dialogo della borsa.
3. **v12 — Catalogo in preparazione.** Stato vuoto intenzionale con collegamenti utili a filiera e informazioni per l’acquisto; caricamento ed errore rimangono distinti. Nessun prodotto fittizio inserito nel catalogo.
4. **v13 — Ricerca e ordinamento.** Ricerca per nome/descrizione, ordinamento per prezzo o nome, conteggio risultati e ripristino dopo una ricerca senza corrispondenze. Strumenti nascosti quando il catalogo è vuoto.
5. **v14 — Lettura del prodotto.** Scheda completa in dialogo, descrizione integrale, prezzo, disponibilità e collegamento ai criteri della filiera. Aggiunta alla borsa dalla scheda senza perdere il contesto.
6. **v15 — Borsa più chiara.** Rimozione diretta, subtotali per articolo, contatori con etichette leggibili dai lettori di schermo e collegamento alla collezione dalla borsa vuota. Nessuna falsa promessa su spedizioni o IVA.
7. **v16 — Feedback contestuale.** Avviso connessione assente e messaggio nel riepilogo quando la rivalidazione modifica la borsa per prezzi, scorte o prodotti ritirati. Aggiornamento della scheda eventualmente aperta. Il controllo di connessione del browser è indicativo e non sostituisce l’esito delle richieste.
8. **v17 — FAQ consultabili.** Ricerca nelle domande e risposte, conteggio risultati e ripristino; apertura delle risposte più riconoscibile.
9. **v18 — Accessibilità e coerenza visiva.** Contrasto dei testi secondari rafforzato, focus visibile, controlli tattili più ampi, descrizioni sintetiche nelle schede con lettura completa disponibile, supporto movimento ridotto e colori forzati. Font locali con font-display:swap.
10. **v19 — Rifinitura e distribuzione.** Riduzione dei blocchi ripetitivi, collegamenti utili nel footer, focus iniziale della borsa e intestazioni Cloudflare per cache e caricamento delle sole risorse previste.

## Come usare le nuove funzioni

La ricerca prodotti e l’ordinamento appariranno quando ci saranno prodotti pubblicati. Per ciascuno, “Leggi la scheda completa” apre la descrizione e consente di passare alla borsa dimostrativa. I prodotti con stock zero non possono essere aggiunti.

Le FAQ sono ricercabili già con catalogo vuoto. Nella borsa, “Rimuovi” elimina l’articolo, mentre i pulsanti quantità rispettano disponibilità e limite dimostrativo. I contatori nell’intestazione e nella scorciatoia mobile rimangono sincronizzati.

Il checkout resta controllato dal Worker. Non sono stati modificati il protocollo del pagamento, i prezzi server o la gestione webhook. Con il flag false non è possibile iniziare un pagamento di prova dal sito.

## Intestazioni Cloudflare

Il file _headers nel pacchetto v19 imposta policy per tipo contenuti, referrer, fotocamera/microfono/geolocalizzazione e Content Security Policy. Sono consentiti il sito stesso, il progetto Supabase già configurato per immagini/catalogo e il Worker esistente. Non vengono introdotti servizi di tracciamento o risorse grafiche esterne nuove. HTML, CSS e JavaScript richiedono rivalidazione della cache.

Se in futuro si aggiungeranno altri servizi, immagini da altri domini, script di terze parti o pagine incorporate, queste policy dovranno essere aggiornate consapevolmente.

## Verifiche eseguite

- Tutte e dieci le versioni aperte nel browser a larghezza 390 e 1440 px; controllati collegamenti interni, struttura e assenza di overflow.
- Versione v19 verificata a 320, 390, 768, 1024 e 1440 px.
- Ricerca prodotti, ordinamento, nessun risultato/ripristino e scheda completa.
- Borsa: aggiunta dalla scheda, quantità, subtotali, limiti scorte, rimozione, stato vuoto, contatori e apertura mobile.
- Ricerca FAQ e ripristino, connessione assente, rivalidazione scorte, errore e riprova del catalogo, checkout disabilitato.
- Codice di pagamento confrontato con la versione precedente: invariato.
- Il sito finale è stato eseguito anche con le intestazioni CSP del pacchetto: nessuna violazione rilevata nelle operazioni verificate.
- Sintassi JavaScript e integrità di tutti gli ZIP controllate; index.html è al primo livello.

Servizi remoti e risposta del logo sono stati simulati nelle prove locali. Non sono stati modificati dati Supabase remoti, eseguiti pagamenti Stripe o pubblicati deployment Cloudflare. Le verifiche non equivalgono a una certificazione di accessibilità o a un collaudo commerciale completo. I test reali end-to-end restano rimandati, come richiesto dall’utente.
