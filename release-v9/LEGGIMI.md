# MetiMaia — aggiornamento completo v9

Questo aggiornamento comprende il sito precedente e le nuove funzioni. Non contiene password o chiavi segrete. Il sito non è ancora stato aggiornato online: le operazioni seguenti si eseguono nei tuoi pannelli.

## Cosa cambia

- Ogni nuovo iscritto sceglie un nickname durante la registrazione. L’accesso resta con email e password. Chi ha già un account può scegliere o cambiare nickname dal Profilo.
- Studio → Iscritti e percorsi permette di cercare per nickname o email. L’email distingue gli omonimi; le autorizzazioni rimangono collegate all’account.
- Il percorso personale comprende gravidanza, dopo la nascita, partner/familiari e consultazione generale. Per partner e consultazione generale non serve una data di gravidanza o nascita.
- Dal Profilo ogni persona può scegliere se condividere con Gaia una scheda con fase del percorso e argomenti di interesse. La condivisione è inizialmente disattivata e può essere ritirata. Date, letture e messaggi non vengono inclusi nella scheda. Questo consenso non riguarda la newsletter.
- La presentazione personale di Gaia è sostituita dalla filosofia di MetiMaia dell’ultimo documento: significato del nome, fiore di loto, filosofia e tappe familiari. Non vengono pubblicati cognome o telefono. Il contatto pubblico resta via email.
- La scheda Shop diventa **Consigli d’acquisto**, con soli collegamenti Amazon. MetiMaia non vende direttamente, non incassa e non gestisce ordini. I vecchi prodotti propri restano archiviati, ma non sono visibili nella vetrina.
- **Videochiamate con Gaia** contiene inviti riservati ai singoli account, aperti su Hostpoint Meet. Gaia li gestisce da Studio; le clienti li trovano nel Profilo.

## 1. Aggiorna Supabase prima di caricare il sito

Scarica ed estrai **MAIA-Configurazione-v9.zip**. Apri Supabase, progetto **metimaia**, quindi **SQL Editor**.

Esegui questi file **una volta e nell’ordine indicato**, ognuno in una nuova query:

1. Apri `202610250009_member_profiles.sql`, copia tutto il testo, incollalo nel SQL Editor e premi **Run**. Attendi **Success**.
2. Apri una nuova query e fai lo stesso con `202610250010_video_calls.sql`.
3. Apri una nuova query e fai lo stesso con `202610250011_project_presentation_amazon.sql`.

L’ultimo file sostituisce i quattro campi della presentazione con il nuovo documento, conservando email di contatto, foto archiviata e impostazioni privacy personalizzate. Il vecchio testo iniziale sui fornitori, se non è stato personalizzato, viene aggiornato per includere Amazon e Hostpoint al posto delle vendite dirette. Disattiva inoltre le vendite dirette e limita la vetrina pubblica ai prodotti Amazon pubblicati. Non elimina i prodotti archiviati.

Questi aggiornamenti presuppongono gli aggiornamenti precedenti del progetto, fino a 008, già configurati insieme. Non devi ricreare il progetto o le tabelle. Se hai già eseguito uno di questi tre file, non ripeterlo. Se compare un errore, conserva il messaggio e fermati su quel passaggio.

Non servono nuove Edge Functions, chiavi Resend o modifiche al DNS.

### Abilita Gaia a leggere le schede dei percorsi

Questo passaggio è separato dall’abilitazione a Studio, perché le schede possono contenere informazioni personali.

1. Nello stesso SQL Editor apri una nuova query.
2. Copia ed esegui tutto il contenuto di `ABILITA-SCHEDE-GAIA.sql`.
3. Il file riguarda esclusivamente **ostetricamaia@gmail.com**, che deve essere già confermata e abilitata a Studio. Nel risultato devono comparire `schede_abilitate = true` e `codice_sicurezza_richiesto = true`.
4. Per leggere le schede condivise Gaia dovrà verificare il codice a due fattori da **Sicurezza dell’account**. Si può fare in un secondo momento: nel frattempo la rubrica con nickname ed email funziona, ma i percorsi condivisi restano protetti.

Questo passaggio non modifica le autorizzazioni di chat o documenti.

## 2. Carica il sito su Cloudflare

1. Scarica **MAIA-Sito-v9-Completo.zip**. Questo è il pacchetto del sito, distinto dalla configurazione Supabase.
2. Apri Cloudflare → **Workers & Pages** → **lively-tooth-64c2**.
3. Apri **Deployments** e scegli **New deployment**, come negli aggiornamenti precedenti.
4. Carica il nuovo ZIP. Se il pannello richiede una cartella, estrailo e carica il contenuto: `index.html` deve trovarsi direttamente al primo livello.
5. Conferma il caricamento e premi **Deploy**. Attendi lo stato **Ready**.
6. Apri `https://metimaia.com/welcome` in una finestra privata per vedere la nuova versione.

Il dominio e il file di verifica Google restano inclusi. Non è stato aggiunto il tag meta di verifica che avevi escluso.

## 3. Come usare nickname e percorsi

**Per una nuova iscrizione:** inserire nickname, email e password; confermare poi l’email con il flusso già configurato.

**Per un account esistente:** Profilo → Come ti riconosce Gaia → scegliere il nickname → **Salva nickname**.

**Per condividere la scheda con Gaia:** Profilo → La scheda che condivido con Gaia → scegliere fase e interessi → attivare esplicitamente la condivisione → salvare. La scelta del percorso personale, da sola, non attiva la condivisione. Il pulsante di ritiro permette di interromperla.

**Per Gaia:** Studio → **Iscritti e percorsi** → cercare nickname o email → controllare anche l’email prima di aprire la persona desiderata. I dettagli del percorso sono disponibili soltanto con l’abilitazione dedicata e la verifica di sicurezza.

## 4. Come gestire i consigli d’acquisto

1. Per guadagnare commissioni serve un account approvato nel **Programma Affiliazione Amazon**: `https://programma-affiliazione.amazon.it/`. Il sito non crea l’affiliazione e non può approvarla.
2. Dal tuo account Amazon Affiliati genera il collegamento al prodotto scelto, per esempio tramite SiteStripe quando disponibile. Non basta copiare il link ordinario dalla barra del browser per ottenere automaticamente una commissione.
3. Sul sito accedi come Gaia → Studio → **Consigli d’acquisto** → **Nuova scheda Amazon**.
4. Compila nome, motivazione del consiglio e link Amazon. L’immagine è facoltativa: usa solo immagini proprie o autorizzate.
5. Salva in bozza oppure premi **Pubblica scheda**.
6. Nelle impostazioni dei consigli attiva **Mostra selezione Amazon** e, quando il tuo account affiliato è attivo, **Link affiliati Amazon**. Salva le impostazioni.
7. Controlla la pagina come ospite: la scheda deve aprire il prodotto corretto su Amazon. Prezzo, disponibilità, spedizioni e resi sono quelli indicati lì.

Non sono stati inventati prodotti o codici affiliati. La vetrina può quindi essere vuota finché non aggiungi e pubblichi le schede. Le vecchie schede Amazon già pubblicate vengono conservate; quelle dei prodotti propri non compaiono.

## 5. Come organizzare una videochiamata

L’incontro si svolge su **Hostpoint Meet**; il sito gestisce gli inviti, senza incorporare una piattaforma di chiamata o attivare la fotocamera. Per creare la stanza e per partecipare serve una connessione al servizio esterno.

**Per Gaia:**

1. Concorda l’orario con la cliente via email.
2. Accedi al sito → Studio → **Videochiamate** → **Apri Hostpoint Meet**.
3. Sul servizio crea una stanza nuova per ogni incontro, con un nome casuale di almeno 8 caratteri, senza nomi o informazioni delle clienti. Usa le opzioni di protezione disponibili nel servizio.
4. Copia l’indirizzo completo della stanza, nel formato `https://meet.hostpoint.ch/nome-casuale-della-stanza`, senza parametri aggiuntivi.
5. Torna alla pagina del sito, cerca la cliente per nickname o email e seleziona l’account corretto, controllando l’email.
6. Incolla l’indirizzo e premi **Condividi l’invito con questo account**.
7. Avvisa la cliente via email dell’orario e del percorso **Profilo → Le mie videochiamate con Gaia**. Il pannello non invia email automatiche.
8. Al momento dell’incontro apri lo stesso invito dal tuo elenco. Consenti fotocamera e microfono soltanto nella pagina Hostpoint.

**Per la cliente:** accedere al proprio account → Profilo → **Le mie videochiamate con Gaia** → aprire l’invito. Prima di aprirlo il sito verifica nuovamente che sia valido e autorizzato. Su web Hostpoint si apre nella stessa scheda: il tasto Indietro del browser permette di tornare al sito.

Gli inviti scadono dopo 7 giorni. Gaia può revocarli dal pannello. La revoca impedisce nuove aperture dal sito, ma non annulla un link già copiato e non chiude una stanza Hostpoint già aperta: chiudi anche l’incontro nel servizio esterno. Non riutilizzare la stessa stanza per altre clienti. Le chiamate non vengono registrate dal sito.

## Verifiche prima dell’uso effettivo

Il codice è stato controllato con test automatici e prove browser a dimensioni di telefono e PC, usando servizi simulati. Per completare la configurazione reale prova con un account amministratore e un account di test: registrazione e conferma, nickname, condivisione/ritiro della scheda, un link Amazon affiliato e una videochiamata tra due dispositivi. La reale chiamata Hostpoint e l’aggiornamento del tuo database richiedono i passaggi nei tuoi pannelli; non sono stati eseguiti da questa sessione.
