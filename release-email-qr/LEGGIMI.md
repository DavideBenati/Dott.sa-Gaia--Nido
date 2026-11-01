# Email di registrazione metiMaia — benvenuto, conferma e QR

Il modello personalizza l’email automatica di conferma registrazione inviata da Supabase. Il messaggio dà il benvenuto, mantiene **Conferma l’email** come primo passaggio e propone l’installazione dopo la conferma.

La mail contiene sia **Installa MAIA sul telefono**, comodo per chi la legge dallo smartphone, sia il PNG del QR visibile nel corpo della mail per chi la legge dal computer. Se il programma di posta nasconde le immagini, restano disponibili il pulsante e il collegamento scritto.

## 1. Verifica le istruzioni sul sito

Apri **https://metimaia.com/installa**: deve mostrare le istruzioni e l’app deve essere pubblicata sul sito. La versione completa v13.3 contiene questo percorso.

L’immagine nella mail usa il collegamento pubblico già verificato:

**https://raw.githubusercontent.com/DavideBenati/Dott.sa-Gaia--Nido/refs/heads/cloudflare-package/QR-App-MAIA.png**

Il PNG contiene soltanto il collegamento a **https://metimaia.com/installa**. Il file dell’immagine è servito da GitHub, senza dipendere dal caricamento del PNG sul dominio del sito. Il codice resta generato dal progetto, senza servizi esterni di generazione QR.

## 2. Applica il modello in Supabase

1. Estrai **MAIA-Mail-Benvenuto-QR.zip** sul computer.
2. Apri **Supabase → progetto metimaia → Authentication → Emails / Email Templates**.
3. Scegli **Confirm signup / Confirm sign up**, cioè la conferma della registrazione. Conserva una copia del modello attuale se è già personalizzato.
4. Nel campo **Subject / Oggetto** incolla il contenuto di **OGGETTO.txt**.
5. Apri **CORPO-DA-INCOLLARE.txt** e copia tutto: contiene il codice HTML pronto, compresa la prima riga `<!doctype html>`.
6. Incollalo nel campo **Body / Corpo** della mail e premi **Save / Salva**.

Questo HTML va nel corpo del template email di Authentication. Non occorre eseguire SQL, creare funzioni Edge o modificare le chiavi Resend/SMTP.

Il collegamento `{{ .ConfirmationURL }}` deve rimanere esattamente così: Supabase lo sostituirà con il collegamento di conferma valido per ogni destinatario. Il modello conserva il ritorno all’account previsto dal sito.

L’invio resta quello automatico della conferma registrazione. Gli avvisi dei documenti e la newsletter mantengono la loro configurazione. Cambiare questo modello non reinvia mail agli iscritti precedenti.

## 3. Prova prima di considerarlo attivo

Registra un tuo account di prova e verifica che:

1. Arrivi la mail con il nuovo oggetto e il messaggio di Gaia.
2. **Conferma l’email** confermi correttamente l’indirizzo e permetta di continuare sul sito.
3. Il pulsante **Installa MAIA sul telefono** apra le istruzioni.
4. Il QR compaia quando il programma di posta consente le immagini e sia leggibile dalla fotocamera.
5. Il collegamento scritto resti utilizzabile anche se le immagini sono nascoste.

L’apertura dall’icona MAIA può richiedere un nuovo accesso con le stesse credenziali, anche se il browser è già autenticato. L’installazione dell’app si conferma sul telefono.

## Contenuto del pacchetto

- **CORPO-DA-INCOLLARE.txt** — codice da copiare nel campo Body di Supabase.
- **EMAIL-REGISTRAZIONE.html** — anteprima visiva della mail; il collegamento di conferma diventa valido nelle email inviate da Supabase.
- **OGGETTO.txt** — testo da usare come oggetto.
- **QR-App-MAIA.png** — copia di riferimento del QR già incluso nel sito v13.3.
- **LEGGIMI.md** — questa guida.

Il pacchetto serve alla configurazione della mail in Supabase. Lo ZIP da caricare su Cloudflare rimane quello del sito v13.3.

Le verifiche di sviluppo non inviano email reali e non modificano il progetto Supabase remoto. Il template viene attivato solo dopo il salvataggio nel tuo pannello. Il percorso locale è configurato in `sorgenti/supabase/config.toml` per mantenere i sorgenti coerenti.
