# metiMaia — Navigazione e Shop v4

Questa versione comprende la versione v3 precedente. Se hai già configurato Supabase come indicato per v3, non serve eseguire altro SQL, modificare segreti o ripubblicare funzioni.

## Installazione
1. Scarica MAIA-Navigazione-v4.zip.
2. Cloudflare > Workers & Pages > lively-tooth-64c2 > New deployment.
3. Carica lo ZIP, oppure estrailo e seleziona la cartella con index.html direttamente al suo interno se il caricatore richiede una cartella.
4. Premi Deploy. Il dominio e i DNS restano gli stessi.
5. Apri https://metimaia.com/welcome e aggiorna la pagina. Se necessario verifica da una finestra privata.

## Cosa cambia
- Shop è una tab principale visibile a tutti e rimane nella navigazione durante l’esplorazione del catalogo.
- Shop è raggiungibile anche dall’intestazione pubblica, dalla pagina iniziale e dal percorso personale, senza account obbligatorio.
- Studio è una tab per gli amministratori con appartenenza editoriale verificata nel database. Un indirizzo email o i metadati modificabili dell’account non assegnano il ruolo.
- Un amministratore con secondo fattore obbligatorio vede Studio anche prima della verifica, ma i dati e le operazioni riservate continuano a richiedere il codice. Per verificarlo apri Profilo > Sicurezza oppure /sicurezza.
- Gli utenti normali non vedono la tab Studio. Aprire /studio direttamente non aggira i controlli.
- Le tab rimangono presenti in Shop e Studio. Gli indirizzi /shop e /studio sono conservati: non devi modificare link esistenti.
- Intestazione più ordinata sui telefoni: link pubblici su una riga separata dai pulsanti account e aiuto.
- Icone dedicate e tab adattate agli schermi piccoli e all’area inferiore di sicurezza del dispositivo.
- Pannello Studio alleggerito: collegamenti operativi prima della copia dei contenuti, senza ripetizioni del titolo o un Indietro superfluo nella pagina principale.

## Controllo rapido
1. Come ospite, apri Shop dalla pagina iniziale: deve apparire il catalogo o l’anteprima se le vendite sono disattivate, con la barra delle tab in basso.
2. Accedi con Gaia: nella barra deve comparire Studio.
3. Accedi con un account normale: Studio non deve comparire e /studio deve mostrare il messaggio di accesso riservato.
4. Per Gaia con MFA, verifica prima il codice dalla pagina Sicurezza. Il semplice fatto di vedere la tab non abilita l’accesso ai dati.
5. Alterna Shop, Profilo e Studio, poi ricarica direttamente /shop e /studio.

## Prodotti e vendite
La maggiore visibilità non pubblica prodotti inesistenti e non attiva vendite. Gaia gestisce catalogo, link Amazon e impostazioni da Studio > Gestisci shop e merchandise > Gestisci prodotti e vendite. Prodotti, prezzi, disponibilità, dati del venditore e condizioni devono essere reali e completi prima dell’attivazione.

## Verifiche
Build web di produzione, TypeScript, lint, 47 test automatici locali e verifiche nel browser con servizi simulati. Test specifici per ospiti, utenti normali, amministratori, MFA e tab a 320, 390, 768 e 1440 pixel. Nessun invio email reale o pagamento eseguito dai test.

Questa release aggiorna la navigazione e non attiva da sola le funzioni di backend rimaste da configurare nelle versioni precedenti. Restano i limiti v3 documentati su backup, sincronizzazione newsletter e SEO dinamico.
