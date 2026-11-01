# metiMaia v13.3 — dal sito all’app con QR code

Lo ZIP **MAIA-Sito-v13.3-Installazione-QR.zip** contiene il sito completo, il percorso guidato di installazione e tutti gli aggiornamenti precedenti.

## Il percorso per le mamme

**Da computer:** nel menu del sito scegli **App e QR code**. Apri la fotocamera del telefono, inquadra il QR e tocca il collegamento che compare. Sul telefono si aprono le istruzioni per aggiungere MAIA alla schermata Home.

**Dal telefono:** nella pagina iniziale scegli **MAIA sul telefono: installa l’app**. Il collegamento **Installa MAIA sul telefono** è disponibile anche in fondo alle pagine pubbliche; restano gli accessi dalla Home e dal Profilo. Le istruzioni del proprio dispositivo compaiono direttamente, senza dover scansionare lo stesso schermo.

Se necessario puoi scegliere manualmente **iPhone / iPad** oppure **Android**. Il QR è disponibile anche sul telefono con **Mostra il QR per un altro telefono**, utile per aiutare un’altra persona.

## I passaggi sul telefono

- **iPhone/iPad:** apri la pagina in Safari → Condividi → Aggiungi alla schermata Home. Lascia attivo **Apri come app web** quando compare e conferma **Aggiungi**.
- **Android:** apri la pagina in Chrome e usa **Installa MAIA**, quando disponibile; in alternativa menu ⋮ → Installa app / Aggiungi alla schermata Home.
- Apri la nuova icona MAIA. Usa email e password già usate sul sito, oppure crea l’account dall’app al primo accesso. L’app può richiedere un nuovo accesso anche se il browser è già autenticato.

Da WhatsApp o Instagram è indicato di aprire prima la pagina in Safari o Chrome. Il QR apre le istruzioni; l’installazione va confermata sul telefono.

## Dove porta il QR

**https://metimaia.com/installa**

È un collegamento pubblico, senza dati dell’account, token o parametri di tracciamento. Il codice viene generato nel progetto e servito dal sito, senza un servizio esterno per i QR.

Il file **QR-App-MAIA.png** è disponibile separatamente insieme a questa guida. Nella pagina del sito si può usare anche **Scarica il QR code**. Gaia può mostrarlo dal computer o inserirlo in un volantino. Se stampato, lascia visibile il bordo bianco e prova la scansione sul formato scelto.

## Pubblicare l’aggiornamento

1. Scarica **MAIA-Sito-v13.3-Installazione-QR.zip**.
2. Apri **Cloudflare → Workers & Pages → lively-tooth-64c2 → Deployments → New deployment**.
3. Carica lo ZIP. Se viene richiesta una cartella, estrailo e caricane il contenuto: `index.html` deve essere al primo livello.
4. Premi **Deploy** e attendi **Ready**.
5. Apri **https://metimaia.com/installa** da un computer e prova la scansione con un telefono.

Non servono nuove migrazioni SQL, funzioni Edge o chiavi. Il progetto Supabase e gli account rimangono quelli già configurati. I materiali privati di Gaia non sono inclusi nello ZIP e non vengono importati da questo aggiornamento.

Nell’app già installata usa **Aggiorna MAIA** quando compare la nuova versione. Per dati e documenti serve Internet; le notifiche push non sono ancora attive.

## Verifiche

Il PNG generato e il PNG scaricato dal sito sono decodificati con un lettore QR indipendente. È verificata anche la decodifica alla dimensione di 222 pixel usata nella pagina. Le prove browser coprono il menu pubblico, l’accesso da ospite, il QR visibile da computer, i passaggi diretti da telefono e il download del file.

Le prove di sviluppo usano browser e servizi simulati. Restano da provare la scansione con la fotocamera e l’installazione su iPhone e Android reali dopo il caricamento. Non sono stati inviati messaggi reali, modificati dati Supabase o pubblicati deployment Cloudflare dall’assistente. I dettagli sono in **VERIFICA-MAIA-v13.3.json**.
