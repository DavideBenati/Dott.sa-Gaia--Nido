# metiMaia v13.2 — un’iterazione sulla facilità d’uso

Lo ZIP **MAIA-Sito-v13.2-Piu-Semplice.zip** contiene il sito completo e l’app installabile, con tutti gli aggiornamenti precedenti.

## Cosa diventa più semplice

- **Home:** dopo i documenti compare subito una checklist da aprire o riprendere. Le liste già iniziate hanno la precedenza su quelle nuove; le liste senza attività non vengono proposte. Letture salvate e accesso alle checklist sono prima dei consigli d’acquisto, che rimangono disponibili più in basso e nella navigazione.
- **Checklist:** istruzioni brevi, avanzamento, filtro e attività compaiono prima delle opzioni di condivisione. La sezione **Condividi e organizza insieme** si apre quando serve. Sono conservati salvataggio, filtro **Da fare**, traguardi e autorizzazioni familiari.
- **Documenti:** i materiali e il comando di download hanno la precedenza. **Cerca o filtra** apre ricerca e formati; **Chiudi ricerca** li nasconde mantenendo i filtri applicati. L’indicazione di filtro attivo e **Mostra tutti i materiali** permettono di ripristinare l’elenco con un tocco. Il comando **Aggiorna** aggiorna sempre i documenti autorizzati.

I criteri di accesso ai file e il salvataggio sul server non cambiano. L’aggiornamento non carica i materiali CAN in Studio e non assegna destinatari.

## Pubblicare

1. Scarica **MAIA-Sito-v13.2-Piu-Semplice.zip**.
2. Apri **Cloudflare → Workers & Pages → lively-tooth-64c2 → Deployments → New deployment**.
3. Carica lo ZIP. Se viene richiesta una cartella, estrailo e caricane il contenuto: `index.html` deve essere al primo livello.
4. Premi **Deploy** e attendi **Ready**.
5. Apri **https://metimaia.com/installa** dal telefono, oppure riapri l’app già installata e usa **Aggiorna MAIA** quando compare la nuova versione.

Non servono nuove migrazioni SQL, funzioni Edge o chiavi. Rimane necessaria la configurazione Supabase già predisposta. Si usano gli stessi account e dati.

## Installare dal telefono

- **iPhone:** Safari → Condividi → Aggiungi alla schermata Home; lascia attivo **Apri come app web** quando compare.
- **Android:** Chrome → menu ⋮ → Installa app / Aggiungi a schermata Home, oppure il pulsante offerto nella pagina di installazione.

La prima apertura dall’icona può richiedere l’accesso con le credenziali già usate sul sito. L’app richiede Internet per salvare e aprire contenuti e documenti; le notifiche push non sono attive.

## Verifiche

Le prove browser controllano anche che, a 390×900 e 1280×900 pixel, la checklist proposta nella Home, la prima attività e il primo comando di download siano raggiungibili nella prima schermata. Questo non garantisce lo stesso risultato con qualsiasi titolo, descrizione, zoom o dimensione del telefono: dopo la pubblicazione va completata la prova sui dispositivi reali con i materiali di Gaia.

Le prove di sviluppo usano servizi simulati. Non sono stati inviati messaggi reali, modificati dati Supabase o pubblicati deployment Cloudflare dall’assistente. I dettagli sono in **VERIFICA-MAIA-v13.2.json**.
