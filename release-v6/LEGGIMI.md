# metiMaia — correzione scorrimento e focus v6

Pacchetto completo: MAIA-Correzione-v6.zip, da caricare come nuovo deployment del sito Cloudflare esistente.

## Correzione
- Dopo Rivedi la richiesta il riepilogo viene aperto dal suo titolo, con focus sul titolo. Il vecchio scorrimento del modulo non lascia più titolo e invio nascosti sopra la zona visibile.
- Il pulsante d’invio rimane dopo i dati da controllare: sui telefoni piccoli può essere necessario scorrere in avanti per raggiungerlo. Non viene inviato nulla automaticamente.
- Modifica richiesta riporta al titolo del modulo e conserva i valori.
- I cambi di passo della personalizzazione iniziale riposizionano scroll e focus sul nuovo contenuto. Il comando Passo precedente resta nella parte iniziale della fase.
- Digitazione e modifiche nello stesso passo non provocano un riposizionamento automatico.

La versione è cumulativa rispetto a v5 e mantiene il file Google originale googlee8a922f3d8a9d320.html. Non aggiunge il tag meta Google e non richiede nuovi script SQL, funzioni o segreti Supabase.

## Caricamento Cloudflare
1. Scarica MAIA-Correzione-v6.zip.
2. Cloudflare > Workers & Pages > lively-tooth-64c2 > New deployment.
3. Carica lo ZIP, oppure estrailo e scegli la cartella con index.html direttamente al suo interno se viene richiesta una cartella.
4. Premi Deploy e attendi Ready.
5. Apri il dominio in una finestra privata, per evitare di verificare una pagina già aperta con la versione precedente.

## Controllo dopo il caricamento, senza inviare richieste
- Apri /prenota e compila soltanto nome ed email di prova. Premi Rivedi la richiesta: il titolo Controlla la tua richiesta deve essere subito visibile e il focus deve trovarsi lì. Non premere l’invio se stai solo verificando l’interfaccia.
- Scorri in avanti per leggere il riepilogo e raggiungere l’invio. Premi invece Modifica richiesta e verifica che nome/email siano conservati.
- Apri /welcome > Iniziamo insieme, poi Continua e Passo precedente: il nuovo passo deve essere visibile senza aprirsi al footer.
- Mentre scrivi o cambi un’opzione nello stesso passo, verifica che la pagina non torni all’inizio da sola.
- Verifica anche https://metimaia.com/googlee8a922f3d8a9d320.html: il contenuto resta quello richiesto da Google.

## Verifiche di sviluppo
Controlli TypeScript/lint, suite automatica esistente e regressione browser dedicata a 320×568, 390×844, 1024×768 e 1440×900, con servizi simulati. Verificati focus/scroll, avanzamento/ritorno, conservazione dei valori e assenza di reset durante digitazione o cambi di preferenza. Nessun account, invio email, richiesta, messaggio o pagamento reale eseguito dai test.

Questa release corregge il difetto dei cambi di fase individuato nel beta test. La gerarchia iniziale della homepage e le informazioni professionali/catalogo da completare restano interventi distinti; la release non costituisce una prova reale di invio o acquisto.
