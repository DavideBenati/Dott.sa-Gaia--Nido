# Shop metiMaia: selezione Amazon e prodotti della dottoressa

## Incluso nell'aggiornamento

- `/shop`, accessibile dal Profilo, dal footer del sito e dall'Area professionista.
- Due sezioni distinte: **Selezionati su Amazon** e **I prodotti della dottoressa**.
- Gaia può creare/modificare schede, salvarle in bozza, pubblicarle o ritirarle passando di nuovo in bozza. Il ruolo editoriale è quello dell'Area professionista, non viene concesso da un indirizzo email nel codice.
- Selezione Amazon e vendita diretta si attivano separatamente. Per impostazione iniziale entrambe sono disattivate: nessun prodotto/prezzo o rapporto commerciale è stato inventato. Le illustrazioni sono esempi, non offerte acquistabili.
- Conserva Area professionista e newsletter dell'aggiornamento precedente.

## Aggiornamento

1. In Cloudflare, Worker esistente → **New deployment**, caricare `MAIA-Shop.zip`.
2. In Supabase → **SQL Editor**, eseguire una volta `shop.sql` incluso nello ZIP di configurazione. Non rieseguire le migrazioni precedenti.
3. Accedere con l'account di Gaia già autorizzato → **Area professionista → Gestisci shop e merchandise** → **Gestisci prodotti e vendite**.
4. Se il ruolo non è ancora attivo, applicare `abilita-editor.sql` dell'aggiornamento precedente sostituendo il segnaposto con l'UID reale. Il ruolo per preparare bozze editoriali è sufficiente per il catalogo shop: non è richiesto inventare una revisione clinica per una scheda commerciale.

## Prodotti selezionati su Amazon

1. Creare **Nuovo prodotto → Selezionato su Amazon**.
2. Inserire nome, descrizione originale e link HTTPS del prodotto su `amazon.it`, `www.amazon.it`, `amzn.eu` o `amzn.to`.
3. L'immagine è facoltativa. Usare proprie immagini o materiali autorizzati; non copiare automaticamente immagini, prezzi, stelle o recensioni Amazon. Non è integrata la Product Advertising API.
4. Non inserire un prezzo locale: prezzo, disponibilità, venditore, consegna e resi vengono verificati su Amazon. Il sito non gestisce questi ordini.
5. Se si aderisce ad Amazon Affiliati, usare i link del proprio account e selezionare **Link affiliati Amazon**. La pagina mostra la dichiarazione delle commissioni. Il sito non crea un account Affiliati, non aggiunge un tag e non garantisce guadagni. Per link abbreviati verificare che siano realmente del programma autorizzato e diretti al prodotto giusto.
6. Pubblicare la scheda, attivare **Mostra selezione Amazon** e salvare le impostazioni. Questa attivazione non richiede di aprire la vendita diretta della dottoressa.
7. I link affiliati devono essere riconoscibili anche secondo le regole applicabili del programma e di trasparenza pubblicitaria. Non usare la selezione sanitaria come targeting pubblicitario.

## Prodotti della dottoressa, per esempio oli o oggetti per i bimbi

1. Definire i prodotti reali: descrizione, foto, formato/taglie, prezzo, disponibilità, destinazione d'uso e istruzioni del produttore. Non inventare certificazioni, proprietà terapeutiche o idoneità ai neonati. Gli obblighi specifici dipendono dal tipo di prodotto, per esempio cosmetici, giocattoli o altri articoli.
2. Aprire un account Stripe e completare l'identificazione del venditore. Creare il prodotto e un **Payment Link** in euro. Configurare nel checkout quantità, eventuali varianti, indirizzo di spedizione, costi/paesi di consegna e trattamento fiscale applicabile. Nessuna chiave Stripe va inserita nel sito.
3. Creare la scheda **Prodotto della dottoressa**. Inserire immagine HTTPS, prezzo in euro (es. `19,90`) e il link `https://buy.stripe.com/...`.
4. Il prezzo mostrato deve corrispondere a quello effettivo del checkout; il sito non interroga Stripe per verificarlo. Per prodotti con varianti/prezzi differenti usare una scheda/link coerenti. Prima del lancio verificare costi finali, varianti e modalità di test.
5. Compilare nome/ragione sociale, indirizzo, contatto, dati fiscali, spedizioni, resi/recesso e link HTTPS a condizioni di vendita reali. Non è obbligatorio avere una società per ogni modello di attività, ma la posizione fiscale e gli adempimenti devono essere definiti con il consulente competente prima dell'avvio.
6. Pubblicare le schede e selezionare **Attiva gli acquisti**. Il database rifiuta l'attivazione senza i dati minimi del venditore. La compilazione non certifica l'adempimento di tutti gli obblighi.
7. I pagamenti si aprono su Stripe con conferma dell'utente. I dati della carta non vengono raccolti da metiMaia. Non sono inclusi carrello multi-prodotto, gestione ordini/inventario, webhooks, rimborsi dal sito, fatturazione automatica o spedizione/stampa su richiesta. Gestire ordini e assistenza dal fornitore e dal venditore, non presumere un ordine pagato dalla sola visita di una pagina.

## Dati e controlli

Tabelle nuove `shop_settings` e `shop_products`, con RLS. Gli utenti normali non modificano il catalogo. Le bozze e le schede delle sezioni non attivate non sono leggibili pubblicamente. Gli editor hanno accesso alle bozze; nessun nuovo accesso alle chat o ai dati sanitari. La newsletter non viene attivata dagli acquisti. Prima di vendere completare condizioni di vendita, recesso/garanzie applicabili, informazioni sui fornitori e privacy dei pagamenti/ordini. Non è fornita una certificazione legale.

Non sono stati creati account commerciali, link affiliati o prodotti reali né eseguiti pagamenti dall'assistente. Sono richiesti la migrazione sul Supabase reale e i dati definitivi del catalogo. Non viene automatizzata una valutazione dell'idoneità clinica dei prodotti.
