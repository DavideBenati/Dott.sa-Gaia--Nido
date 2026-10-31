# metiMaia v13.1 — quattro miglioramenti mirati

Lo ZIP **MAIA-Sito-v13.1-Quattro-Miglioramenti.zip** contiene il sito completo, l’app installabile e tutti gli aggiornamenti precedenti. Il lavoro è stato limitato a quattro interventi e a una sola nuova release, per mantenere contenuto il consumo di risorse. Non sono attivate notifiche push o modifiche offline ai dati personali.

## I quattro interventi

1. **Connessione chiara mentre l’app è aperta.** La perdita di rete mostra subito un avviso, senza aspettare un salvataggio fallito. Si può leggere ciò che è già aperto; per salvare o aprire altri materiali serve la connessione. Il segnale del browser non certifica che il server sia raggiungibile: gli errori del servizio continuano a essere mostrati.
2. **Checklist più comode.** Il filtro **Da fare** mostra le sole attività non completate; **Tutte le attività** le ripristina senza modificare i progressi. Durante il salvataggio appare un’indicazione e la stessa attività non viene inviata due volte. Caricamento, errore con riprova e checklist realmente non disponibile hanno messaggi distinti; rimane un collegamento per tornare all’elenco.
3. **Installazione condivisibile.** Nella pagina **MAIA sul tuo telefono** si può condividere il collegamento pubblico alle istruzioni. Se il browser non consente la condivisione o la copia automatica, il testo rimane selezionabile per copiarlo manualmente. La condivisione non include dati dell’account.
4. **Aggiornamenti recuperabili.** Un aggiornamento che non risponde entro 20 secondi rende nuovamente disponibile il comando di riprova. Un’attivazione tardiva non ricarica da sola una pagina con modifiche non salvate; rimane necessaria un’azione dell’utente.

## Pubblicare su Cloudflare

1. Scarica **MAIA-Sito-v13.1-Quattro-Miglioramenti.zip**.
2. Apri **Cloudflare → Workers & Pages → lively-tooth-64c2 → Deployments → New deployment**.
3. Carica lo ZIP. Se viene richiesta una cartella, estrailo e caricane il contenuto: `index.html` deve trovarsi al primo livello.
4. Premi **Deploy** e attendi **Ready**.
5. Dal telefono apri **https://metimaia.com/installa**.

Non servono nuove migrazioni SQL, funzioni Edge o chiavi. È necessario conservare la configurazione Supabase già predisposta. L’aggiornamento non importa i materiali CAN nella libreria e non modifica i destinatari dei documenti.

## Installare o aggiornare l’app

- **iPhone:** apri il sito in Safari → Condividi → Aggiungi alla schermata Home; lascia attivo **Apri come app web** quando compare. Apri l’icona e accedi con le credenziali già usate sul sito.
- **Android:** apri il sito in Chrome → menu ⋮ → Installa app / Aggiungi a schermata Home, oppure usa il pulsante proposto nella pagina di installazione.
- **App già installata:** riaprila con connessione. Quando compare la nuova versione, salva eventuali modifiche e premi **Aggiorna MAIA**. Non occorre creare un nuovo account.

Un browser interno a WhatsApp o Instagram può richiedere di aprire prima il sito in Safari o Chrome. La sessione dell’app potrebbe essere separata da quella già aperta nel browser.

## Prova pratica

1. Apri una checklist e passa a **Da fare**: le attività già spuntate devono scomparire dal filtro; **Tutte le attività** deve mostrarle nuovamente.
2. Completa una voce e controlla che il progresso sia ritrovabile con lo stesso account sul sito.
3. Con una pagina già aperta, interrompi la connessione: deve comparire l’avviso. Ripristina la rete e verifica che scompaia.
4. Dalla pagina di installazione usa il collegamento di condivisione. Le informazioni personali non devono comparire nel testo.
5. Apri un documento assegnato al tuo account e verifica che un secondo account non assegnato non lo veda.

Le prove di sviluppo usano browser e servizi simulati; non sono stati inviati messaggi reali, modificati dati Supabase o pubblicati deployment Cloudflare dall’assistente. La prova dell’installazione su iPhone e Android reali rimane da fare dopo il caricamento. Il dettaglio delle verifiche è in **VERIFICA-MAIA-v13.1.json**.
