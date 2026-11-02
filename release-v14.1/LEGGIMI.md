# metiMaia v14.1 — guida Android corretta

**MAIA-Sito-v14.1-Installazione-Android.zip** contiene il sito completo aggiornato, inclusi i miglioramenti della v14.

## Correzioni

La guida precedente estendeva anche ad Android una frase sul comando “Condividi”, propria del percorso iPhone. Ora l’aiuto distingue le piattaforme e descrive il percorso Android dal menu del browser.

Per Chrome sono indicati **Aggiungi alla schermata Home → Installa**, le varianti **Installa app / Installa metiMaia** e i nomi inglesi. La voce **Crea collegamento** è distinta dalla richiesta di installazione. La guida segnala di usare una scheda normale e spiega cosa fare quando il pulsante automatico non compare.

Samsung Internet ha istruzioni separate, selezionate automaticamente quando riconoscibile e modificabili dall’utente. Per browser o versioni con menu diversi è disponibile il percorso esplicito da Chrome.

L’indirizzo pubblico della guida è visibile e copiabile direttamente. Chi arriva da WhatsApp, Instagram o un’altra app può aprirlo nel browser scelto senza usare il pannello di invio del link.

Il messaggio dopo l’accettazione della richiesta chiarisce di attendere. Il completamento è indicato in seguito all’evento effettivo del browser; questo messaggio non viene più sovrascritto da una risposta tardiva della richiesta.

## Istruzioni da inoltrare a chi usa Android

1. Apri direttamente l’app **Chrome**, in una scheda normale.
2. Scrivi **https://metimaia.com/installa** nella barra dell’indirizzo.
3. Tocca **⋮ → Aggiungi alla schermata Home → Installa**. Alcune versioni mostrano direttamente **Installa app** o **Installa metiMaia**.
4. Conferma **Installa** nel pannello del telefono e attendi. Cerca **MAIA** o **metiMaia** nella schermata Home o nell’elenco delle app.

Se compare solo **Crea collegamento**, il browser sta proponendo un collegamento al sito. Controlla che Chrome sia aggiornato, che la scheda non sia in incognito e che MAIA non sia già presente tra le app. Se compare un errore dopo la conferma, annota il messaggio preciso.

Per Samsung Internet scegli la relativa opzione nella guida: menu **☰ / ⋮ → Aggiungi pagina a → Schermata Home**, oppure la voce/simbolo di installazione disponibile nella versione utilizzata. Conferma il pulsante proposto. Se i comandi non corrispondono, usa il percorso Chrome.

## Pubblicazione

Carica lo ZIP completo nel progetto Cloudflare del sito, tramite un nuovo deployment. Se viene richiesta una cartella, estrai lo ZIP e caricane il contenuto con `index.html` al primo livello. Apri la pagina di installazione nel browser e controlla **v14.1** in fondo alla pagina; nell’app già aperta usa **Aggiorna MAIA** quando compare.

Non occorrono migrazioni SQL o modifiche a Supabase. L’aggiornamento non carica materiali privati, non modifica destinatari e non aggiorna automaticamente il modello email. Il QR pubblico continua a puntare alla pagina di istruzioni.

## Limiti della diagnosi

Il feedback ricevuto non specifica ancora browser, versione e punto del blocco: la causa del singolo fallimento sul telefono non è confermata. Le correzioni risolvono errori e omissioni certi della guida. Le verifiche automatiche controllano l’export locale e il comportamento dell’interfaccia; non sostituiscono una prova reale di installazione sul dispositivo interessato. Il report allegato registra separatamente i controlli Chromium sul manifest e i prompt simulati.
