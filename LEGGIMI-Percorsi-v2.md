# metiMaia: incontri, registrazione, contenuti, chat e SEO

Aggiornamento cumulativo: mantiene Area professionista, newsletter e Shop Amazon/prodotti della dottoressa.

## Pubblicazione

Caricare `MAIA-Percorsi-v2.zip` nel Worker Cloudflare esistente tramite **New deployment**. Nessuna nuova migrazione SQL, chiave o modifica DNS è richiesta per queste funzioni. Restano necessarie le configurazioni già previste per ruoli editoriali, chat, newsletter e shop se non sono state completate. Aprire una scheda privata o ricaricare dopo il deploy per evitare vecchi file in cache.

## 2. Richiesta di disponibilità

`/prenota`, disponibile dalla pagina iniziale e dal footer. Scegliere il motivo del contatto, nome/email e preferenze facoltative di data, fascia e modalità. La pagina valida date e campi, mostra un riepilogo e permette di aprire una bozza nell'app email o di copiare il testo. Il destinatario è `ostetricamaia@gmail.com`, fornito dal titolare.

NON invia automaticamente email, non salva richieste nel database, non legge un calendario e non conferma appuntamenti. L'utente deve inviare dalla propria app email; Gaia concorda disponibilità, luogo e costi con la persona. I campi non sono salvati in localStorage. Non sono richiesti referti o dettagli clinici; l'informativa descrive il passaggio ai fornitori email.

## 3. Registrazione

Dopo signup senza sessione appare **Controlla la tua email**, con indirizzo, istruzioni, correzione dell'indirizzo e accesso dopo conferma. Il pulsante **Invia nuovamente la conferma** usa Supabase Auth `resend`, con un'attesa locale di 60 secondi e i limiti server già applicati da Supabase/Resend. La pagina non dichiara consegnata o letta un'email. La conferma newsletter resta distinta.

I callback con codice `otp_expired` spiegano il problema e permettono di richiedere un nuovo link senza ripetere la registrazione. Non è disattivata la conferma email. Non sono cambiati SMTP o template email del progetto: restano configurazioni server. Il codice non registra callback o token nei log.

## 4. Contenuti

Gli articoli si filtrano per gravidanza, nascita (categorie preparazione/nascita), dopo il parto, argomento e ricerca testuale. Disponibili filtro fino a cinque minuti e ordinamento per revisione recente, durata o titolo. Le schede mostrano autore/ruolo e data di revisione quando presente; la data non viene inventata.

Le checklist hanno ricerca su titolo, descrizione e attività, con filtri di percorso e ripristino. I collegamenti degli articoli e delle checklist sono ancore navigabili e indicizzabili, senza perdere i salvataggi o i progressi. I contenuti reali rimangono solo quelli pubblicati e approvati nel backend; i test usano dati simulati.

## 5. Chat

Mostra quando la conversazione è stata aggiornata, distingue il salvataggio del messaggio dalla lettura e preserva il testo se un invio non è confermato. Il pulsante di ricaricamento rilegge la conversazione senza inviare nuovamente il messaggio. I limiti della risposta, l'assenza di assistenza continua e il riferimento al 112 sono visibili.

L'abilitazione della chat non significa che Gaia sia online. Non vengono inventati giorni/orari di lavoro o tempi garantiti. Non sono stati aggiunti push o invii email del contenuto sanitario. Il polling resta ogni 15 secondi. La casella professionista esistente e il suo ruolo separato non vengono modificati da questo aggiornamento: il sito non concede automaticamente a un editor accesso alle conversazioni.

## 7. Google e anteprime

Il pacchetto Cloudflare contiene HTML con titolo, descrizione, lingua italiana, canonical, Open Graph/Twitter, immagine del logo condivisibile e dati strutturati WebSite/Person con dati reali. Non sono inseriti recensioni, certificazioni, prezzi o orari inventati.

`robots.txt` permette la scansione delle pagine pubbliche e indica `https://metimaia.com/sitemap.xml`. La sitemap contiene le pagine pubbliche stabili; non include account, chat, profilo, salvati, newsletter e studio. Le aree riservate hanno `noindex` sia nei metadati sia nelle regole `_headers`. Queste indicazioni non sostituiscono autenticazione e RLS.

Il titolo/descrizione e il canonical delle letture pubblicate vengono aggiornati anche durante la navigazione nell'app. Gli articoli nuovi vengono scoperti attraverso i link della biblioteca; il sito è una SPA statica e richiede il rendering JavaScript per il corpo delle letture. La sitemap non è un feed dinamico di tutte le pubblicazioni. I crawler social che non eseguono JavaScript vedranno l'anteprima generale della sezione letture e il logo, non un'immagine/titolo dedicato per ogni ID: per anteprime server dinamiche per singolo articolo servirà un Worker o rendering server, non incluso in un semplice ZIP di asset statici.

Dopo il deploy verificare `/robots.txt`, `/sitemap.xml` e `/social-preview.png`. Aggiungere il dominio a Google Search Console e inviare la sitemap; l'indicizzazione e le posizioni non sono garantite né immediate. Le build demo di sviluppo/GitHub mantengono il blocco robots finché non vengono preparate con il packager Cloudflare di produzione.

## Verifica

Test automatici locali con richieste Supabase/Stripe/Amazon/email simulate, controlli TypeScript e test PostgreSQL già presenti. Nessuna prenotazione, email, registrazione o pagamento reale effettuato dall'assistente. Collaudare successivamente la propria registrazione, il link email e la chat con i ruoli reali del progetto. I nuovi metadati non certificano conformità legale o clinica.
