# metiMaia: Area professionista e newsletter

## Cosa contiene il sito

- `/studio`: gestione articoli e checklist, sezioni e fonti, immagini, anteprima, bozze, pubblicazione e archiviazione. Accessibile solo ad account con membership editoriale Supabase. Non richiede Vercel né un pannello separato. Nessun accesso editoriale alle chat delle famiglie.
- `/account`: collegamento Area professionista dopo login dell'editor; consenso newsletter separato e NON preselezionato alla registrazione. Non iscrivere automaticamente chi crea un account.
- `/newsletter`: iscrizione indipendente dall'account, conferma in due passaggi (email + pulsante), revoca con link. Senza backend attivato mostra un errore, senza simulare iscrizioni riuscite.
- L'Area professionista esporta in CSV SOLO iscrizioni confermate. Le campagne vanno composte/inviate da Resend; non è incluso un compositore o un invio massivo nel sito. L'esportazione è una fotografia: aggiornarla prima di ogni campagna, applicare le revoche e le liste di soppressione Resend, includere sempre disiscrizione e mittente. Non utilizzare preferenze sanitarie per segmentare.
- I nuovi link articolo/checklist usano `/article?id=…` e `/checklist?id=…`: funzionano anche con ricaricamento diretto su Workers Static Assets, senza rigenerare lo ZIP dopo ogni pubblicazione.
- Editor a campi/sezioni, non un editor HTML: il testo non viene eseguito come HTML. I dati salvati sono quelli già letti da sito/app.

## 1. Aggiornamento Cloudflare

Caricare il contenuto di `MAIA-Studio-Newsletter.zip` nel Worker esistente con **New deployment**. La radice deve contenere `index.html`, `studio.html`, `newsletter.html`, `assets/` e `_expo/`. Non caricare lo ZIP di configurazione Supabase come sito. DNS e SMTP già esistenti non vanno modificati.

## 2. Abilitare l'account professionista

In Supabase **Authentication → Users**, verificare che l'account di Gaia sia confermato. Copiare il suo UID reale. In **SQL Editor** eseguire:

```sql
insert into private.editor_memberships
  (user_id,professional_name,professional_role,qualification_verified)
values
  ('SOSTITUIRE-CON-UID-REALE'::uuid,'Gaia Brunetti','Ostetrica',false)
on conflict(user_id) do update set active=true;
```

Il valore false abilita bozze. Per pubblicare, registrare la verifica professionale con il riferimento reale all'albo (non un testo inventato):

```sql
update private.editor_memberships
set qualification_verified=true,
    credential_reference='SOSTITUIRE-CON-RIFERIMENTO-REALE-VERIFICATO'
where user_id='SOSTITUIRE-CON-UID-REALE'::uuid;
```

Non incollare i segnaposto senza sostituirli. Verificare identità e iscrizione prima di impostare true. Nessuna autoassegnazione dei ruoli tramite il sito. Nessuna nuova migrazione necessaria per l'editor se il database iniziale è già installato. Il ruolo chat è distinto e non viene modificato.

Aprire `https://metimaia.com/account`, accedere e scegliere **Area professionista**, oppure aprire `/studio`. Se l'account è normale viene negato l'accesso; Supabase applica gli stessi vincoli anche fuori dall'interfaccia.

Per pubblicare un articolo completare titolo, slug, sottotitolo, categoria, autore/ruolo, copertina HTTPS o caricata, sezioni e fonti HTTPS. Il nome autore/revisore deve corrispondere alla membership verificata. Dopo la modifica di un contenuto approvato, il database revoca l'approvazione: salvare la bozza e poi approvare/pubblicare la nuova revisione. Archivia rimuove il contenuto dal feed pubblico; gli URL firmati delle immagini già emessi possono restare validi fino a un'ora.

## 3. Attivare la newsletter in Supabase

Questa parte non può essere attivata dal solo ZIP Cloudflare: chiave Resend e privilegi restano sul server.

1. In **SQL Editor**, eseguire UNA VOLTA il file `newsletter.sql` incluso nello ZIP di configurazione (copia di `202610230003_newsletter.sql`). Non rieseguire le vecchie migrazioni del progetto.
2. In **Edge Functions → Secrets**, aggiungere `RESEND_API_KEY`: una chiave Resend con accesso invio a `metimaia.com`. Non incollarla in chat, nel sito, nel repository o in variabili `EXPO_PUBLIC_*`.
3. In **Edge Functions**, creare una funzione chiamata esattamente `newsletter`, usando l'editor del dashboard. Sostituire il codice di `index.ts` con il file `newsletter-function.ts` incluso nello ZIP di configurazione. Pubblicarla.
4. Nelle impostazioni della funzione disattivare **Verify JWT / Enforce JWT verification**. La funzione deve accettare anche ospiti e collegamenti email. Controlla internamente origini, consenso e token; non espone tabelle o chiavi. La CLI equivalente è `supabase functions deploy newsletter --no-verify-jwt`.
5. Il runtime Supabase fornisce automaticamente `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. NON inserire la chiave privilegiata nel client. `RESEND_API_KEY` è l'unico segreto aggiuntivo da configurare per questo componente.
6. Provare da `https://metimaia.com/newsletter` con un indirizzo proprio. La funzione accetta l'origine di produzione esatta; anteprime Workers e localhost non sono autorizzati.
7. Aprire l'email e premere il link, poi **Confermo l'iscrizione**. Solo questo POST attiva lo stato `confirmed`; scanner email e anteprime GET non cambiano il consenso. Il link di conferma scade dopo 24 ore ed è monouso. Per una nuova richiesta usare la pagina newsletter.
8. Provare la revoca dal link nell'email. Gli account Supabase restano separati. Lo stato `unsubscribed` deve sparire dal successivo export dell'editor.
9. In Resend disattivare il click tracking per le email di autenticazione e conferma; non è necessario per i link e introduce ulteriore tracciamento.

Limiti tecnici: 2 richieste/ora per email, 10/ora per rete e massimo 100 richieste globali per finestra di 24 ore; verificare le quote effettive del piano Resend. Le risposte sono generiche per non rivelare iscrizioni. I token sono casuali a 256 bit e nel database sono salvati solo gli hash; nessun dato sanitario viene copiato nella newsletter. Il controllo rete usa l'header inoltrato dal gateway: prima di aumentare quote o esporre ad alto traffico aggiungere CAPTCHA validato sul server e verificare la catena proxy. Le iscrizioni non confermate vengono eliminate dopo scadenza alla successiva richiesta, non con un job programmato.

## Collaudo e gestione

L'invio effettivo non è stato eseguito dall'assistente: richiede deploy della funzione e segreto nel progetto dell'utente. Verificare anche errore fornitore/limiti, vecchi token, login editor/utente normale, pubblicazione e ritiro con due account distinti. Non dichiarare operativo prima del collaudo del backend reale.

Prima dell'uso pubblico completare nel testo privacy gli accordi con Supabase/Resend, i trasferimenti applicabili e i tempi di conservazione delle prove di consenso/revoca e dei log. Non è fornita una certificazione legale. La cancellazione dell'account non cancella un'iscrizione newsletter indipendente: questa distinzione è indicata nella pagina newsletter e nell'informativa. Le richieste di cancellazione all'indirizzo privacy vanno gestite anche sui fornitori e sulle esportazioni. Non esportare indirizzi pending/unsubscribed e non reinserire destinatari che hanno revocato.
