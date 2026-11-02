# metiMaia v14 — versione consolidata

**MAIA-Sito-v14-Consolidata.zip** contiene il sito completo aggiornato e l’app installabile. Sostituisce i precedenti ZIP del sito per il prossimo caricamento su Cloudflare.

## Cosa è stato consolidato

- **Sito e app hanno le stesse cinque schede:** Percorso, Letture, Checklist, Documenti e Profilo. I consigli d’acquisto restano nel menu del sito, nel Profilo e nelle opzioni della Home.
- **Home essenziale e informativa:** mostra il numero di materiali disponibili e l’ultima condivisione di Gaia, con titolo e data. Il riepilogo è limitato alle autorizzazioni dell’account. La data è quella della condivisione, distinta dal caricamento del file. Non viene presentato come un conteggio di materiali “non letti”.
- **Dati aggiornati al ritorno:** passando in background il riepilogo privato viene rimosso; al ritorno è ricaricato. Una risposta precedente non può ripristinare il riepilogo dopo una revoca o un cambio di account. In caso di errore resta disponibile il collegamento ai documenti e un comando per riprovare.
- **Documenti più affidabili:** due tocchi ravvicinati avviano un solo download; restano le verifiche del permesso corrente. File e riepiloghi non vengono memorizzati dal service worker.
- **Checklist vuote comprensibili:** un messaggio esplicito permette di scegliere un’altra lista, senza mostrare un falso completamento.
- **Studio più pratico:** il titolo può essere suggerito dal nome del file e modificato; ricerca e filtri senza risultati offrono “Mostra tutti i documenti”. Il caricamento resta privato fino alla scelta dei destinatari.
- **Revoca totale più chiara:** togliere tutti i destinatari richiede una conferma esplicita; annullando, gli accessi esistenti restano attivi. La revoca blocca i nuovi download, senza richiamare copie già scaricate.
- **Bozze protette:** la richiesta di disponibilità conserva il testo durante revisione, modifica e apertura dell’email. La navigazione accidentale richiede conferma. L’invio avviene nell’app email dell’utente, senza confermare automaticamente un appuntamento.
- **Privacy coerente con il servizio:** rimosse le descrizioni tecniche obsolete di GitHub Pages e hosting Studio separato. Il messaggio di completamento considera le informazioni salvate in Studio e la verifica del titolare, senza inventare dati o approvazioni.
- **Versione riconoscibile:** in fondo alle pagine compare **v14**.

La guida di installazione per Safari e Chrome, il QR pubblico e il modello email di registrazione esistente continuano a usare il percorso `/installa`.

## Pubblicare su Cloudflare

1. Scarica **MAIA-Sito-v14-Consolidata.zip**.
2. Apri il progetto del sito in **Cloudflare → Workers & Pages → Deployments → New deployment**.
3. Carica lo ZIP. Se il pannello richiede una cartella, estrai lo ZIP e caricane il contenuto: `index.html` deve essere al primo livello.
4. Pubblica e attendi che il deployment sia pronto.
5. Apri il sito e cerca **v14** in fondo alla pagina. Nell’app già aperta usa **Aggiorna MAIA** quando compare la nuova versione. Se necessario chiudi e riapri l’app.

Non servono nuove migrazioni SQL, nuove funzioni Edge o nuove chiavi. Il pacchetto non contiene materiali privati di Gaia e non carica automaticamente file o destinatari. Il modello email di Supabase non viene modificato dal caricamento del sito.

## Prova pratica dopo il caricamento

Con account di prova già disponibili, controlla il percorso completo: Gaia condivide un materiale, l’utente riceve l’avviso, accede con il proprio account, vede il riepilogo e apre il documento. Prova anche una checklist e una revoca. La ricezione effettiva dell’email va verificata nella casella del destinatario: l’accettazione da parte del fornitore non prova la consegna.

Per aprire documenti e salvare progressi serve Internet. Le notifiche push non sono attive. L’app è la versione installabile del sito e usa lo stesso account; il primo accesso può richiedere di autenticarsi nuovamente.

## Verifiche e manutenzione

Sono allegati il report con i risultati automatici, le note tecniche sulle dipendenze e la guida alla manutenzione trimestrale. Le prove browser usano dati di esempio e servizi simulati; non inviano email reali e non dimostrano la revisione dei contenuti professionali o dell’informativa.

L’assistente prepara e verifica il pacchetto. Il caricamento su Cloudflare e la prova sul telefono reale sono i passaggi da effettuare nel proprio ambiente.
