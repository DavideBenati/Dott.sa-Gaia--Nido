# metiMaia v13 — l’app installabile dal sito

La v13 permette di aggiungere metiMaia alla schermata Home di iPhone e Android e aprirla in una finestra dedicata. Usa lo stesso progetto Supabase, gli stessi account e gli stessi materiali del sito. Gaia continua a gestire i contenuti e le condivisioni da Studio.

Lo ZIP del sito è completo: comprende tutti gli aggiornamenti della v12 e delle versioni precedenti. Non contiene i materiali privati di Gaia o copie del database.

## Aggiornare Cloudflare

1. Scarica **MAIA-Sito-v13-App-Installabile.zip**.
2. Apri **Cloudflare → Workers & Pages → lively-tooth-64c2 → Deployments → New deployment**.
3. Carica lo ZIP del sito. Se viene richiesta una cartella, estrailo e caricane il contenuto: `index.html` deve trovarsi direttamente al primo livello.
4. Premi **Deploy** e attendi **Ready**.
5. Apri **https://metimaia.com/installa** dal telefono.

Per questo aggiornamento non sono previste nuove migrazioni SQL, funzioni Edge o chiavi. La configurazione Supabase precedente resta necessaria. Se le email dei documenti sono già impostate, non occorre riconfigurarle.

## Installare su iPhone

1. Apri **https://metimaia.com/installa** in **Safari**.
2. Tocca **Condividi**, poi **Aggiungi alla schermata Home**.
3. Se compare l’opzione **Apri come app web**, lasciala attiva.
4. Conferma **Aggiungi** e apri metiMaia dalla nuova icona.
5. Accedi con le stesse credenziali che usi sul sito. L’app potrebbe richiedere un nuovo accesso anche se Safari è già autenticato.

Se il collegamento è aperto dentro WhatsApp, Instagram o un’altra applicazione, aprilo prima in Safari.

## Installare su Android

1. Apri **https://metimaia.com/installa** in **Chrome**.
2. Usa il pulsante di installazione quando proposto oppure il menu **⋮ → Installa app / Aggiungi a schermata Home**. Il nome del comando dipende dal telefono e dalla versione del browser.
3. Conferma l’installazione e apri metiMaia dall’icona.
4. Accedi con le credenziali già usate sul sito.

La disponibilità del pulsante automatico dipende dal browser. Le istruzioni manuali rimangono disponibili.

## Cosa trovano le mamme

L’app installata mette in primo piano **Percorso, Letture, Checklist, Documenti e Profilo**. I consigli d’acquisto restano raggiungibili. Gaia continua a trovare gli strumenti professionali con il proprio account autorizzato.

Un materiale caricato in Studio non deve essere caricato una seconda volta per l’app. È visibile alla paziente soltanto dopo l’assegnazione al suo account, con gli stessi controlli usati sul sito. Il caricamento dell’app su Cloudflare non importa automaticamente i materiali CAN nella libreria privata.

Preferiti, preferenze e progressi delle checklist sono salvati sul server per gli utenti autenticati. Quando si torna nell’app o torna disponibile la connessione, l’app aggiorna i dati. Dal Profilo è disponibile anche **Aggiorna i miei dati**. Le attività di ospiti rimangono sul loro browser/dispositivo e non si trasferiscono automaticamente a un account.

## Connessione e aggiornamenti

Questa prima versione richiede una connessione per leggere contenuti e documenti e salvare modifiche. Se la connessione manca durante l’apertura di una pagina, compare un messaggio di riconnessione. Non viene presentato un salvataggio offline come riuscito.

Il componente di installazione conserva soltanto una pagina generica di riconnessione. Non conserva nel proprio archivio offline risposte Supabase, pagine personali, documenti privati o token di autenticazione.

Quando è pronta una nuova versione dell’app viene proposta un’azione di aggiornamento. La ricarica richiede un’azione dell’utente; le modifiche non salvate continuano a essere protette.

Le notifiche push e i promemoria non sono ancora attivi. Gli avvisi email dei materiali rimangono quelli già configurati.

## Prova dopo la pubblicazione

1. Installa l’app su un iPhone e su un Android e aprila dall’icona: deve comparire in una finestra dedicata.
2. Accedi con un account di prova già esistente; controlla che il profilo sia quello corretto.
3. Completa una voce di una checklist nell’app. Riapri il sito con lo stesso account, torna alla pagina o usa **Aggiorna i miei dati**: il progresso deve coincidere. Ripeti nel verso opposto.
4. Condividi da Studio un PDF fittizio con quell’account. Apri la cartella nell’app e verifica il download. Un secondo account non assegnato non deve trovarlo.
5. Revoca la condivisione: al successivo aggiornamento il documento non deve più essere elencato o scaricabile. Una copia già scaricata non può essere richiamata.
6. Interrompi la connessione e riapri una pagina: deve comparire l’avviso di riconnessione, senza presentare dati privati di un altro account.
7. Dopo un aggiornamento successivo verifica la proposta della nuova versione e la protezione dei moduli non salvati.

Sono passati **297 test automatici** e **46 scenari nel browser** sul pacchetto finale. Le verifiche di sviluppo sono documentate in **VERIFICA-MAIA-v13.json**. Non sostituiscono questa prova sui telefoni reali e sul progetto Supabase effettivo.
