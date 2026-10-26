# NinniMeli — cinque iterazioni, dalla v5 alla v9

## Quale file usare

**Per aggiornare il sito caricare soltanto Ninni-Meli-Sito-v9.zip.** Contiene tutti i miglioramenti. I pacchetti v5–v8 conservano i passaggi precedenti per confronto; non devono essere caricati in sequenza.

Cloudflare → Compute → Workers & Pages → ninni-meli-shop → Create deployment → Production → caricare Ninni-Meli-Sito-v9.zip → Deploy. Aggiornare poi ninnimeli.com con Ctrl+F5 o aprire una finestra privata.

Nessuna modifica a database, Worker, DNS o Stripe. Lasciare ENABLE_TEST_CHECKOUT=false. Prodotti non pubblicati restano nascosti; non sono state aggiunte schede di vendita fittizie. Non sono stati effettuati acquisti o pagamenti.

## 1. v5 — Identità e primo impatto

Nuovo messaggio: “Cura per chi nasce. Rispetto per ciò che resta.” Il testo iniziale collega la cura di mamma e neonato alla direzione del progetto: produzione italiana, meno passaggi intermedi e scelte consapevoli. Gerarchia tipografica, palette naturale e collegamenti principali aggiornati. Il logo originale è conservato.

## 2. v6 — Missione, visione e cura

Due sezioni distinte spiegano la missione (semplificare la scelta degli essenziali e accompagnare mamma e neonato) e la visione (costruire una rete di produttori italiani e progettare un uso attento delle risorse). Una sezione dedicata ai bisogni della famiglia evita pressioni di acquisto e distingue la cura quotidiana dalle indicazioni cliniche individuali.

## 3. v7 — Filiera e sostenibilità concreta

Percorso in quattro tappe: conoscere i materiali, cercare produttori italiani, ridurre i passaggi, rendere chiare le informazioni. Tre criteri di sostenibilità: durata e riutilizzo quando adatti, imballaggi essenziali, origine documentata. Sono distinti obiettivi del marchio e informazioni di prodotto ancora da verificare.

## 4. v8 — Schede e trasparenza

Le schede caricate da Supabase includono un approfondimento su materiali, origine e manutenzione, con collegamento alla sezione filiera. I dati specifici rimangono nella descrizione aggiornata del prodotto: questa versione non aggiunge colonne al database né inventa fornitori o certificazioni. FAQ su produzione italiana, composizione, filiera, confezioni, salute, spedizioni e resi.

## 5. v9 — Navigazione e telefono

Scorciatoie mobili per kit, filiera e borsa, con contatore sincronizzato. Pulsanti e controlli quantità più agevoli, menu adattabile, collegamento “Vai al contenuto” per tastiera, chiusura editoriale e collegamenti nel footer. La borsa mantiene totali, limiti di scorta, accessibilità del dialogo e checkout disattivato finché non abilitato esplicitamente dal server.

## Provenienza delle affermazioni

L’utente ha definito la direzione del marchio: sostenibilità, produzione italiana con filiera minima e cura di mamma e neonato. Non sono stati forniti documenti che attestino l’origine o le caratteristiche ambientali dei singoli componenti. Per questo il sito presenta tali elementi come missione, obiettivi e criteri di selezione. Non dichiara produzione interamente italiana già verificata, certificazioni, zero emissioni, assenza di impatto o benefici clinici dimostrati.

Quando saranno disponibili produttori e documenti, la descrizione pubblica di ogni prodotto dovrà indicare le caratteristiche effettive. Per dati strutturati su origine/lavorazioni/materiali servirà un successivo aggiornamento concordato del catalogo; questa consegna non modifica lo schema.

## Logo e risorse

Il logo originale resta ospitato su Supabase all’URL pubblico già fornito dall’utente, NinniMeli_Logo.jpeg. Non cancellare o rinominare il file nel bucket product-images. Non è stato ridisegnato. Font locali e relative licenze sono inclusi negli ZIP.

## Verifiche eseguite

- Tutte e cinque le versioni controllate in browser alle larghezze 390 e 1440 px.
- Versione finale verificata a 320, 390, 768, 1024 e 1440 px, senza scorrimento orizzontale.
- Collegamenti interni, due riferimenti al logo, approfondimenti delle schede, catalogo vuoto, indisponibilità, errore e riprova.
- Totali, limiti scorta, aggiunta/rimozione, contatori sincronizzati, apertura borsa da scorciatoia mobile, chiusura Escape e checkout disattivato.
- Verificati integrità dei cinque ZIP e presenza di index.html al primo livello.
- Il codice del flusso di pagamento non è stato modificato. Nessun segreto server è incluso nei pacchetti.

Le verifiche locali usano risposte simulate per Supabase, Worker e immagine del logo. Non sono stati eseguiti nuovi pagamenti, modifiche al database remoto, test Stripe reali o deployment su Cloudflare. L’utente pubblica lo ZIP dal proprio pannello. Le schermate di revisione locale con immagine simulata non sono distribuite come anteprime del logo reale.
