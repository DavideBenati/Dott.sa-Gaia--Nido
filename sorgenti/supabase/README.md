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
