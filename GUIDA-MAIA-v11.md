# MetiMaia v11 — iscrizione uniforme e traguardi

Questa versione include tutto il sito precedente, comprese le correzioni SEO e la protezione dei dati della gravidanza. Il caricamento sul dominio e l’aggiornamento del database restano da eseguire nei tuoi pannelli.

## Prima Supabase: un solo aggiornamento nuovo

1. Scarica ed estrai **MAIA-Configurazione-v11.zip**.
2. Apri Supabase → progetto **metimaia** → **SQL Editor** → nuova query.
3. Apri `202610300015_member_milestones.sql`, copia tutto il testo, incollalo nella query e premi **Run**.
4. Attendi **Success**. Esegui il file una sola volta.

Questo aggiornamento si aggiunge alla configurazione precedente fino a 014. Non ripetere le migrazioni precedenti già eseguite. Se compare un errore, conserva il messaggio e fermati su quel passaggio.

La nuova tabella è privata e registra soltanto l’identificativo dell’account e se è stata effettuata una prima selezione. Non contiene prodotti, importi, ordini, datazioni della gravidanza o altri dati sanitari. È separata dalle preferenze, così modificare il percorso non cancella il traguardo. La cancellazione dell’account elimina anche questo dato.

Non servono nuove chiavi, Edge Functions, modifiche Resend o DNS.

## Poi Cloudflare: carica lo ZIP completo

1. Scarica **MAIA-Sito-v11-Completo.zip**.
2. Cloudflare → **Workers & Pages** → **lively-tooth-64c2** → **Deployments** → **New deployment**.
3. Carica lo ZIP. Se il pannello chiede una cartella, estrailo e caricane il contenuto: `index.html` deve essere direttamente al primo livello.
4. Premi **Deploy** e attendi **Ready**.
5. Apri `https://metimaia.com/` in una finestra privata per provare il primo ingresso.

Non caricare lo ZIP della configurazione Supabase su Cloudflare. Nome pubblico, logo, contatto solo via email e file originale di verifica Google restano inclusi. La pagina dei traguardi è riservata e non viene proposta a Google.

## Il nuovo percorso di iscrizione

L’ordine ora è uniforme:

1. **Crea il tuo account**: nickname, email e password. La newsletter rimane una scelta separata e facoltativa.
2. **Conferma l’email**, quando richiesto dalla configurazione Supabase, e accedi.
3. **Scegli il tipo di profilo**: Genitore, Partner, Parente, Amico/a oppure Mi informo.
4. **Personalizza ciò che desideri** e completa il percorso iniziale. Le informazioni sanitarie restano facoltative.
5. Si apre il **Progetto**, da cui puoi raggiungere il tuo percorso e gli strumenti del sito.

La scelta del tipo di profilo avviene dopo l’autenticazione, anche entrando direttamente dalla pagina Account o dal collegamento di conferma email. Non viene più importato un percorso da vecchi parametri nell’indirizzo.

- **Genitore** può scegliere Aspetto un bambino o Dopo la nascita e aprire la scheda facoltativa della gravidanza quando pertinente.
- **Partner** sceglie la fase di accompagnamento, senza dover fornire date o dati sanitari dell’altra persona.
- **Parente e Amico/a** accedono a un percorso generale e possono richiedere un collegamento familiare tramite il sistema di codice privato e approvazione già predisposto.
- **Mi informo** permette di esplorare gli argomenti senza indicare una fase personale.

Se interrompi dopo aver confermato il tipo di profilo, le scelte già salvate vengono riprese al successivo accesso. Puoi cambiarle da **Profilo → Modifica tipo di profilo e percorso**.

Gli account esistenti che non hanno ancora indicato esplicitamente un tipo di profilo lo scelgono una volta. L’accesso non azzera date, consensi o preferenze precedenti. Se si seleziona Genitore, il percorso precedente di gravidanza o dopo nascita viene mantenuto. Un profilo già completato non ripete ogni volta l’iscrizione. Il recupero password rimane un flusso separato.

## I badge disponibili

Puoi aprire **I miei traguardi** dal percorso personale oppure da **Profilo → Vedi tutti i miei traguardi**.

- **Benvenuto in MetiMaia**: account creato e primo accesso. È disponibile anche per chi era già iscritto.
- **Il mio spazio è pronto**: tipo di profilo scelto e percorso iniziale completato. Non richiede dati della gravidanza.
- **Una lettura da ritrovare**: presenza di almeno una lettura salvata nei preferiti.
- **Prima selezione**: con l’account attivo, scelta di un prodotto tramite **Vedi su Amazon** nei Consigli d’acquisto.
- **Un badge per ogni checklist completata**: tutte le attività della lista devono risultare spuntate; una checklist vuota non dà un badge.

I badge delle letture e delle checklist seguono lo stato dei salvataggi: togliendo tutti i preferiti o riaprendo un’attività tornano da completare. Le checklist spuntate come ospite possono mostrare il relativo traguardo sul dispositivo, ma non assegnano un badge di iscrizione o di profilo completato.

La **Prima selezione** viene salvata una sola volta nell’account e rimane anche cambiando preferenze o dispositivo. Il clic esprime una selezione: il sito non riceve conferme di acquisto da Amazon e non assegna un badge per acquisti. Aprire un collegamento come ospite continua a funzionare, ma non registra il traguardo su un account. Non vengono memorizzati i prodotti specifici scelti.

Se un salvataggio non riesce, la pagina lo segnala e non dichiara il badge salvato. Puoi riprovare selezionando nuovamente un consiglio dopo aver verificato l’accesso e la connessione.

## Condividere un traguardo

Apri un badge raggiunto e premi **Condividi il badge**. Si aprono le opzioni del dispositivo; se non disponibili, viene proposto il testo da copiare. L’annullamento non viene mostrato come un invio riuscito.

Il messaggio include il nome del traguardo e un collegamento pubblico. Non aggiunge nickname, email, tipo di profilo, date, storia della gravidanza o prodotto selezionato. Un badge non ancora completato non può essere condiviso come raggiunto.

## Prova pratica dopo l’aggiornamento

Con account e dati di test:

1. Apri il sito senza accesso e scegli Crea account. Prima dell’accesso non deve essere richiesta la scelta Genitore/Amico/Parente.
2. Dopo conferma e accesso verifica che si apra la scelta del tipo di profilo prima del Progetto.
3. Scegli un profilo, completa il percorso e controlla i badge Benvenuto e Il mio spazio è pronto.
4. Salva un articolo e completa una checklist: verifica i rispettivi badge e prova la condivisione.
5. Nei Consigli d’acquisto scegli un prodotto pubblicato tramite Vedi su Amazon. Torna ai traguardi: deve comparire Prima selezione. Ricarica la pagina per verificare che resti salvato.
6. Esci e accedi con un altro account di test: non deve ereditare la selezione del precedente.

I test automatici e browser del pacchetto usano servizi simulati; questa prova completa la verifica della configurazione reale.
