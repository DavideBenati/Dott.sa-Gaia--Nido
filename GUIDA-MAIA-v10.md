# MetiMaia v10 — aggiornamento dopo i test

Il pacchetto del sito è completo: include la versione precedente e le modifiche nuove. Per attivare condivisioni e scheda gravidanza, aggiorna prima Supabase e poi Cloudflare. Non sono stati modificati online il database o il sito da questa sessione.

## Prima Supabase: tre file, nell’ordine indicato

Estrai **MAIA-Configurazione-v10.zip**. Apri Supabase → progetto **metimaia** → **SQL Editor**.

1. Apri `202610250012_family_sharing.sql`, copia tutto, incolla in una nuova query e premi **Run**. Attendi **Success**.
2. In una nuova query esegui nello stesso modo `202610250013_pregnancy_profile.sql`.
3. In una nuova query esegui `202610250014_borsa_parto.sql`.

Esegui ogni file una sola volta. I file presuppongono gli aggiornamenti precedenti fino a **011**, che hai già completato. Se compare un errore, conserva il messaggio e fermati su quel passaggio.

- **012** crea inviti e autorizzazioni familiari separati dai dati personali.
- **013** crea la scheda riservata della gravidanza e i relativi consensi.
- **014** carica **Borsa parto**, con 18 attività tratte dal documento, adattate in istruzioni pratiche. Non modifica le altre checklist e mantiene i progressi esistenti. Il materiale è fornito per MetiMaia e non viene presentato come una nuova revisione clinica certificata. Le voci su oli, idrolati, accessori ed esami sono accompagnate da indicazioni per verificarne necessità e uso con l’ostetrica e la struttura.

Non servono nuove chiavi, Edge Functions o modifiche al DNS. Le autorizzazioni professionali dedicate e il secondo fattore già predisposti per Gaia restano necessari per leggere le informazioni sanitarie condivise. Il solo ruolo editoriale non consente tale accesso.

## Poi Cloudflare: carica il sito

1. Scarica **MAIA-Sito-v10-Completo.zip**.
2. Cloudflare → **Workers & Pages** → **lively-tooth-64c2** → **Deployments** → **New deployment**.
3. Carica lo ZIP, come per l’aggiornamento precedente. Se il pannello chiede una cartella, estrailo e caricane il contenuto: `index.html` deve trovarsi direttamente al primo livello.
4. Premi **Deploy** e attendi **Ready**.
5. Apri `https://metimaia.com/` in una finestra privata, per controllare il primo accesso.

Non caricare su Cloudflare lo ZIP di configurazione Supabase. Il file originale di verifica Google rimane nel sito; non viene aggiunto il tag meta escluso in precedenza. Sono mantenuti il contatto pubblico solo via email, il nome senza cognome, i documenti riservati e le videochiamate.

## Cosa vedrà una persona nuova

La pagina iniziale è **Da dove iniziamo?**, con queste scelte:

- **Aspetto un bambino**
- **Sono un familiare o amico**
- **Dopo la nascita**
- **Mi informo**

L’iscrizione è il pulsante principale. Si può comunque leggere come ospite. Dopo l’accesso, o dopo la conferma della registrazione, si apre il **Progetto**. La conferma email continua a essere necessaria se prevista dalla configurazione Supabase.

Nel Progetto i testi sono suddivisi in un’introduzione breve, strumenti pratici, tappe familiari e approfondimenti espandibili. Il contenuto completo del documento resta consultabile. Le voci attive della navigazione sono evidenziate in grassetto. La pagina **Scopri** ora si chiama **Argomenti**; il vecchio indirizzo `/discover` continua a funzionare.

## Checklist, badge e condivisioni semplici

1. Apri **Checklist**: il preambolo spiega come usarle per organizzare decisioni e attività, adattandole alle tue esigenze.
2. Seleziona il titolo di una checklist, per esempio **Borsa parto**.
3. Spunta ogni attività. Le modifiche si salvano nell’account; come ospite rimangono sul dispositivo. Se una voce non ti serve, puoi segnarla dopo aver deciso consapevolmente di escluderla.
4. Al completamento di tutte le voci compare un piccolo badge. Lo ritrovi anche in **Profilo → I miei traguardi**. Se riapri un’attività il badge non risulta più completato.
5. **Condividi lo stato della checklist** prepara il riepilogo con attività mancanti e collegamento. A completamento puoi condividere il traguardo.

Il pulsante apre la condivisione del dispositivo; se non disponibile, copia il testo oppure mostra il testo da copiare manualmente. Non invia messaggi da solo. Il riepilogo condiviso è una fotografia: non si aggiorna da solo e il collegamento apre la checklist pubblica, non l’account della persona. Nessun nickname, email, datazione o dato della scheda gravidanza viene aggiunto al messaggio.

Gli **articoli** e gli **Argomenti** hanno pulsanti analoghi. Condividendo un Argomento si mantengono anche i filtri scelti. Nei **Consigli d’acquisto** la ricerca è visibile anche se la selezione è ancora vuota.

## Collegare familiari e amici per vedere gli aggiornamenti

Conoscere un nickname non consente di entrare nei dati altrui. Per evitare collegamenti sbagliati, soprattutto in presenza di nickname uguali, servono anche un codice privato e l’approvazione dell’interessato.

### Persona che desidera condividere

1. Accedi e assicurati di aver scelto il nickname dal **Profilo**.
2. Apri **Profilo → Condivisioni con familiari e amici**.
3. Premi **Crea nuovo codice privato**.
4. Comunica privatamente alla persona scelta il tuo nickname esatto e il codice. Il codice scade dopo 7 giorni.

### Familiare o amico

1. Crea e conferma il proprio account. Scegli **Sono un familiare o amico**.
2. Dal percorso o dal Profilo apri **Condivisioni con familiari e amici**.
3. Inserisci nickname e codice ricevuti, poi invia la richiesta.
4. Comunica alla persona interessata il **codice richiesta completo** mostrato nella pagina, per permetterle di riconoscere la richiesta anche con nickname uguali.
5. Attendi l’approvazione: prima non si vedono i contenuti condivisi.

### Approvare e leggere

La persona che condivide torna in **Condivisioni → Richieste da approvare**, verifica il codice richiesta con il familiare/amico e approva. Il familiare aggiorna la propria pagina e apre il collegamento approvato.

Si vedono soltanto:

- attività completate e mancanti delle checklist pubblicate;
- titoli e collegamenti agli articoli pubblicati salvati nei preferiti.

Il familiare non può modificare le spunte. Per vedere gli ultimi progressi deve aggiornare la pagina condivisa. Non vede email, ultima mestruazione, epoca gestazionale, precedenti gravidanze, altre preferenze, chat, documenti o informazioni della scheda riservata.

Entrambe le persone possono rimuovere il collegamento. La revoca impedisce le letture successive dal servizio, ma non cancella informazioni già viste o copiate. Un nuovo codice annulla il precedente e le richieste pendenti; i collegamenti già approvati vanno revocati separatamente se desiderato.

## Scheda facoltativa della gravidanza

Dopo l’accesso, scegli **Aspetto un bambino**. Nel percorso e nel Profilo trovi la **scheda gravidanza**, inizialmente da aprire e compilare.

1. Inserisci la **data dell’ultima mestruazione** nel formato `AAAA-MM-GG`.
2. Il sito propone l’epoca gestazionale in **settimane e giorni**, come stima orientativa.
3. Indica se corrisponde alla datazione ecografica.
4. Se scegli **No**, inserisci manualmente settimane e giorni ecografici **riferiti a oggi**. Viene salvata anche la data di riferimento: nei giorni successivi il calcolo avanza correttamente.
5. Indica se ci sono state precedenti gravidanze e gli esiti pertinenti: parto spontaneo, cesareo, altro oppure preferisci non indicarlo. Puoi selezionare più esiti quando pertinenti; non si tratta di un archivio clinico completo per singola gravidanza.
6. Scegli separatamente se consentire **conservazione**, **condivisione con Gaia** e **personalizzazione delle letture**, poi salva.

I consensi non sono preselezionati. Senza conservazione non si salvano questi dati; l’account e le checklist restano utilizzabili. Gaia legge la scheda soltanto se autorizzata dall’utente, con il permesso professionale dedicato e il secondo fattore. I familiari non ricevono questo accesso.

Puoi ritirare separatamente condivisione o personalizzazione e puoi eliminare i dati attivi della scheda. La nuova datazione non sostituisce la valutazione dell’ostetrica o il referto ecografico. Il limite tecnico del calcolo è 43+0 settimane; non è un criterio per valutare lo stato della gravidanza. Le letture vengono ordinate usando, solo con il consenso, la settimana stimata e gli eventuali temi relativi ai precedenti, quando esistono articoli pertinenti. Non vengono suggerite diagnosi o modalità di parto.

## Una prova pratica dopo l’aggiornamento

Usa due account di test e dati fittizi:

1. Verifica da una finestra privata la pagina iniziale, iscrizione e apertura del Progetto dopo accesso.
2. Completa e riapri una voce della Borsa parto: controlla avanzamento, badge e messaggio condiviso.
3. Salva un articolo e crea un invito familiare. Con il secondo account chiedi il collegamento, verifica che sia vuoto prima dell’approvazione e che mostri solo checklist/preferiti dopo.
4. Compila una scheda gravidanza fittizia e controlla che il familiare non possa leggerla. Revoca poi la condivisione familiare e verifica che una nuova lettura sia negata.
5. Con l’account autorizzato di Gaia, dopo il secondo fattore, prova la scheda riservata in **Studio → Iscritti e percorsi**.

I test del pacchetto usano servizi simulati: questa prova sui tuoi account completa la verifica della configurazione reale.
