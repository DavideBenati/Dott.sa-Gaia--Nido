# MetiMaia v10.1 — controllo del nome nei metadati pubblici

Controllo del 26 ottobre 2026. Questa versione mantiene il sito v10 e interviene esclusivamente sul nome nella presentazione pubblica e nei metadati, sui relativi test e sulla conservazione delle informazioni legali. Logo, grafica, navigazione, account e funzioni restano invariati.

## Risultato

Il cognome era ancora presente in quattro attribuzioni della vecchia demo archiviata, nella regola che riconosce e sostituisce il nome completo, in alcuni test, nelle email e nella documentazione interna/legale. Non era presente nei metadati attualmente online delle dieci pagine indicizzabili, comprese `/`, `/gaia` e `/help`.

- Le quattro attribuzioni nella vecchia demo sono state abbreviate a Dott.ssa Gaia.
- Titoli e descrizioni SEO vengono normalizzati anche se provengono da articoli caricati dal database. Lo stesso vale per Open Graph e Twitter.
- La generazione dell’HTML applica la medesima regola ai metadati statici.
- I riferimenti già privi del cognome, come Gaia, Contatta Gaia, Dott.ssa Gaia, Ostetrica Gaia e Dott.sa Gaia, restano identici.
- Il JSON-LD conserva esattamente `name: Dott.sa Gaia`.
- L’eventuale identità legale configurata e le informazioni privacy vengono conservate integralmente. Non sono stati modificati documenti originali, dati nel database o email legali. L’informativa resta `noindex,nofollow`.

La presenza del cognome nelle regole di riconoscimento, nei test e nei documenti interni è intenzionale: rimuoverlo indiscriminatamente impedirebbe la protezione o altererebbe informazioni che non sono metadati indicizzabili.

## File del sito modificati

- `sorgenti/packages/core/src/public-name.ts`
- `sorgenti/apps/mobile/src/seo.tsx`
- `sorgenti/scripts/web-seo.mjs`
- `sorgenti/apps/mobile/src/privacy.ts`
- `sorgenti/apps/mobile/src/professional.ts`
- `demo-web/_expo/static/js/web/__common-cb5c782fae74b50e8dad53f87f2917cc.js` (vecchia demo, quattro sole sostituzioni testuali)

Test aggiornati/aggiunti: `tests/public-name.test.ts`, `tests/web-seo.test.ts`, `tests/profile-editor-load.test.ts`. Aggiornato anche il manifest dei file.

`page-metadata.json` e le pagine `/`, `/gaia`, `/help` non richiedevano modifiche al testo: erano già privi del cognome.

## Verifica

17 test mirati superati; TypeScript, ESLint e build web completati. Controllati 29 file HTML finali, incluse tutte le dieci pagine indicizzabili: title, description, Open Graph, Twitter e JSON-LD sono coerenti e privi del cognome. Il file originale di verifica Google è conservato, senza aggiungere il tag meta precedentemente escluso.

## Applicazione

Carica `MAIA-Sito-v10.1-SEO.zip` nel progetto Cloudflare `lively-tooth-64c2`, tramite Deployments → New deployment → Deploy, come per gli aggiornamenti precedenti. Se il pannello chiede una cartella, estrai lo ZIP: `index.html` deve essere al primo livello.

Non servono nuove modifiche Supabase rispetto alla v10. Il codice non è stato distribuito automaticamente sul tuo dominio.

I risultati già presenti nell’indice Google possono riflettere scansioni precedenti: dopo la pubblicazione puoi richiedere una nuova indicizzazione di `/welcome` (canonico della homepage), `/gaia` e `/help` da Search Console. Modificare il codice non cancella immediatamente le copie già conservate da Google.
