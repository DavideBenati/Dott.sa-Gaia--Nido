# Ninni Meli — catalogo Supabase, versione 2

Questa versione legge soltanto i prodotti pubblicati del progetto Supabase Ninni Meli. Usa esclusivamente URL e chiave publishable pubblici forniti dall’utente. Non contiene credenziali server, segreti di pagamento o password.

## Caricamento

Cloudflare → Workers & Pages → ninni-meli-shop → Create deployment → Production, se richiesto → caricare Ninni-Meli-Supabase-v2.zip → Deploy.
Il dominio già collegato resta ninnimeli.com. Non ricreare il progetto e non modificare i DNS.

## Risultato previsto

Con entrambi i prodotti published=false, nessuna scheda prodotto deve comparire. Si vedrà: “La collezione è in preparazione. I primi kit saranno presentati qui appena pronti.” Il precedente catalogo dimostrativo non viene utilizzato come ripiego.
Se compare “Non riusciamo a caricare il catalogo”, la connessione non è verificata: controllare nel browser la risposta della richiesta /rest/v1/products, senza condividere chiavi segrete. Un catalogo vuoto e un errore sono stati distinti.

## Gestione catalogo

Supabase → Table Editor → products. Aggiornare descrizione, prezzo in centesimi, scorta effettiva e image_path. Mettere published=true soltanto per schede destinate a essere pubbliche. La pubblicazione rende i dati leggibili dal sito: non usarla per informazioni riservate. Con stock=0 la scheda pubblicata appare ma il pulsante di aggiunta è disabilitato. Il sito mantiene il checkout disabilitato anche con scorte positive: questa versione non crea ordini e non accetta pagamenti.

Per image_path usare il percorso del file nel bucket product-images, per esempio postpartum-box-01.webp oppure kit/foto.webp. Sono accettati anche URL HTTPS dello stesso progetto nel percorso pubblico di quel bucket. Foto assenti o non raggiungibili lasciano un’illustrazione esplicitamente segnaposto.

Dopo una modifica al catalogo ricaricare la pagina. Il carrello locale viene riallineato ai prezzi/scorte attuali, eliminando prodotti non più presenti. Rimane dimostrativo e non riserva le scorte. Il vecchio carrello della prima bozza non viene importato.

## Verifiche

Prove browser con API simulate: catalogo vuoto, pubblicati esauriti, aggiunta/rimozione, limite di scorta, persistenza al ricaricamento, variazione prezzo/scorte, ritiro prodotto, errore e riprova, risposte malformate, escaping dei testi, rifiuto immagini esterne, checkout disabilitato e larghezza telefono. Tutte passate.
La richiesta diretta al Supabase reale è stata bloccata dal proxy di questo ambiente (CONNECT HTTP 403); non è stata verificata la risposta reale né la RLS del progetto remoto. La verifica reale va completata sul sito dopo il deployment. Non sono state effettuate scritture al database remoto.
