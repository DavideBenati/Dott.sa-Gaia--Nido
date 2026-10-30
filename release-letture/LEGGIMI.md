# MetiMaia — recuperare le letture in Studio

## Perché la pagina Argomenti risulta vuota

Il controllo effettuato nel progetto Supabase mostra **0 articoli totali**. Il problema quindi non riguarda soltanto la loro pubblicazione.

Nel codice sono conservate le **14 letture della versione demo**. La configurazione iniziale di Supabase inserisce invece soltanto le categorie: il collegamento del sito al database non importa automaticamente questi testi. Il nuovo ZIP del sito aggiorna le pagine, mentre i contenuti del servizio vengono letti da Supabase.

Non possiamo dedurre da questo controllo l’intera cronologia del database, ma possiamo recuperare i testi rimasti nel progetto.

## Cosa contiene il recupero

Il file `IMPORTA-LETTURE-IN-BOZZA.sql` aggiunge le letture mancanti come **bozze dimostrative**, visibili in Studio agli amministratori. Conserva testi, fonti presenti e attribuzioni del progetto. Non assegna approvazioni, date di pubblicazione o revisioni cliniche.

Tre letture derivano dai documenti forniti per il progetto:

- **La borsa del parto, senza il superfluo** — adattamento del documento Borsa parto.
- **Messaggio di nascita per amici e parenti** — comprende il messaggio conservato nei sorgenti.
- **Sonno sicuro del neonato** — adattamento conservato nei sorgenti.

Le altre undici sono esempi editoriali della demo, da rivedere prima di un eventuale utilizzo:

- Il primo trimestre, un passo alla volta
- Secondo trimestre: trovare il proprio ritmo
- Verso la nascita, con spazio per l’imprevisto
- Esserci: il partner durante il travaglio
- Le fasi del travaglio: parole per orientarsi
- I primi giorni: conoscersi, con calma
- Il puerperio: dare spazio al recupero
- Le prime poppate: imparare insieme
- Allattamento: chiedere sostegno è un primo passo
- Alimentare il neonato: percorsi diversi
- Dopo la nascita, anche tu hai bisogno di cura

Lo script non sovrascrive articoli già presenti con lo stesso identificativo o indirizzo. Può essere rieseguito senza duplicare le bozze. Non modifica iscritti, consensi, chat, documenti, checklist o permessi degli account.

## 1. Inserire le bozze in Supabase

1. Scarica ed estrai **MAIA-Recupero-Letture.zip**.
2. Apri il file **IMPORTA-LETTURE-IN-BOZZA.sql** con un editor di testo e copia tutto il contenuto.
3. Apri Supabase e scegli il progetto **metimaia**, lo stesso nel quale hai eseguito il controllo degli articoli.
4. Apri **SQL Editor → nuova query**.
5. Incolla il testo completo e premi **Run**. Questo file va eseguito dal SQL Editor amministrativo, non dal sito.
6. Dopo **Success**, controlla il risultato: nel database attualmente vuoto le letture importate saranno 14. Se compare un errore, conserva il messaggio completo.

Non occorre caricare un altro ZIP su Cloudflare per questa importazione. Il file SQL non va caricato tra i file pubblici del sito.

## 2. Ritrovare le letture in Studio

1. Apri `https://metimaia.com/account` e accedi con l’account amministratore.
2. Apri **Studio → Apri articoli e checklist → Articoli**.
3. Seleziona **Tutti** o **Bozze** ed elimina eventuali parole nella ricerca.
4. Ricarica la pagina se Studio era già aperto durante l’importazione.
5. Apri, per esempio, **Modifica La borsa del parto, senza il superfluo**.

Le letture sono ora recuperate e modificabili. **La pagina pubblica Argomenti continuerà a mostrare zero letture finché Gaia non ne pubblicherà almeno una.**

## 3. Rivedere e pubblicare una lettura

1. Leggi il testo completo e modifica ciò che desideri aggiornare. I riferimenti alla demo o a Nido fanno parte dei testi recuperati: adattali alla presentazione definitiva di MetiMaia.
2. Verifica titolo, categoria, percorso, autore e revisore, ruolo professionale, immagine e fonti. Le attribuzioni degli esempi non devono essere scambiate per una revisione già svolta da Gaia.
3. Controlla che le fonti siano pertinenti e i loro collegamenti HTTPS funzionino. Messaggio di nascita e Sonno sicuro non hanno fonti nel materiale recuperato: il pannello richiede di completarle prima della pubblicazione. Non sono state aggiunte fonti inventate per superare questo controllo.
4. Premi **Salva bozza** per registrare gli aggiornamenti. Il contenuto rimane privato.
5. Quando Gaia ha completato la revisione, premi **Approva e pubblica** dal suo account abilitato alla revisione professionale.
6. Attendi il messaggio di salvataggio con stato **Pubblicato**. Se compare invece **Da revisionare**, segui il messaggio del pannello: una modifica può richiedere una nuova conferma dopo aver controllato l’anteprima.
7. Apri `https://metimaia.com/discover` in una finestra privata, premi **Azzera filtri** se necessario e apri la lettura pubblicata.

Il permesso di amministrare Studio e quello di approvare una revisione clinica sono distinti. Se la pubblicazione segnala una mancanza di autorizzazione o un’identità del revisore non corrispondente, conserva il messaggio: questo recupero non cambia né dichiara verificate qualifiche professionali.

## Controllo finale facoltativo

Nel SQL Editor puoi rieseguire:

```sql
select
  count(*) as articoli_totali,
  count(*) filter (where status = 'draft') as bozze,
  count(*) filter (
    where status = 'published' and approved and not is_demo
  ) as visibili_sul_sito
from public.articles;
```

Dopo la sola importazione nel database vuoto: **14 totali, 14 bozze, 0 visibili**. Dopo la pubblicazione di una lettura, il numero dei visibili deve aumentare.
