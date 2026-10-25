# Ninni Meli v3 — infrastruttura pagamenti di prova

Questa versione è esclusivamente SANDBOX. Non è pronta per vendite reali. Non cambiare semplicemente la chiave in sk_live_: il Worker la rifiuta volutamente. Non contiene segreti; inserirli esclusivamente nei campi Secret del Worker.

## 1. Preparare gli ordini in Supabase

Nel progetto ninni-meli, SQL Editor → nuova query. Copiare 001_test_orders.sql ed eseguirlo una sola volta. Richiede public.products, creata in precedenza. Lo script crea shop_orders, shop_order_items e tre funzioni riservate al server. Non modifica né pubblica le schede dei prodotti. Non usare questo SQL nel progetto MetiMaia.

Gli ordini e le relative righe non sono leggibili o modificabili da anon/authenticated. Le funzioni sono eseguibili solo da service_role. Le scorte vengono prenotate con il prezzo letto dal database, in una transazione. La stessa richiesta ripetuta riutilizza l’ordine e non prenota di nuovo le scorte.

## 2. Caricare il codice Worker

Cloudflare → Compute → Workers & Pages → ninni-meli-api → Edit code. Sostituire completamente il codice Hello World con worker.js. Salvare e Deploy. Non caricare worker.js fra i file pubblici del progetto Pages.

Variabili del Worker (Production):

- SITE_URL (Text): https://ninnimeli.com
- SUPABASE_URL (Text): URL del progetto Supabase ninni-meli già configurato
- STRIPE_SECRET_KEY (Secret): chiave sk_test_ della sandbox NinniMeli
- SUPABASE_SECRET_KEY (Secret): chiave sb_secret_ del progetto ninni-meli
- ENABLE_TEST_CHECKOUT (Text): false

Le prime quattro sono già state configurate dall’utente. Non ricopiarne i valori nei file o nella chat. I secrets persistono nelle impostazioni del Worker e non sono inclusi nello ZIP. L’uso della chiave moderna Supabase avviene tramite header apikey, non come JWT Authorization.

Aprire https://ninni-meli-api.ostetricamaia.workers.dev/health. La risposta deve indicare service=ninni-meli-api e version=3. configured controlla soltanto la presenza e il formato delle impostazioni: NON dimostra connessione ai servizi remoti o validità delle credenziali. checkout_enabled deve rimanere false finché non si eseguono i test completi.

## 3. Configurare il webhook nella sandbox Stripe

Rimanere nell’account sandbox NinniMeli. Cercare Webhooks tramite la ricerca Stripe, oppure aprire Workbench → Webhooks/Event destinations secondo l’interfaccia mostrata. Creare una destinazione di tipo webhook per gli eventi del proprio account.

URL completo:
https://ninni-meli-api.ostetricamaia.workers.dev/webhook

Eventi da selezionare:
- checkout.session.completed
- checkout.session.expired

Il checkout accetta solo carta: questa versione non abilita metodi di pagamento asincroni.

Aprire la destinazione appena creata e copiare il Signing secret whsec_… esclusivamente in Cloudflare, ninni-meli-api → Settings → Add variable → Type Secret → Name STRIPE_WEBHOOK_SECRET. Salvare/Deploy. Non usare la chiave sk_test_ come segreto webhook e non condividere whsec_ in chat.

Il Worker verifica firma HMAC sul corpo originale, timestamp entro 5 minuti, modalità sandbox, identificativo della sessione, integrazione, ordine, valuta e importo. Una notifica completed con pagamento non confermato non segna l’ordine come pagato. La pagina di ritorno non conferma l’ordine.

## 4. Aggiornare il sito

Cloudflare → ninni-meli-shop → Create deployment → Production → caricare Ninni-Meli-Sito-v3.zip → Deploy. Il dominio e i record DNS restano invariati. Questa versione usa il Worker ninni-meli-api.ostetricamaia.workers.dev. L’origine consentita per il checkout è esattamente https://ninnimeli.com; i domini Pages di anteprima non sono abilitati ai pagamenti.

Con ENABLE_TEST_CHECKOUT=false la vetrina e la borsa restano dimostrative. Non compare un acquisto reale. I prodotti in bozza restano nascosti.

## 5. Test completi da eseguire quando l’utente sarà pronto

Non attivare il checkout prima che SQL, Worker, webhook e sito v3 siano caricati.

1. Predisporre nel catalogo un prodotto chiaramente descritto come prova, pubblicato, con scorte di prova consapevolmente separate dal magazzino reale. Attenzione: published=true lo rende visibile sul sito pubblico.
2. Cloudflare Worker: ENABLE_TEST_CHECKOUT=true. Questo abilita sul sito pubblico soltanto la sandbox; al termine dei test rimetterlo su false.
3. Aprire ninnimeli.com, aggiungere il prodotto e avviare il pagamento di prova. Stripe deve mostrare SANDBOX/TEST. Utilizzare esclusivamente dati e carte di test ufficiali Stripe e dati anagrafici fittizi; nessun ordine di prova deve essere spedito.
4. Controllare shop_orders in Supabase: pending quando esiste la sessione, paid soltanto dopo webhook firmato di pagamento; lo stock viene sottratto alla prenotazione e non di nuovo al pagamento.
5. Provare rifiuto pagamento, stesso tentativo ripetuto, scorte insufficienti, dati del carrello alterati e webhook duplicato. Verificare le consegne webhook in Stripe e la transizione nel database.
6. Per scadenza, usare la funzione Stripe per far scadere la sessione aperta oppure attendere la scadenza (40 minuti dalla prenotazione). Verificare webhook expired e ripristino scorte una sola volta. Il tasto Indietro o il ritorno dal checkout non liberano subito la prenotazione.
7. Al termine disabilitare ENABLE_TEST_CHECKOUT e ritirare le schede di prova. Conservare gli ordini di prova per verifica, distinguendoli dagli ordini futuri reali.

La spedizione sandbox è simulata senza costi aggiuntivi e non calcola IVA o tariffe reali. Non interpretare le sessioni di prova come preventivi commerciali definitivi.

## Limiti operativi prima delle vendite reali

- In caso di interruzione tra prenotazione e creazione della sessione Stripe, una prenotazione può restare creating senza sessione collegata. Il codice evita di liberare automaticamente scorte quando non conosce l’esito Stripe. Riprovare con lo stesso carrello/ordine; oltre la finestra utile serve riconciliazione manuale verificando prima Stripe. Non ripristinare le scorte alla cieca. Un job di riconciliazione automatica e una procedura amministrativa completa rimangono da implementare.
- I webhook devono poter essere riconsegnati dopo un’interruzione. Senza webhook expired le scorte restano riservate. Un pagamento arrivato dopo una scadenza già registrata passa a needs_review: non evadere automaticamente.
- Gli endpoint pubblici richiedono protezione dall’abuso prima del lancio (limiti di frequenza e verifica anti-bot server). Il solo controllo Origin non impedisce richieste da programmi esterni. Tenere il checkout disattivato fuori dalle prove supervisionate.
- Mancano gestione operativa di rimborsi/resi, notifiche ordine, adempimenti fiscali, tariffe di spedizione definitive e verifiche di sicurezza e concorrenza sul progetto remoto.
- I dettagli personali immessi nella sandbox sono gestiti da Stripe; il database locale dell’app memorizza solo ordine e snapshot degli articoli, senza dati carta o indirizzi.

## Verifiche eseguite dal codice

Test locali PostgreSQL tramite PGlite: prenotazioni, idempotenza, rollback su indisponibilità, prodotti in bozza/esauriti, importi webhook, replay scadenze, pagamento tardivo e rifiuto accessi anonimi alle tabelle ordini e alle funzioni.
Test Worker con servizi simulati: prezzi server, idempotency key, origine, quantità/duplicati, rifiuto chiave live, flag disabilitato, health senza segreti, firma valida/alterata/scaduta, notifica firmata e rifiuto richiesta non firmata.
Test browser con API simulate: abilitazione sandbox controllata dal server, invio soli ID/quantità, riuso ID dopo errore, ritorno pagamento senza falsa conferma e blocco esauriti.

Queste prove non sostituiscono i test su Stripe, Supabase e Cloudflare reali, che l’utente ha scelto di rimandare. Il collegamento live al catalogo in lettura era stato verificato in precedenza dall’utente; le nuove funzioni server non sono ancora distribuite né collaudate sui suoi servizi.
