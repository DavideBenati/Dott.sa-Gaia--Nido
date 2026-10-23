# metiMaia — pannello professionale v3

## File
- MAIA-Professionista-v3.zip: sito completo da caricare come nuovo deployment del Worker Cloudflare esistente. Non caricare lo ZIP di configurazione come sito.
- MAIA-Configurazione-v3.zip: SQL aggiuntivo, funzione e questa guida. Non contiene password né chiavi segrete.

## Prima: aggiorna Supabase (una volta)
Prerequisiti già presenti: database originale, chat privata 002, newsletter 003 e shop 004. Non rieseguire la creazione del database originale.
1. Supabase > SQL Editor > New query.
2. Apri 202610230005_professional_workspace.sql, copia tutto e premi Run. Attendi Success. Non eseguirlo una seconda volta.
3. Edge Functions > Deploy a new function > Via Editor. Nome esatto: site-actions.
4. Incolla tutto site-actions/index.ts nel file index.ts e pubblica.
5. Settings della funzione: disattiva Verify JWT. È necessario perché il modulo incontri è utilizzabile anche senza account; il server valida i campi e limita le richieste. La funzione non espone elenchi o dati degli utenti.
6. Edge Functions > Secrets: mantieni RESEND_API_KEY già impostata; aggiungi BOOKING_RATE_SALT con un valore casuale lungo almeno 32 caratteri (generalo nel gestore password). Non incollarlo nel sito o nella chat. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono forniti automaticamente dall’ambiente Supabase, non copiarli nel browser.
7. La funzione usa lo stesso segreto Resend di invio e noreply@metimaia.com. La notifica viene inviata al contatto ufficiale ostetricamaia@gmail.com e non contiene i dati della richiesta. Il pannello è la fonte principale: controllalo anche se non arriva una notifica.
8. Non sostituire la funzione newsletter esistente con site-actions: sono due funzioni diverse.

## Permesso chat dedicato per Gaia
L’account editoriale esistente non acquisisce automaticamente il permesso di leggere chat. Usa solo l’account personale confermato di Gaia.
1. Authentication > Users: controlla l’email esatta dell’account di Gaia.
2. SQL Editor: esegui il seguente comando, sostituendo l’email tra apici. Mantieni gli apici.

```sql
insert into private.chat_staff(user_id,active)
select id,true from auth.users
where email = 'EMAIL_ESATTA_ACCOUNT_GAIA' and email_confirmed_at is not null
on conflict(user_id) do update set active=true;
```

3. Verifica che sia stata assegnata una riga all’utente giusto. Nessun altro editor deve ricevere il ruolo chat senza una scelta esplicita.
4. Con il ruolo attivo, /messaggi mostra le conversazioni riservate. Le famiglie continuano a usare /chat. Non è un servizio di urgenza né una presenza continua: non sono mostrati orari o tempi di risposta inventati.

## Carica il sito su Cloudflare
1. Conserva l’ultima versione funzionante per un eventuale ripristino.
2. Cloudflare > Workers & Pages > lively-tooth-64c2 > New deployment.
3. Carica MAIA-Professionista-v3.zip come per la versione precedente. Se il caricatore chiede una cartella, estrai lo ZIP e seleziona la cartella con index.html direttamente al suo interno.
4. Pubblica e apri https://metimaia.com/welcome. Ricarica anche da una finestra privata.
5. Gaia accede da /account, poi apre /studio.
6. In Gaia, servizi e informazioni privacy compila i dati reali e salva. Le modifiche alla presentazione diventano pubbliche; i contenuti sanitari continuano a richiedere approvazione editoriale e verifica professionale.

## Secondo fattore
1. Dal profilo > Sicurezza: configura il fattore con un’app di autenticazione.
2. Copia la chiave iniziale nell’app e custodiscila in un gestore password sicuro. Non condividerla.
3. Verifica il codice corrente.
4. Solo dopo aver custodito la chiave, premi Rendi obbligatorio per il pannello professionale. L’obbligo viene applicato da is_editor/is_chat_staff nel database, non solo dall’interfaccia.
5. Dopo un nuovo accesso, se il pannello risulta negato, apri /sicurezza, verifica il codice e riapri /studio o /messaggi.
6. Perdita del secondo fattore: richiede il recupero verificato del titolare nel progetto Supabase. Il sito non offre un pulsante che aggiri la protezione. Non cancellare indiscriminatamente gli utenti o i ruoli.

## Controlli dopo l’installazione
- Da account normale: /studio e /messaggi non devono mostrare contenuti riservati.
- Gaia: salva una presentazione, controllala da una finestra privata su /gaia.
- Invia una singola richiesta di prova, senza dati sanitari. Deve apparire in /richieste; non è una prenotazione confermata. Gli stati Contattata/Chiusa sono interni e non inviano conferme automatiche.
- Se la notifica email fallisce, la richiesta resta nel pannello. In caso di invio incerto, riprova dalla stessa pagina prima di usare l’email alternativa, per evitare doppioni.
- Verifica la chat con un account di prova distinto, senza inserire dati clinici reali.
- Controlla iscrizione, conferma e disiscrizione newsletter con una tua email di prova. Le campagne rimangono gestite da Resend.
- Esegui un pagamento solo quando prodotti, venditore, spedizione, resi e condizioni sono stati realmente definiti.

## Cosa comprende questa versione
- Pagina Gaia e servizi pubblica, modificabile dal pannello, senza inventare prezzi, qualifiche o disponibilità.
- Pannello con collegamenti a shop, newsletter, conversazioni, richieste, sicurezza e impostazioni.
- Casella professionale separata dal ruolo editor, paginazione, storico, risposte e aggiornamento periodico. Nessuna falsa ricevuta di lettura.
- Richieste d’incontro salvate sul server, con validazione, limiti d’invio, identificativo per i tentativi ripetuti e notifica email priva dei dati del modulo. Alternativa email conservata.
- Secondo fattore con obbligo nel database attivabile dalla professionista.
- Presentazione, servizi, contatti e campi privacy modificabili. Tempi di conservazione e trasferimenti devono essere definiti dal titolare: il sito non certifica conformità legale.
- Traccia privata delle variazioni del consenso alla personalizzazione, senza copiare date o contenuti sanitari nel registro.
- Editor: riordino sezioni, indicazioni per paragrafi/elenchi, avviso di modifiche non salvate alla chiusura/ricaricamento e copia JSON dei contenuti editoriali.
- Navigazione verso Gaia e servizi, pulizia dei testi di demo ormai obsoleti, metadati e noindex delle nuove pagine riservate.
- Le funzionalità precedenti di letture, checklist, account, newsletter e shop sono incluse.

## Limiti e prossimi interventi della review
Questa release non completa ogni voce della review: il JSON editoriale non è un backup completo del database e non dispone di ripristino automatico; non conserva automaticamente bozze dopo la chiusura. L’avviso del browser non intercetta ogni navigazione interna: salva prima di cambiare pagina.
La sincronizzazione bidirezionale delle revoche tra Resend e Supabase non è implementata: prima di campagne riconcilia sempre revoche e soppressioni e usa la disiscrizione del provider. Un CSV precedentemente esportato non è una lista aggiornata.
I metadati social specifici per ogni articolo e una sitemap aggiornata automaticamente a ogni pubblicazione richiedono un Worker dinamico aggiuntivo, non incluso nel semplice upload statico.
Non sono inclusi monitoraggio remoto degli errori, prenotazioni con calendario confermato, inventario/gestione ordini, né nuovi articoli clinici approvati. Non pubblicare contenuti dimostrativi come consigli clinici validati.
Per un backup completo attiva la procedura appropriata al piano Supabase, includi anche Storage e verifica un ripristino in un progetto separato. Non eseguire prove di ripristino sul database di produzione.

## Verifiche di sviluppo
Test automatici locali di ruoli/RLS/MFA, consenso e funzione prenotazioni; compilazione e controlli TypeScript/lint; browser su build statica con Supabase simulato. Nessun account reale, pagamento o invio email è stato eseguito da questi test. L’installazione nel progetto reale richiede i controlli sopra.
