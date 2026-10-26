# NinniMeli — 20 ottimizzazioni, versioni 20–39

## Il file da pubblicare

**Caricare soltanto Ninni-Meli-Sito-v39.zip.** Include tutti e venti i passaggi. Le versioni precedenti sono archiviate per confronto e non devono essere caricate una dopo l’altra. Ninni-Meli-Sorgenti-v39.zip è destinato allo sviluppo, non al caricamento su Cloudflare.

Cloudflare → Compute → Workers & Pages → ninni-meli-shop → Create deployment → Production → caricare ZIP v39 → Deploy. Aprire ninnimeli.com e aggiornare la pagina. Nessuna modifica richiesta a Worker, Supabase, Stripe o DNS. Mantenere ENABLE_TEST_CHECKOUT=false.

## Le venti iterazioni

| Versione | Ottimizzazione |
| --- | --- |
| 20 | Connessione anticipata a Supabase e precaricamento dei due font principali. |
| 21 | Pagina informativa utilizzabile senza JavaScript; controlli interattivi attivati solo dopo l’installazione dei relativi comportamenti. |
| 22 | Annullamento delle richieste catalogo superate e rifiuto delle risposte obsolete, evitando che una vecchia risposta sovrascriva quella più recente. |
| 23 | Inserimento di schede e righe borsa tramite frammenti DOM, con sostituzione unica dei contenuti. |
| 24 | Riutilizzo dei formattatori di euro e confronto nomi, invece di ricrearli durante ogni operazione. |
| 25 | Indice di ricerca normalizzato per prodotti/FAQ e riutilizzo della vista quando i criteri non cambiano. |
| 26 | Ricerca aggiornata dopo una breve pausa di 120 ms; ripristino e ordinamento restano immediati. |
| 27 | Decodifica asincrona delle immagini e foto nella scheda caricata su richiesta, con fallback quando non disponibile. |
| 28 | Focus su un controllo utilizzabile al raggiungimento del limite quantità; focus iniziale e ritorno dalla scheda/borsa più prevedibili. |
| 29 | Blocco coerente dei comandi che modificano la borsa durante una richiesta di checkout e durante la rivalidazione del catalogo. |
| 30 | Sincronizzazione della borsa tra schede dello stesso browser, con validazione delle quantità e rispetto delle disponibilità correnti. |
| 31 | Stato checkout riportato a disabilitato durante la verifica e in caso di errore; aggiornamento anche al ritorno dalla cache del browser. |
| 32 | Messaggi comprensibili per risposte di pagamento non JSON o incomplete, mantenendo lo stesso identificativo del tentativo. |
| 33 | Le risposte FAQ trovate si aprono; cancellando la ricerca vengono ripristinate le aperture precedenti. |
| 34 | Destinazioni dei collegamenti interni raggiungibili con focus da tastiera e spaziatura di scorrimento coerente. |
| 35 | Annullamento dell’ultima rimozione dalla borsa, entro disponibilità e limiti attuali. |
| 36 | Adattamento di moduli, dialoghi e riepiloghi a schermi stretti; numeri tabulari, fallback viewport e contrasto elevato. |
| 37 | Font locali convertiti da TTF a WOFF2, licenze conservate e CSS ottimizzato. |
| 38 | JavaScript minificato, mantenendo separati i sorgenti leggibili per lo sviluppo. |
| 39 | Risorse con nome basato sul contenuto, cache immutabile per tali file, HTML rivalidato, manifest di integrità e procedura di build verificata. |

## Riduzione misurata dei file

Confronto con il pacchetto v19:

- Somma dei file locali non compressi nello ZIP: **320.746 → 166.982 byte**, riduzione **47,9%**.
- ZIP: **149.574 → circa 115.845 byte**, riduzione circa **22,5%**; la dimensione dello ZIP può variare leggermente per i metadati dell’archivio.
- I tre font: **246.568 → 91.260 byte**. Tabelle caratteri e numero dei glifi confrontati con gli originali.
- CSS prima/dopo l’ottimizzazione, dopo i nuovi interventi: **29.326 → 27.952 byte**.
- JavaScript prima/dopo la minificazione, dopo i nuovi interventi: **26.710 → 19.892 byte**.

Sono misure sui file, non tempi di caricamento. Il confronto include le nuove funzionalità della v39. Logo e fotografie ospitati su Supabase sono esclusi; non sono stati compressi, ridisegnati o modificati. Non è stato eseguito un benchmark della rete o un test Lighthouse sul sito reale.

## Cosa cambia nel pacchetto

index.html resta al primo livello. CSS, JavaScript e font hanno nomi con hash: caricare sempre l’intero pacchetto. Non rinominare i singoli file e non mescolare file provenienti da versioni diverse. Il file _headers mantiene le policy delle risorse previste e aggiunge cache lunga soltanto ai file identificati per contenuto. Le modifiche successive producono nomi nuovi.

Il logo originale continua a essere letto dal bucket pubblico Supabase product-images, NinniMeli_Logo.jpeg. Non cancellarlo o rinominarlo. Origini e caratteristiche ambientali dei prodotti rimangono obiettivi e informazioni da documentare: nessuna nuova dichiarazione di certificazione o produzione già verificata.

## Sorgenti

Ninni-Meli-Sorgenti-v39.zip conserva HTML, JavaScript e CSS leggibili, font e licenze, e gli script di compilazione. Non contiene segreti server. La chiave Supabase publishable presente nel codice è destinata all’uso nel browser.

Strumenti utilizzati: Terser 5.51.2, Lightning CSS 1.33.0, fontTools e Brotli 1.2.1 per la conversione iniziale. I WOFF2 sono inclusi e non devono essere riconvertiti per ricompilare. Consultare source/BUILD.md nell’archivio sorgenti. Una seconda esecuzione della build ha prodotto contenuti e hash identici.

## Verifiche eseguite

- Tutte le 20 versioni aperte nel browser a 390 e 1440 px.
- Versione finale verificata a 320, 390, 768, 1024 e 1440 px, senza overflow nelle situazioni provate.
- Ricerca, ordinamento, filtro vuoto/ripristino, scheda completa, focus, totali, scorte, rimozione e annullamento.
- FAQ con apertura dei risultati e ripristino, sincronizzazione della borsa tra due schede e aggiornamento dopo rivalidazione.
- Checkout disabilitato se health fallisce; comandi bloccati durante la richiesta; risposta non JSON gestita senza mostrare l’errore tecnico; identificativo del tentativo conservato al retry.
- Pagina consultabile con JavaScript disattivato e controlli disabilitati esplicitamente.
- Codice minificato e font WOFF2 provati anche con la CSP del pacchetto finale; nessuna violazione rilevata nelle operazioni eseguite.
- Integrità di tutti gli ZIP, risorse locali referenziate dall’HTML/CSS, glifi dei font e hash del manifest verificati.

Servizi remoti e risposte delle immagini sono simulati nei controlli locali. Nessuna scrittura a Supabase remoto, nessun pagamento Stripe, nessuna modifica del Worker e nessun deployment Cloudflare sono stati eseguiti. I test reali dell’intero ciclo ordine restano da svolgere prima delle vendite. Le prove locali non costituiscono certificazione di accessibilità o garanzia di prestazioni su ogni dispositivo.
