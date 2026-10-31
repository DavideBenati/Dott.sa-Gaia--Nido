# MetiMaia v11.2 — materiale originale di Gaia

Il pannello precedente richiedeva almeno un collegamento esterno per qualsiasi articolo. Era un vincolo troppo generale per materiale originale dell’autrice o dell’autore.

Questa versione aggiunge in Studio una dichiarazione esplicita di origine del contenuto. Quando viene selezionata, un articolo originale può essere approvato senza fonti esterne. Le fonti eventualmente presenti rimangono approfondimenti e devono avere un nome e un collegamento HTTPS valido. L’attribuzione compare anche nella lettura pubblica.

La dichiarazione di originalità è distinta dalla conferma della revisione professionale. Non vengono approvate letture, dichiarati originali i vecchi esempi o cambiati permessi degli account automaticamente.

## 1. Aggiornare Supabase

1. Scarica ed estrai **MAIA-Configurazione-v11.2.zip**.
2. Apri il file **202610300016_original_editorial_content.sql** con un editor di testo e copia tutto.
3. Apri **Supabase → progetto metimaia → SQL Editor → nuova query**.
4. Incolla il testo e premi **Run**.
5. Attendi **Success**. L’aggiornamento sostituisce la regola di validazione; non importa, cancella o pubblica articoli.

Non ripetere il recupero delle 14 letture se lo hai già eseguito. Non servono nuove chiavi, Edge Functions o modifiche Resend.

## 2. Aggiornare il sito su Cloudflare

1. Scarica **MAIA-Sito-v11.2-Materiale-Originale.zip**.
2. Apri **Cloudflare → Workers & Pages → lively-tooth-64c2 → Deployments → New deployment**.
3. Carica lo ZIP del sito. Se viene richiesta una cartella, estrailo e caricane il contenuto: `index.html` deve essere direttamente al primo livello.
4. Premi **Deploy** e attendi **Ready**.
5. Apri il sito in una finestra privata e accedi con l’account professionale.

Il sito e Supabase devono essere aggiornati entrambi: la vecchia interfaccia continuerebbe a chiedere un link, mentre il vecchio database rifiuterebbe l’articolo senza fonti.

Lo ZIP del sito include tutte le funzioni precedenti e le correzioni agli spazi della v11.1. Il file SQL di configurazione va eseguito in Supabase e non va caricato tra i file pubblici del sito.

## 3. Pubblicare il materiale originale

1. Apri **Studio → Apri articoli e checklist → Articoli**.
2. Apri la lettura con **Modifica**.
3. Verifica che autore e testo siano corretti. Il recupero precedente contiene sia materiali derivati dai documenti di Gaia sia esempi editoriali: questa opzione non attribuisce automaticamente a Gaia testi della demo.
4. Scorri alla sezione **Origine del contenuto**.
5. Per il materiale originale seleziona **Materiale originale dell’autrice o dell’autore**.
6. Puoi lasciare vuota la sezione **Fonti e riferimenti**. Se hai aggiunto una riga vuota per provare a superare il vecchio controllo, premi **Rimuovi fonte**: una fonte presente deve comunque essere compilata correttamente.
7. Premi **Salva bozza**. Rileggi l’anteprima e premi **Approva e pubblica** quando la revisione è completata.
8. Attendi lo stato **Pubblicato**. Se una modifica ha revocato l’approvazione precedente, controlla l’anteprima e segui la richiesta di nuova conferma del pannello.
9. Apri **Argomenti** e la lettura: troverai l’attribuzione **Materiale originale di…**, con il nome dell’autrice o dell’autore indicato nell’articolo.

L’opzione resta salvata anche ricaricando Studio. Se la togli e l’articolo non ha riferimenti esterni, il pannello chiederà di indicare l’origine prima di pubblicare nuovamente. Una modifica all’origine revoca l’approvazione precedente, come una modifica al testo.

Le autorizzazioni professionali già previste rimangono necessarie per approvare. Questo aggiornamento risolve il requisito delle fonti esterne; non assegna nuove qualifiche o ruoli.

## Verifica pratica

Usa una lettura originale reale, dopo averla rivista. Seleziona l’opzione, salva la bozza, ricarica la pagina e verifica che la spunta rimanga. Pubblica e apri la lettura da una finestra privata. Le prove automatiche del pacchetto usano servizi simulati e un database locale separato; il caricamento e questa verifica sul progetto reale restano da eseguire nei tuoi pannelli.
