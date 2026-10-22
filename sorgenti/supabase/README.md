# Configurazione Supabase

Applicare `migrations/202610210001_nido.sql` con il runner delle migrazioni Supabase (o `supabase db push` dopo `supabase link`), quindi `seed.sql`. La migrazione richiede gli schemi `auth` e `storage` forniti da Supabase. Per un progetto locale: `supabase start` e `supabase db reset`. Docker e la CLI Supabase sono prerequisiti opzionali per questo percorso, non per la demo.

Creare un account con Supabase Auth, verificare l’indirizzo e-mail e abilitare il professionista dalla console SQL con una query parametrizzata equivalente a:

```sql
insert into private.editor_memberships
  (user_id, professional_name, professional_role, qualification_verified, credential_reference)
values
  ('UUID-REALE-DEL-PROFESSIONISTA', 'NOME REALE', 'Ostetrica', true, 'VERIFICA REALE DELL’ISCRIZIONE');
```

Sostituire tutti i segnaposto dopo una verifica reale dell’identità e dell’abilitazione professionale. Non concedere accesso allo schema `private` ad `anon` o `authenticated`. Il ruolo non viene letto dai metadati modificabili dell’utente. `qualification_verified=false` permette di preparare bozze ma impedisce approvazione e pubblicazione. Il nome del revisore nell’articolo deve corrispondere al nome verificato. La modifica del contenuto di un articolo approvato revoca l’approvazione e riporta un articolo pubblicato in revisione; servirà un secondo salvataggio con nuova revisione prima di ripubblicare.

Usare URL HTTPS del progetto e la chiave pubblica publishable/anon negli esempi `.env`. Non inserire una chiave `service_role` nell’app. Le operazioni del pannello utilizzano la sessione dell’utente, controllano `getUser()` e `is_editor()` sul server e sono ulteriormente limitate da RLS e trigger. L’autenticazione, il caricamento delle immagini e la distribuzione remota richiedono un progetto Supabase effettivamente configurato: la demo locale non dimostra un deploy sicuro.

Il bucket `editorial-images` è privato, accetta JPEG/PNG/WebP fino a 5 MB. L’app salva percorsi `storage://editorial-images/...` e genera URL firmati validi per un’ora solo per immagini accessibili alla sessione. Gli anonimi possono firmare immagini collegate a contenuti pubblicati e approvati. La revoca della pubblicazione non revoca URL firmati già emessi: restano validi fino a un’ora. Non caricare dati sanitari personali o immagini riservate dei pazienti come immagini editoriali.

`delete_my_account()` elimina soltanto l’utente corrente e i suoi record applicativi in cascata. Le revisioni editoriali mantengono il nome professionale necessario all’attribuzione, senza mantenere l’ID Auth cancellato. Prima di una pubblicazione reale servono revisione clinica dei contenuti, verifica legale/privacy indipendente, politiche di conservazione, backup, configurazione e-mail, monitoraggio e prove su un progetto Supabase dedicato. Nessuna conformità legale è dichiarata.

## Account MAIA e chat privata

La registrazione rapida si trova in `/account`; accetta solo email e password. La personalizzazione è successiva e facoltativa. La modalità demo mostra la schermata, ma disabilita la raccolta delle credenziali e l’invio di messaggi. Le preferenze dell’ospite non vengono trasferite automaticamente all’account.

Per attivare il servizio reale:

1. Creare un progetto Supabase e applicare, in ordine, `202610210001_nido.sql`, `202610220002_private_chat.sql` e `seed.sql`. Su un progetto già inizializzato applicare solo le migrazioni mancanti; non rieseguire la prima migrazione su tabelle esistenti.
2. Configurare lo stesso URL e la stessa chiave pubblica nelle app mobile/web (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) e nel pannello (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Ricostruire il sito: GitHub Pages non inietta variabili a runtime. Mai usare `service_role` nel client. La casella della professionista richiede hosting Next.js e non viene eseguita da GitHub Pages.
3. In Supabase Auth impostare Site URL sull’indirizzo effettivo del sito MAIA, abilitare Email/password, conferma email e SMTP di produzione, e configurare i redirect effettivamente utilizzati. Con questo sito il percorso base è `/Dott.sa-Gaia--Nido/`. Dopo la conferma email l’utente può accedere dalla schermata account. Verificare il flusso anche sul dispositivo prima della distribuzione nativa.
4. La Dott.ssa Brunetti crea un account con email verificata. Un amministratore affidabile ne verifica l’identità e abilita SOLO quell’UUID, mediante una query parametrizzata equivalente a `insert into private.chat_staff(user_id) values ('UUID-VERIFICATO')`. Non inserire email o credenziali nello script salvato. I ruoli editoriali non concedono accesso alla chat. `active=false` revoca l’accesso. Non abilitare altri account senza autorizzazione esplicita.
5. La professionista accede alla casella `/messages` sul pannello Next.js. Le utenti scrivono da `/chat` nel sito/app. Le conversazioni sono rilette ogni 15 secondi; non sono disponibili notifiche push, allegati, conferme di lettura o garanzie sui tempi di risposta. Sono mostrati gli ultimi 100 messaggi per conversazione; la casella elenca le conversazioni in pagine da 50. I messaggi non sono editabili dai client. L’esportazione personale include la conversazione; l’eliminazione dell’account elimina i suoi messaggi e la conversazione.
6. Prima del lancio verificare con almeno due account utente e quello della professionista: conferma email, login/logout, isolamento delle sessioni, profilo condiviso fra browser/app, invio e risposta, revoca del ruolo chat, export e cancellazione. I test PostgreSQL locali esercitano le policy, ma non sostituiscono un collaudo Supabase Auth/HTTPS reale. Applicare protezioni antiabuso, configurare i limiti del servizio e concordare la gestione dei messaggi prima di aprire la chat pubblicamente.

La chat non è un servizio di emergenza. Prima di ricevere dati reali occorre aggiornare l’informativa privacy, definire base giuridica e conservazione, verificare gli accordi con il fornitore e concordare con la professionista modalità di utilizzo e accesso. Non attivare la ricezione di dati sanitari sulla sola base della demo. Non è implementata cifratura end-to-end.

## Informativa e contatti privacy

Titolare indicato dall’utente: Gaia Brunetti, Via San Godenzo 33, Roma, Italia. La gestione delle chat è riservata alla Dott.ssa Gaia Brunetti: non abilitare redattori o altri account in `private.chat_staff`. Resta da verificare che i ruoli privacy del titolare e della professionista corrispondano all’organizzazione effettiva.

I dettagli pubblici dell’informativa sono configurabili tramite le variabili `EXPO_PUBLIC_PRIVACY_*` descritte in `docs/privacy-launch.md`. Non inserire credenziali. La pagina rimane segnalata come in completamento finché i dettagli obbligatori di contatto, fornitori, conservazione e trasferimenti non sono disponibili. Questo avviso non impedisce tecnicamente l’attivazione di Supabase: il gestore deve completare gli adempimenti prima di abilitarlo.
