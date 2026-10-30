# Banner pubblicitari su MetiMaia

Al momento il sito non mostra banner pubblicitari e Studio non ha una sezione per gestirli. La modifica agli spazi non attiva pubblicità o servizi esterni.

## Se vuoi consigliare prodotti Amazon: puoi già farlo

1. Accedi con l’account amministratore e apri **Studio**.
2. Apri **Consigli d’acquisto** e scegli **Schede Amazon**.
3. Premi **Nuova scheda Amazon**.
4. Inserisci nome, motivo del consiglio e link Amazon. L’immagine è facoltativa: usa solo immagini tue o autorizzate.
5. Premi **Pubblica scheda**.
6. In **Visibilità e affiliazione**, attiva **Mostra i prodotti Amazon pubblicati** e salva.
7. Se hai un account Amazon Affiliati abilitato, usa i link generati da quell’account e attiva anche l’apposita opzione. Il sito non crea l’affiliazione e non aggiunge il codice al link.
8. Apri la pagina pubblica **Consigli d’acquisto** e verifica la scheda.

Queste sono schede di prodotti, non banner generali. Ordini e pagamenti avvengono su Amazon; MetiMaia non riceve la conferma di un acquisto.

## Per iniziare con i banner: uno sponsor scelto direttamente

La soluzione più semplice per MetiMaia è un banner statico: un’immagine ospitata sul sito, una breve descrizione e un collegamento al sito dello sponsor.

Per prepararlo servono:

- l’immagine, possibilmente in formato WebP o PNG e leggibile anche da telefono;
- il nome dello sponsor e una descrizione breve;
- l’indirizzo HTTPS della pagina da aprire;
- la pagina e il periodo in cui mostrarlo;
- la conferma di poter utilizzare immagine, marchio e testo.

Va indicato chiaramente come **Pubblicità** o **Contenuto sponsorizzato**. Suggerisco un solo spazio nella pagina pubblica **Consigli d’acquisto**, dopo l’introduzione, senza finestre sovrapposte o banner fissi che coprono i pulsanti.

Questa funzione va aggiunta al sito e distribuita con un nuovo ZIP. Non esiste ancora un comando in Studio o in Cloudflare per inserire questi banner. Una gestione da Studio richiederebbe anche una sezione dedicata; non va confusa con il catalogo Amazon, che accetta soltanto collegamenti Amazon.

Un banner statico con immagine ospitata sul sito e normale collegamento, senza script o pixel esterni, permette di iniziare senza introdurre una rete pubblicitaria. Se lo sponsor fornisce codice di tracciamento, occorre invece valutarlo e gestire informativa e consenso prima di attivarlo.

## Se preferisci Google AdSense

AdSense sceglie gli annunci tramite la propria rete. Richiede una configurazione ulteriore:

1. Apri un account su [Google AdSense](https://www.google.com/adsense/start/) e aggiungi **metimaia.com** tra i siti.
2. Segui la procedura proposta da Google per collegare e far esaminare il sito. La pubblicazione degli annunci dipende dall’approvazione di Google.
3. Per visitatori nello Spazio economico europeo, nel Regno Unito e in Svizzera, configura una piattaforma di gestione del consenso (CMP) certificata da Google e aggiorna l’informativa. Gli annunci vanno caricati rispettando le scelte dell’utente; anche quelli “non personalizzati” richiedono attenzione a questi requisiti.
4. Crea un’unità pubblicitaria adattabile e recupera da AdSense il codice con i tuoi identificativi reali. Non inserire identificativi di esempio.
5. Integra il codice nella versione web di MetiMaia, con caricamento subordinato alla configurazione del consenso, e scegli uno spazio nella pagina pubblica. Nel flusso attuale serve una modifica al sito, non basta incollare il codice nel pannello Cloudflare.
6. Se AdSense lo richiede, pubblica alla radice il file **ads.txt** con il contenuto indicato nel tuo account. Conserva il file di verifica Google già presente.
7. Genera e carica un nuovo ZIP su Cloudflare. Verifica da telefono e PC che il banner sia riconoscibile, non sposti il contenuto al caricamento e non copra navigazione o pulsanti.

Per MetiMaia terrei la pubblicità fuori da **Studio, profilo, schede del percorso, documenti, chat e videochiamate**. Non trasmettere alla rete pubblicitaria nickname, email, epoca gestazionale o altre informazioni delle persone; non scegliere annunci in base ai loro dati sulla salute.

Riferimenti ufficiali: [Centro assistenza AdSense](https://support.google.com/adsense/?hl=it) e [requisiti Google per le CMP](https://support.google.com/adsense/answer/13554116?hl=it).

**Consiglio per questa fase:** continua con le schede Amazon già gestibili da Studio. Quando hai uno sponsor concreto, prepara immagine e link e aggiungi un banner statico. AdSense può essere valutato in seguito, insieme al suo impatto su leggibilità, velocità e gestione del consenso.
