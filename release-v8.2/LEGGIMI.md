# metiMaia — Presentazione Dott.sa Gaia, v8.2

Versione completa del sito per Cloudflare, con tutte le funzioni precedenti e la presentazione ricevuta nel file “presentazione gaia.docx”. Il nome pubblico resta **Dott.sa Gaia**, senza cognome.

## Che cosa è stato integrato

- Presentazione e approccio all’accompagnamento, organizzati in paragrafi.
- Percorso presso il San Pietro Fatebenefratelli di Roma e tirocinio nelle strutture indicate nel documento.
- Master di I livello in Chirurgia per la Salute della Donna, master in Oli Essenziali e Formulazioni Cosmetiche indicato come **in fase di completamento**, diploma di istruttrice di ginnastica in gravidanza.
- Ricerca sperimentale sul rapporto fra diffusione di oli essenziali e cortisolo descritta come ricerca in corso.
- Quattro servizi: accompagnamento al parto, ginnastica e movimento in gravidanza, aromaterapia e gestione dello stress, supporto dopo il parto e allattamento.
- Zona di attività Roma; distinzione fra consulenze private richieste dal sito e appuntamenti ospedalieri.
- Numero **392 793 9566**, con pulsanti **Chiama Gaia** e **Apri WhatsApp** nella pagina Gaia e in Contatti. Email ostetricamaia@gmail.com.
- Titolo e descrizione della pagina Gaia aggiornati anche per Google e per la condivisione.

Non sono stati aggiunti prezzi, orari, tempi di risposta o iscrizioni professionali assenti dal documento. I testi sono stati adattati alla lettura sul web; la ricerca e il percorso formativo ancora in corso non vengono presentati come risultati o titoli già conseguiti.

## 1. Caricare il sito su Cloudflare

1. Scarica **MAIA-Sito-v8.2-Presentazione-Gaia.zip**.
2. Apri **Cloudflare > Workers & Pages > lively-tooth-64c2**.
3. Premi **New deployment**, carica lo ZIP e premi **Deploy**.
4. Se viene chiesta una cartella, estrai lo ZIP e seleziona la cartella che contiene direttamente index.html.
5. Riapri https://metimaia.com/gaia e aggiorna la pagina. Aggiorna anche eventuali altre schede del sito rimaste aperte.

Per questo aggiornamento non servono query SQL, migrazioni Supabase, modifiche a chiavi, permessi, dominio o DNS.

La pagina pubblica mostra la nuova presentazione quando il database conserva ancora il profilo iniziale completo. È il caso del profilo pubblico verificato durante questa preparazione. Le presentazioni già personalizzate e le rimozioni intenzionali dei campi vengono rispettate.

## 2. Rendere la presentazione modificabile da Studio

1. Accedi con un account abilitato a Studio.
2. Apri **Studio > Gaia, servizi e privacy**.
3. Premi **Usa la presentazione dal documento**.
4. Controlla presentazione, formazione, zona, quattro servizi ed email. Puoi modificare i testi prima del salvataggio.
5. Premi **Salva modifiche** e attendi il messaggio di riuscita.
6. Premi **Apri pagina pubblica** per controllare il risultato.

L’inserimento nei campi è una bozza finché non premi Salva modifiche. Foto e informazioni privacy già salvate vengono conservate. Se ci sono modifiche non salvate, il sito chiede conferma prima di sostituire i campi della presentazione con quelli del documento.

Se il caricamento delle impostazioni fallisce, il modulo resta bloccato e il comando di inserimento non compare finché non vengono recuperati i dati attuali.

Il numero di telefono fornito nel documento è incluso nel sito; il pannello attuale non ha un campo per modificarlo. Per cambiarlo occorre un successivo aggiornamento dello ZIP. Non viene interpretato automaticamente da testi liberi.

## Contenuti e funzioni conservati

Restano tutte le pagine e le funzioni Studio, Shop, newsletter, account, chat e documenti delle versioni precedenti. Il file Google originale googlee8a922f3d8a9d320.html è conservato; non viene aggiunto il tag meta di verifica Google. Questa release non modifica template email, iscrizioni newsletter o abilitazioni degli account.

## Verifiche completate

97 test automatici passati, inclusi i controlli che impediscono di sostituire profili personalizzati o di perdere foto e privacy durante l’inserimento della presentazione. TypeScript, lint e build di produzione completati.

26 controlli browser con servizi esterni intercettati, a 390 e 1440 pixel: contenuti, quattro servizi, nome pubblico, pulsanti telefono/WhatsApp, assenza di scorrimento orizzontale, rispetto dei profili personalizzati e flusso Studio con errore di lettura, annullamento, salvataggio e anteprima. Sono simulazioni browser, non prove su telefoni fisici. Non sono stati inviati messaggi, creati account o modificati dati reali durante queste prove.
