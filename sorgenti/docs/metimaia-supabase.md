# Collegare metimaia.com a Supabase

Progetto: `https://gwepsvlxwjptbchhlldm.supabase.co`. Usare esclusivamente la chiave publishable/anon nel sito e nelle app. Nessuna chiave secret o service_role deve entrare nella build. I file `.env.local` non sono versionati. La configurazione pubblica è inclusa negli asset statici al momento della build, non viene iniettata dal pannello Workers dopo il caricamento.

## Impostazioni nel pannello Supabase

In Authentication → URL Configuration impostare Site URL a `https://metimaia.com` e aggiungere a Redirect URLs `https://metimaia.com/account` e `https://metimaia.com/account/`. Il client usa il primo URL per conferma iscrizione e recupero password. Conservare la conferma email attiva. Verificare template e SMTP: il servizio email predefinito ha restrizioni e non costituisce una configurazione di invio per l’uso con tutte le utenti. Configurare un provider SMTP per il servizio reale, senza condividere password in chat o nel repository.

## Build e caricamento senza integrazione Git

Dalla cartella `sorgenti`, con URL e chiave pubblica in `apps/mobile/.env.local`:

```sh
NIDO_WEB_BASE_PATH= EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 XDG_CACHE_HOME=/workspace/.cache npm run build:web
node scripts/package-cloudflare.mjs /percorso/nuovo/pacchetto
node scripts/test-connected-web.mjs /percorso/nuovo/pacchetto
```

Il test del pacchetto intercetta tutte le chiamate Supabase: verifica interfaccia, redirect, recupero e aggiornamento password senza creare account o inviare email reali. La suite demo Playwright richiede assenza di backend nelle app sotto test: se sono presenti `.env.local` con configurazioni reali, conservarli temporaneamente fuori dalle app, eseguire il test con server dedicati e ripristinarli. Non riutilizzare un server di sviluppo collegato al progetto reale per la suite demo.

Comprimere il contenuto della cartella del pacchetto, con `index.html` alla radice. In Cloudflare aprire il Worker esistente `lively-tooth-64c2`, scegliere New deployment e caricare lo ZIP completo. Non creare un nuovo Worker e non modificare DNS o dominio. Gli entry point HTML fisici permettono l’apertura diretta delle pagine principali con il comportamento HTML standard di Workers Static Assets. Per URL dinamici di articoli/checklist configurare anche il fallback SPA del Worker (`assets.not_found_handling: single-page-application`) quando si passa alla pubblicazione automatizzata; non presumere che l’assenza di `404.html` abiliti il fallback su Workers come avviene su Pages.

## Verifica sul sito pubblicato

Controllare apertura e ricaricamento di `/account`, quindi registrazione con una propria casella, ricezione e conferma email, login/logout, recupero password e accesso da una seconda sessione. Nei test non usare dati sanitari reali. I test locali e le verifiche REST anonime non certificano l’invio email né sostituiscono questo collaudo live.

Il database iniziale contiene categorie, ma non articoli/checklist approvati e pubblicati. Il client reale non sostituisce contenuti mancanti con esempi demo. Pubblicarli dal pannello professionale dopo revisione. Le chat restano disabilitate finché non viene abilitato l’account verificato della Dott.ssa Brunetti nella tabella `private.chat_staff`. Il pannello Next.js non è incluso nel pacchetto statico e richiede un hosting compatibile. Prima dell’uso reale completare i punti dell’informativa e la configurazione del servizio descritti in `privacy-launch.md`.
