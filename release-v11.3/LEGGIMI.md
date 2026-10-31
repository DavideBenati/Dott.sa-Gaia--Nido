# MetiMaia v11.3 — email automatiche per i materiali condivisi

Questa versione comprende tutto il sito precedente, inclusa la gestione del materiale originale di Gaia, e aggiunge le notifiche email quando vengono assegnati documenti a nuovi destinatari.

## Cosa succede quando Gaia condivide un materiale

1. Gaia carica un file da **Studio → Documenti e allegati**, seleziona i destinatari e salva.
2. Il file diventa disponibile ai soli account selezionati e viene preparata un’email individuale per ciascun nuovo destinatario.
3. L’email contiene il **titolo del materiale**, un messaggio accogliente firmato Dott.sa Gaia e il pulsante **Apri i miei documenti**.
4. Il collegamento apre l’area privata. Se serve accedere, dopo il login si torna ai documenti; gli account con profilo incompleto terminano prima il percorso iniziale.

Salvare di nuovo gli stessi destinatari non produce altri avvisi. Cambiare soltanto titolo o descrizione non invia una nuova email. Togliere e poi riassegnare un destinatario costituisce invece una nuova condivisione. Non vengono inviate email retroattive per le assegnazioni già presenti prima dell’aggiornamento.

I file restano nel deposito privato. L’email non allega il documento e non contiene un collegamento pubblico al file. Il titolo viene trasmesso a Resend insieme all’indirizzo destinatario, come richiesto per l’avviso; la descrizione del documento non viene aggiunta. Si tratta di un messaggio di servizio distinto dalla newsletter.

## I due ZIP

- **MAIA-Sito-v11.3-Email-Documenti.zip**: il sito completo da caricare su Cloudflare.
- **MAIA-Configurazione-v11.3.zip**: SQL, nuova funzione Edge, attivazione degli invii programmati e istruzioni per Supabase. Non va caricato come sito pubblico.

La configurazione documenti precedente deve essere già presente. Gaia deve avere il permesso dedicato ai documenti e verificare il secondo fattore, come richiesto dalla sezione Documenti e allegati. Questo aggiornamento non assegna ruoli o qualifiche agli account.

## 1. Aggiornare il database Supabase

1. Estrai **MAIA-Configurazione-v11.3.zip**.
2. Apri **Supabase → progetto metimaia → SQL Editor → nuova query**.
3. Se non hai ancora eseguito la correzione del materiale originale della v11.2, copia ed esegui il file **202610300016_original_editorial_content.sql** incluso. Se lo hai già eseguito, passa al punto successivo.
4. Apri **202610310017_document_share_notifications.sql**, copia tutto, incollalo in una nuova query e premi **Run**.
5. Attendi **Success**. Il file 017 va eseguito una sola volta; non ripetere Database Creation o le migrazioni precedenti.

Il file 017 crea una coda privata per le nuove condivisioni. Non pubblica documenti e non modifica i destinatari già assegnati. Non occorre ripetere il recupero delle 14 letture.

## 2. Pubblicare la nuova funzione email

1. Apri **Edge Functions → Deploy a new function → Via Editor**.
2. Come nome inserisci esattamente **document-notify**: usa il trattino.
3. Nel file principale **index.ts**, sostituisci il codice di esempio con tutto il contenuto di **document-notify/index.ts** del pacchetto.
4. Premi **Deploy**. L’indirizzo della funzione deve terminare con `/functions/v1/document-notify`.
5. Apri **Settings** della funzione e disattiva **Verify JWT** / **Verify JWT with legacy secret**, poi salva. Il codice controlla autonomamente l’account e il permesso documenti per le chiamate del sito; gli invii programmati usano il token riservato del passaggio successivo.
6. Apri **Edge Functions → Secrets** e verifica che esista **RESEND_API_KEY**, già configurata per l’invio da `metimaia.com`. Non occorre crearne una nuova se quella presente è valida.

Non sostituire `document-file`, newsletter o altre funzioni esistenti. Nessuna chiave Resend o Supabase deve essere inserita nel sito o nella chat.

## 3. Attivare gli invii anche a browser chiuso

Segui **CONFIGURA-INVIO-AUTOMATICO.md** incluso nello ZIP:

1. Esegui **ATTIVA-INVIO-AUTOMATICO.sql** nel SQL Editor.
2. Controlla che compaia il lavoro programmato **metimaia-document-notify**, attivo ogni minuto.
3. Con la query indicata nella guida, leggi privatamente il token generato in Vault.
4. Copialo soltanto in **Edge Functions → Secrets**, con nome **DOCUMENT_NOTIFY_JOB_TOKEN**.

Questo collegamento serve per elaborare gli invii rimasti in attesa anche quando Gaia chiude il sito. Il valore del token viene generato nel tuo Supabase: nessun valore segreto è incluso nello ZIP. Se una delle estensioni richieste non è disponibile nel progetto, conserva il messaggio e segui le indicazioni della guida; non considerare il controllo automatico già attivo in caso di errore.

## 4. Aggiornare Cloudflare

1. Scarica **MAIA-Sito-v11.3-Email-Documenti.zip**.
2. Apri **Workers & Pages → lively-tooth-64c2 → Deployments → New deployment**.
3. Carica lo ZIP del sito. Se il pannello richiede una cartella, estrailo e caricane il contenuto: `index.html` deve essere direttamente al primo livello.
4. Premi **Deploy** e attendi **Ready**.
5. Apri il sito in una finestra privata per verificare la nuova versione.

## 5. Prova con account e materiali di test

1. Usa un account destinatario già registrato e confermato, associato a una tua casella email.
2. Accedi come Gaia e completa la verifica a due fattori, se richiesta.
3. Apri **Studio → Documenti e allegati**, carica un piccolo PDF fittizio con titolo **Materiale di prova** e una descrizione di esempio.
4. Seleziona il tuo account destinatario e premi **Salva destinatari**. Il salvataggio degli accessi è distinto dall’invio email: un problema del provider non annulla la condivisione.
5. Nella scheda **Avvisi email** controlla i conteggi. Apri anche la casella email e, se necessario, la posta indesiderata.
6. Nell’email verifica il titolo e premi **Apri i miei documenti**. Da una sessione non autenticata, accedi con il destinatario e verifica il ritorno alla cartella privata.
7. Apri il sito con un secondo account non selezionato: il documento non deve comparire.
8. Revoca il destinatario dal documento: i successivi accessi vengono negati. Gli avvisi ancora in coda vengono annullati; email già inviate o in elaborazione presso Resend e copie già scaricate non possono essere richiamate.

## Come leggere lo stato delle email

- **Accettati dal servizio email**: Resend ha accettato l’invio. Non dimostra che sia arrivato nella posta in arrivo o sia stato letto.
- **In attesa**: gli invii sono da elaborare o in corso. Gli errori temporanei vengono riprovati con attese crescenti; con molti destinatari possono servire più controlli programmati.
- **Da verificare**: per alcuni tentativi non è stato possibile confermare l’esito entro la finestra prevista. Controlla Resend e i log della funzione prima di creare nuove condivisioni.

**Aggiorna stato email** legge la coda aggiornata. **Riprova invio avvisi** elabora i tentativi ancora in attesa, rispettando il tempo minimo tra le riprove. Non reinvia gli avvisi già accettati.

Per evitare duplicati in caso di risposta persa dal provider, ogni tentativo usa un identificativo stabile e conserva titolo e indirizzo del primo invio. Un esito ancora ambiguo dopo circa 23 ore viene fermato per verifica, anziché ritentato oltre la finestra di protezione del provider. La coda non contiene il file o la descrizione.

Il modello del messaggio è riportato in **MODELLO-EMAIL.txt**. I test del pacchetto usano un database locale separato e servizi simulati; nessuna email reale è stata inviata durante lo sviluppo. La pubblicazione e la prova sui tuoi pannelli restano da eseguire.
