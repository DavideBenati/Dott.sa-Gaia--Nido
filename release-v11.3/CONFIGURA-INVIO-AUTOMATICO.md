# Attivare l’invio automatico anche a browser chiuso

Questo passaggio fa controllare a Supabase la coda delle email ogni minuto. Il sito prova già a inviare dopo la condivisione; il controllo automatico permette di elaborare anche gli invii rimasti in attesa quando Gaia chiude il browser o il provider è temporaneamente occupato.

Va configurato una volta nel progetto **metimaia**. Prima devono essere presenti la migrazione **017** e la funzione Edge **document-notify** del pacchetto.

## 1. Preparare il controllo periodico

1. Apri **Supabase → SQL Editor → nuova query**.
2. Copia tutto il file **ATTIVA-INVIO-AUTOMATICO.sql**, incollalo e premi **Run**.
3. Il risultato deve mostrare il job **metimaia-document-notify**, con `schedule = * * * * *` e `active = true`.

Lo script prepara le estensioni Supabase necessarie e crea un token casuale riservato in Vault. Non mostra il token nel risultato e non cancella altri lavori programmati. Se lo esegui di nuovo, conserva il token esistente e aggiorna lo stesso job.

Se Supabase segnala che un’estensione non è disponibile, cerca **pg_cron**, **pg_net**, **Vault** e **pgcrypto** nella sezione **Database → Extensions** del progetto e abilita quelle mancanti. Conserva il messaggio se il tuo piano o la configurazione del progetto ne impediscono l’attivazione: un errore non equivale a un invio automatico già attivo.

## 2. Collegare il token alla funzione Edge

1. Nel SQL Editor esegui questa query di sola lettura:

```sql
select decrypted_secret as valore_riservato
from vault.decrypted_secrets
where name = 'document_notify_job_token';
```

2. Copia il valore risultante **soltanto nel pannello Supabase**. Non incollarlo nella chat, nel sito, in GitHub o nelle email.
3. Apri **Edge Functions → Secrets → Add new secret**.
4. Come **Name** inserisci `DOCUMENT_NOTIFY_JOB_TOKEN`; come **Value** incolla il valore copiato.
5. Salva. Non modificare gli altri segreti, compresa la chiave Resend già configurata.
6. Nelle impostazioni della funzione **document-notify**, lascia **Verify JWT** disattivato come indicato nella guida principale: la funzione verifica autonomamente il token degli invii programmati oppure l’account professionale per gli invii dal sito.

Il token in Vault e quello nei Secrets devono essere identici. Il comando programmato legge il valore da Vault a ogni esecuzione; non contiene una copia in chiaro del token.

## 3. Provare con una propria email

1. Con un account di prova confermato e una tua casella, fai condividere a Gaia un documento di prova.
2. Controlla lo stato dell’email nel pannello documenti e la casella della destinataria, compresa la posta indesiderata.
3. Se l’invio resta in attesa, attendi il controllo successivo: il job parte ogni minuto, mentre eventuali errori temporanei del provider possono richiedere attese ulteriori.
4. Puoi controllare le esecuzioni nella sezione **Cron** di Supabase e gli errori in **Edge Functions → document-notify → Logs**. Il solo risultato “job eseguito” non dimostra che il provider abbia accettato l’email: controlla anche lo stato nel pannello e, quando necessario, Resend.

La configurazione non invia notifiche retroattive per i destinatari già presenti prima dell’aggiornamento. Revoche e archiviazione interrompono gli invii ancora da effettuare. Un’email già accettata dal provider non può essere ritirata, ma il collegamento continua a richiedere un account con accesso attuale al documento.
