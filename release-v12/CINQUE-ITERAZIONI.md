# Le cinque iterazioni di MetiMaia v12

## 1. Navigazione e nomi delle azioni

**Problema:** la cartella documenti era raggiungibile dal profilo, ma poco visibile; il nome Le tue letture poteva essere scambiato per la biblioteca completa.

**Modifica:** cartella documenti all’inizio della pagina personale; pulsante diretto Argomenti; nome Letture salvate per i preferiti. L’esplorazione come ospite apre direttamente gli Argomenti. Il testo di benvenuto senza nickname usa una forma neutra rispetto al tipo di profilo.

**Verifica:** navigazione reale nelle prove browser a 390 e 1280 pixel, controllo dell’intero pulsante documenti sopra la barra inferiore; layout aggiuntivo a 320 pixel. La verifica visiva ha portato ad anticipare ulteriormente la scheda documenti.

## 2. Trovare i propri materiali

**Problema:** la cartella presentava soltanto un elenco paginato, con messaggi poco distinti tra assenza di assegnazioni e ricerca senza risultati.

**Modifica:** ricerca nel titolo e nel nome file, filtri PDF/Word/PowerPoint, ripristino della ricerca e messaggi contestuali. La ricerca viene eseguita mantenendo le restrizioni del destinatario, del documento pronto e attivo. Il risultato viene scartato se nel frattempo cambia account.

**Verifica:** quattro test mirati del caricamento privato e prove browser di ricerca, filtri, ripristino e isolamento di un secondo account.

## 3. Studio più leggibile per Gaia

**Problema:** le numerose attività avevano lo stesso peso nella panoramica e richiedevano molto scorrimento.

**Modifica:** tre attività principali — documenti, contenuti, iscritti — con istruzioni brevi; strumenti secondari in righe compatte e sempre visibili. Impostazioni e copia dei contenuti rimangono separate. Pulsanti dell’editor, bozze, conferme, ruoli e secondo fattore conservano il loro funzionamento.

**Verifica:** apertura degli strumenti dall’area Studio e dei comandi dell’editor nelle prove browser, controllo visivo mobile e desktop, verifiche TypeScript e lint.

## 4. Contenuti affidabili e stati chiari

**Problema:** una copertina privata non caricabile poteva far fallire tutta la biblioteca; le letture potevano apparire mancanti durante il caricamento; un catalogo vuoto suggeriva inutilmente di cambiare filtri.

**Modifica:** copertina di riserva nel pubblico senza cancellare il riferimento originale nell’editor; caricamento, errore e assenza effettiva distinti; ritorno agli Argomenti. Le due checklist scelte, trasporto e casa, sono predisposte per Studio come bozze private con 17 attività complessive.

**Verifica:** sette test del catalogo e del salvataggio delle copertine; sette test SQL delle checklist, inclusi ripetizione, conservazione delle modifiche e dei progressi, ripristino delle autorizzazioni e rollback. Prove browser con caricamento ritardato, errore e contenuto mancante.

## 5. SEO coerente durante la navigazione

**Problema:** i dati strutturati descrivevano soltanto il sito e Gaia, senza rappresentare il tipo della pagina pubblica; durante la navigazione occorre mantenerli coerenti con l’indirizzo corrente.

**Modifica:** entità WebPage, CollectionPage, AboutPage o ContactPage e percorsi BreadcrumbList derivati dalle pagine reali. Un unico script identificato viene aggiornato nella navigazione. Le pagine private non aggiungono entità o indirizzi riservati. Nessun articolo, autore o giudizio viene inventato.

**Verifica:** undici controlli SEO complessivi, corrispondenza tra grafi statici e runtime, esclusione delle pagine private, assenza di duplicati e protezione dell’HTML. Conservati il nome pubblico di Gaia e il file Google originale di 53 byte, senza aggiungere il tag di verifica escluso dal progetto.

I conteggi complessivi della release sono riportati in VERIFICA-MAIA-v12.json. Tutte le verifiche di sviluppo sono separate dalla configurazione e dalla prova sui servizi reali.
