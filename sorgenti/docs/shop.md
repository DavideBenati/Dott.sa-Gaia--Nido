# Consigli d’acquisto: la vetrina Amazon

La tab **Consigli d’acquisto** conserva l’indirizzo `/shop`, così i vecchi collegamenti continuano a funzionare. La pagina mostra solo prodotti Amazon: non propone prodotti propri, non apre Stripe e non raccoglie ordini o pagamenti.

## Preparare una scheda da Studio

1. Accedere con l’account amministratore e aprire **Studio → Consigli d’acquisto**.
2. Selezionare **Nuova scheda Amazon**.
3. Inserire **Nome prodotto** e **Perché lo consigli**, usando una descrizione originale e verificata.
4. Inserire **Link Amazon**. Sono ammessi collegamenti HTTPS a `amazon.it`, `www.amazon.it`, `amzn.to` e `amzn.eu`. Per guadagnare commissioni serve un account Amazon Affiliati approvato: copiare il collegamento generato da quell’account. Il sito non crea l’affiliazione e non aggiunge automaticamente un codice affiliato.
5. L’immagine è facoltativa. Usare fotografie proprie o materiali che si è autorizzati a utilizzare. Non sono importati automaticamente immagini, prezzi o recensioni da Amazon.
6. Scegliere **Salva scheda in bozza** per lavorarci ancora, oppure **Pubblica scheda**.
7. In **Visibilità e affiliazione**, attivare **Mostra selezione Amazon** e salvare con **Salva impostazioni consigli**.
8. Se si usa un account Affiliati abilitato, selezionare anche **Link affiliati Amazon**. La pagina mostra la dichiarazione delle commissioni. Ogni scheda informa che il collegamento apre Amazon e può essere affiliato.
9. Per ritirare una scheda, modificarla e salvarla nuovamente in bozza.

Prezzo, disponibilità, venditore, spedizione e resi si verificano su Amazon. Non inserire prezzi locali da aggiornare manualmente. Verificare che ogni collegamento abbreviato porti davvero al prodotto corretto e che descrizioni e affiliazione seguano le regole del programma applicabili.

## Aggiornamento da versioni precedenti

Le tabelle Supabase `shop_products` e `shop_settings` restano compatibili. I vecchi prodotti di tipo `doctor` non sono mostrati né modificabili da questa vetrina. Non vengono cancellati dal database. Il salvataggio delle impostazioni disattiva il vecchio campo di vendita diretta `enabled`; la guida di aggiornamento include la disattivazione anche per l’accesso pubblico del database. La visibilità delle schede Amazon continua a dipendere da `recommendations_enabled` e dallo stato `published`.

Le autorizzazioni editoriali e la protezione delle bozze restano attive. La scelta dei prodotti non usa i percorsi condivisi, le chat o le preferenze sanitarie degli iscritti. Non vengono trasmessi ad Amazon dati prima della scelta di aprire un collegamento. La newsletter rimane una scelta separata.
