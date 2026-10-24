# metiMaia — Studio v8

Sito completo cumulativo per Cloudflare, con le pagine e le funzioni della v7 e le correzioni della review di Studio.

## File da usare

- **MAIA-Studio-v8.zip**: il sito da caricare su Cloudflare. Contiene direttamente index.html, le pagine e gli asset.
- **MAIA-Configurazione-Studio-v8.zip**: questa guida e il solo aggiornamento SQL 008 per Supabase. Estrailo sul computer; il file SQL si usa nel SQL Editor.

## Correzioni incluse

- Studio con panoramica per aree, schede su PC e telefono e Nuovo articolo subito raggiungibile. L’editor mostra i comandi pertinenti al contenuto.
- Salva bozza in testa e in fondo al modulo; esito vicino al comando usato, errori sui campi e focus sul primo da correggere. Ricerca, filtri per stato e pagine per articoli e checklist.
- Impostazioni: una lettura fallita mostra un errore e Riprova; il modulo resta chiuso finché i dati attuali non sono disponibili. Durante il salvataggio i campi sono bloccati, così il messaggio di riuscita corrisponde alla versione inviata.
- Protezione delle modifiche non salvate su uscite, collegamenti, tab e annullamento dei moduli web. Le conferme superflue dopo un salvataggio sono state rimosse.
- Documenti: elenco, caricamento e dettaglio separati, apertura immediata degli accessi, ricerca per titolo/nome file, filtri e pagina corrente. Titolo e descrizione modificabili senza cambiare file o destinatari. Archiviazione e modifica rilevano i cambiamenti fatti da un’altra sessione.
- Conversazioni: email riconoscibile soltanto per il ruolo chat autorizzato, ricerca e ordine per attività recente; anteprima breve del messaggio. Conferma prima di scartare una risposta e comando Vai alla risposta. Le informazioni restano protette dal ruolo chat e dal secondo fattore quando richiesto.
- Shop: accesso diretto alla gestione da Studio, Prodotti e Impostazioni separati, ricerca/filtri e protezione delle bozze. La vendita resta subordinata alle impostazioni e ai prodotti effettivamente configurati.
- Richieste: ricerca per nome/email su tutto l’elenco, filtri per stato, paginazione, caricamento distinto dal vuoto e riscontro sulla richiesta aggiornata. Scrivi email apre l’app email; il sito non invia messaggi automaticamente quando cambi stato.
- Newsletter: Sincronizza iscritti e revoche, risultato vicino al comando, CSV nella stessa pagina e Apri Resend come azione distinta. I consensi e le revoche conservano le regole precedenti.
- Sicurezza: QR locale per la prima configurazione, chiave manuale alternativa, riconoscimento di una sessione già verificata e ritorno all’area di provenienza. Il secondo fattore per i documenti rimane richiesto.

Il file Google originale googlee8a922f3d8a9d320.html è incluso. Non viene aggiunto il tag meta di verifica Google. Non vengono inseriti servizi, qualifiche o tariffe non definiti da Gaia.

## 1. Aggiornamento Supabase

Hai già installato la configurazione documenti 007 e abilitato l’account di Gaia: questi passaggi restano validi.

1. Scarica ed estrai MAIA-Configurazione-Studio-v8.zip.
2. Apri Supabase, progetto metimaia, **SQL Editor > New query**.
3. Apri **202610240008_studio_usability.sql** con un editor di testo.
4. Copia tutto il contenuto nella nuova query e premi **Run**.
5. Attendi **Success. No rows returned**. Esegui l’aggiornamento una volta. Se compare un errore, conserva il testo e verifica prima di riprovare.

La migrazione crea tre funzioni protette per elenco conversazioni, modifica dettagli del documento e modifica del suo stato. Non esegue archiviazioni, invii email o cancellazioni di dati all’installazione. Richiede le migrazioni 005 e 007 già presenti; non rieseguire Database Creation o gli aggiornamenti precedenti.

Per controllare che le tre funzioni siano presenti, puoi eseguire una nuova query di sola lettura:

```sql
select
  to_regprocedure('public.professional_conversation_contacts(text,integer,integer)') as contatti_chat,
  to_regprocedure('public.update_document_details(uuid,text,text,timestamp with time zone)') as dettagli_documento,
  to_regprocedure('public.update_document_state(uuid,boolean,timestamp with time zone)') as stato_documento;
```

Tutte e tre le colonne devono mostrare il nome della funzione, non NULL.

Per questa release non servono nuove Edge Functions, chiavi o nuove abilitazioni di Gaia. Conserva document-file, newsletter, newsletter-sync e le altre funzioni già configurate. Il bucket session-documents deve rimanere privato.

## 2. Caricamento su Cloudflare

1. Apri **Cloudflare > Workers & Pages > lively-tooth-64c2**.
2. Premi **New deployment**.
3. Carica **MAIA-Studio-v8.zip**. Se viene richiesta una cartella, estrailo e seleziona la cartella con index.html direttamente al suo interno.
4. Premi **Deploy** e attendi il completamento. Dominio e DNS restano quelli attuali.
5. Riapri https://metimaia.com/studio con l’account di Gaia e aggiorna la pagina. Aggiorna anche eventuali altre schede del sito rimaste aperte.

Se l’aggiornamento 008 manca, la chat mantiene l’elenco protetto con i codici identificativi e mostra il promemoria di configurazione. Modifica dei dettagli e archiviazione documenti della v8 richiedono l’aggiornamento SQL.

## 3. Prova dopo il caricamento

Usa contenuti e account di prova, senza dati dei pazienti.

1. Studio: apri Nuovo articolo, scrivi un titolo e prova a uscire. Annullando la conferma, il testo deve restare presente.
2. Salva la bozza: l’esito deve essere visibile. Un campo obbligatorio mancante deve essere indicato nel modulo.
3. Impostazioni: controlla che presentazione, servizi e contatti già salvati siano rimasti quelli effettivi. Il sito non li cambia durante il deploy.
4. Shop: da Studio entra direttamente nella gestione. Prova a scrivere una bozza e annullare l’uscita.
5. Newsletter: verifica i nuovi comandi; la sincronizzazione resta distinta dall’apertura di Resend e dall’invio di campagne.
6. Conversazioni: l’email compare solo con il ruolo chat autorizzato. Un editor ordinario non ottiene accesso alla casella.

La verifica reale del secondo fattore e dei documenti è stata rinviata su tua richiesta. Prima di condividere documenti reali, completa il test della v7: PDF fittizio, assegnazione a un account di prova, isolamento di un secondo account, download, revoca e archiviazione. La nuova interfaccia non sostituisce questo collaudo del progetto Supabase reale.

## Verifiche di sviluppo

94 test automatici passati, inclusi SQL con ruoli/MFA, isolamento dei documenti, revoche, modifiche concorrenti, loader delle impostazioni e proxy di download. Typecheck, lint e build di produzione verificati. Prove browser a 320/390/1440 pixel per Studio e documenti, flussi Shop/richieste, impostazioni con errori di rete e salvataggio in corso, newsletter e chat. Il QR viene verificato con una configurazione fittizia e non tramite un servizio esterno.

Le prove browser intercettano i servizi esterni: non sono test su telefoni fisici o sul Supabase produttivo. Nessun account, dato reale, pagamento o email è stato creato/inviato dall’assistente; il sito non è stato pubblicato automaticamente. Le copie dei documenti già scaricate non possono essere cancellate a distanza.
