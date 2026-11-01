# metiMaia v13.4 — sei iterazioni per un’app più chiara

Il pacchetto **MAIA-Sito-v13.4-App-Piu-Chiara.zip** contiene il sito completo e aggiornato. Include le funzioni delle versioni precedenti; sostituisce lo ZIP v13.3 per il prossimo caricamento su Cloudflare.

## Le sei iterazioni

1. **Ripartire dall’installazione provata sull’iPhone.** La guida mostra Safari → tre puntini (…) accanto all’indirizzo → Condividi / Share → Aggiungi alla schermata Home / Add to Home Screen → Aggiungi / Add. È indicata anche l’alternativa per Safari con il simbolo Condividi già visibile.
2. **Mostrare dove toccare.** Tre passaggi numerati, un esempio della barra di Safari con i puntini evidenziati e il simbolo Condividi. L’esempio è una guida visiva: il comando da usare è nella barra del browser. Titolo e spazi sono più compatti per arrivare subito alle istruzioni.
3. **Aiutare chi si blocca.** “Non trovi questi comandi?” spiega come aprire Safari o Chrome direttamente da un link ricevuto in un’altra app. Si può copiare l’indirizzo pubblico senza aprire una finestra di condivisione; se la copia automatica è bloccata, resta disponibile l’indirizzo selezionabile. L’invio della guida ad altre persone è secondario e richiudibile.
4. **Alleggerire il sito da telefono.** Le voci del sito sono raccolte in Menu, invece di occupare sempre una seconda barra. La pagina di installazione ha una sola colonna e un footer breve. Da computer il QR è il contenuto principale; i dettagli per il telefono si aprono su richiesta.
5. **Dare all’app una navigazione coerente.** Nell’app aperta dall’icona restano le schede del percorso, senza la barra pubblica del sito e il lungo footer promozionale. I consigli d’acquisto restano raggiungibili dal Profilo. La guida riconosce la modalità app e offre di continuare, senza proporre di installare di nuovo.
6. **Semplificare il primo accesso e controllare il percorso completo.** Un solo logo nella pagina iniziale, accesso all’account esistente in evidenza, creazione account distinta e installazione proposta solo nel browser. Il messaggio chiarisce che sito e app usano la stessa email e password. Controlli su schermi stretti, guida, account, checklist e documenti verificano i percorsi aggiornati.

## Come installare su iPhone

Apri **metimaia.com/installa** direttamente in Safari. Nella barra del browser tocca **…** in basso a destra, poi **Condividi / Share**. Se il simbolo Condividi è già visibile, puoi usarlo direttamente. Scorri le azioni e scegli **Aggiungi alla schermata Home / Add to Home Screen**, poi **Aggiungi / Add**. Se compare **Apri come app web**, lascialo attivo.

Apri l’icona MAIA e accedi con lo stesso account del sito. La prima volta l’app può chiedere di accedere nuovamente. Non serve creare un secondo account.

## Come pubblicare

1. Scarica **MAIA-Sito-v13.4-App-Piu-Chiara.zip**.
2. Apri il progetto del sito su **Cloudflare → Workers & Pages → Deployments → New deployment**.
3. Carica lo ZIP. Se viene richiesta una cartella, estrai lo ZIP e caricane il contenuto: `index.html` deve essere al primo livello.
4. Pubblica e attendi che il deployment sia pronto.
5. Prova `/installa` in Safari sul telefono e dal computer. Nell’app già aperta usa **Aggiorna MAIA** quando compare la nuova versione.

Il QR esistente continua ad aprire **https://metimaia.com/installa**. Non occorrono nuove migrazioni SQL o funzioni Edge. I materiali privati non sono inclusi nel sito pubblico. Il caricamento non modifica automaticamente il modello email di Supabase.

## Limiti delle verifiche

Le prove automatiche usano browser con dimensioni e identificazione iPhone/Android e servizi simulati. Non controllano i menu nativi del telefono. La nuova guida riprende il percorso iPhone completato dall’utente in questa conversazione; dopo la pubblicazione va riprovata sul dispositivo reale. Per dati e documenti serve Internet; le notifiche push non sono attive.

I risultati e i controlli di integrità sono allegati alla release. L’assistente prepara e verifica i file; la pubblicazione su Cloudflare resta il passaggio da effettuare nel pannello.
