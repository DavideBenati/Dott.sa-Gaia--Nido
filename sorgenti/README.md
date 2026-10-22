# Nido — Insieme, passo dopo passo.

MVP in italiano: app Expo/React Native, dashboard Next.js e integrazione Supabase. In assenza di URL e chiave pubblica parte in **DEMO MODE**. Gli articoli sono esempi non revisionati clinicamente; le checklist sono suggerimenti adattabili, non requisiti medici.

## Avvio locale

### Demo web senza installazioni

La versione statica dell'app dei genitori viene pubblicata nel ramo `nido-web` su [Nido](https://davidebenati.github.io/GAIA_NIDO/). Per attivarla su GitHub Pages, aprire [Settings → Pages](https://github.com/DavideBenati/GAIA_NIDO/settings/pages), scegliere **Deploy from a branch**, ramo **nido-web**, cartella **/(root)** e premere **Save**. GitHub mostrerà il collegamento al sito quando il deployment è terminato. La consultazione dal browser non richiede Node.js o installazioni sul dispositivo.

Questa pubblicazione riguarda la demo dell'app dei genitori. Il pannello Next.js rimane un'applicazione separata. La demo conserva preferenze e progressi nel browser e mostra contenuti dimostrativi non ancora approvati clinicamente.

Per rigenerare il sito dal codice, nell'ambiente di sviluppo:

```sh
NIDO_WEB_BASE_PATH=/GAIA_NIDO EXPO_OFFLINE=1 npm run build:web
```

L'output è in `apps/mobile/dist-web`, con `.nojekyll` e `404.html` per supportare navigazione e ricaricamento delle schermate su GitHub Pages. Se il repository viene rinominato, aggiornare `NIDO_WEB_BASE_PATH` al nuovo nome e rigenerare il sito prima di pubblicarlo.

Node.js 24 e npm 11. Dopo aver estratto l'archivio:

```sh
cd Nido
npm ci
npm run web
```

In un secondo terminale, dalla stessa cartella: `npm run admin`. Expo usa la porta 8081; il pannello usa la porta 3000. `npm run mobile` avvia Expo per lo sviluppo iOS/Android con un client compatibile con SDK 58. L'interfaccia cloud di onboarding non fornisce un'anteprima web navigabile.

Nell'ambiente cloud:

```sh
cd /workspace/Coursera_Capstone
XDG_CACHE_HOME=/workspace/.cache EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 npm run web
```

L'assenza di configurazione abilita la demo. Una configurazione parziale o un backend non raggiungibile generano un errore esplicito. La dashboard demo salva nel proprio browser: la pubblicazione simulata non sincronizza contenuti con l'app mobile.

## Struttura e comandi

- `apps/mobile`: onboarding facoltativo, quattro tab, letture, filtri, preferiti, checklist, profilo, consenso, esportazione e cancellazione.
- `apps/admin`: dashboard, editor, anteprima, stati editoriali, categorie e checklist; API protette da autorizzazione verificata sul server.
- `packages/core`: tipi, 14 articoli demo, 6 checklist, filtri, calcoli approssimativi e regole editoriali.
- `packages/data`, `supabase`: persistenza reale, migrazione PostgreSQL, RLS e storage privato.

```sh
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build:mobile
npm run build:admin
```

Playwright usa Chromium: installarlo con `npx playwright install chromium` se non disponibile. Nell'ambiente cloud utilizza `/usr/bin/chromium`. È possibile impostare `CHROMIUM_PATH`. Le esportazioni Expo comprendono bundle iOS/Android/web; non equivalgono a binari firmati o prove su dispositivi fisici.

## Supabase e produzione

Leggere `supabase/README.md`; usare gli esempi `.env.example` delle due app e soltanto URL e chiave pubblica publishable/anon. **Mai una chiave service_role nel client.** Applicare le migrazioni al proprio progetto e assegnare i permessi editoriali mediante un amministratore affidabile, verificando realmente le qualifiche della professionista. Ogni contenuto di produzione deve ricevere approvazione clinica. Le bozze rimangono private e le modifiche invalidano la revisione precedente.

Per produzione rimangono necessari un progetto Supabase configurato e collaudato, contatti e identità professionali reali, revisione clinica e legale indipendente, configurazione SMTP/redirect, build EAS firmate e test su dispositivi. Non viene dichiarata conformità legale certificata.

Le notifiche sono preferenze salvate: l'invio push è un incremento successivo. Prevedere consenso volontario, permessi del sistema, token privati per dispositivo, invio server con messaggi generici e cancellazione/revoca dei token. Nessun dato sanitario sul blocco schermo o negli eventi analitici.

L'archivio contiene sorgenti, lockfile, esempi di configurazione e test. Esclude dipendenze installate, cache, build, cronologia Git e valori di ambiente privati.
