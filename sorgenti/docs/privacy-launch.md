# MAIA — informativa privacy e attivazione del servizio

Testo aggiornato il 22 ottobre 2026. È una bozza operativa fondata sulla struttura degli artt. 12–14 GDPR e sul Codice privacy italiano; non attesta la conformità del servizio. I testi ufficiali non sono stati consultabili in questa sessione per le restrizioni di rete. Verificarne la versione vigente e far revisionare testo e flussi rispetto al funzionamento reale prima della raccolta di dati personali, soprattutto sanitari.

## Dati indicati dal titolare del progetto

- Titolare indicato: **Gaia Brunetti**.
- Recapito postale: **Via San Godenzo 33, Roma, Italia**. Verificare completezza e correttezza per le richieste degli interessati.
- Gestione delle conversazioni: **solo Dott.ssa Gaia Brunetti**. I permessi editoriali non autorizzano la lettura della chat. La tabella `private.chat_staff` deve contenere solo il suo account verificato e attivo.
- Email per le richieste privacy: **ostetricamaia@gmail.com**.
- DPO: verificare necessità della nomina; non inventare un DPO se non nominato.

## Parametri pubblici

La pagina `/privacy` legge i campi da `apps/mobile/src/privacy.ts`. I valori di default includono nome, indirizzo e contatto email forniti dall’utente. Le variabili sono pubbliche e vengono incluse nella build: non sono destinate a segreti.

| Variabile                        | Contenuto da verificare                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_PRIVACY_CONTROLLER` | Identità effettiva del titolare, di default Gaia Brunetti                           |
| `EXPO_PUBLIC_PRIVACY_ADDRESS`    | Recapito postale per esercitare i diritti                                           |
| `EXPO_PUBLIC_PRIVACY_EMAIL`      | Recapito email effettivamente presidiato                                            |
| `EXPO_PUBLIC_PRIVACY_DPO`        | Contatto del DPO, solo se nominato                                                  |
| `EXPO_PUBLIC_PRIVACY_PROVIDERS`  | Fornitori reali, ruoli e destinatari, inclusi hosting, autenticazione, email e chat |
| `EXPO_PUBLIC_PRIVACY_RETENTION`  | Termini o criteri distinti per account, messaggi, log, prove dei consensi e backup  |
| `EXPO_PUBLIC_PRIVACY_TRANSFERS`  | Regioni, accessi extra SEE e garanzie effettive ai sensi del capo V GDPR            |

Ricostruire il sito dopo le modifiche. L’assenza dei dati mantiene visibile “Informativa in completamento”. Compilare i campi non verifica contratti, basi giuridiche o garanzie di trasferimento e non disattiva tecnicamente i servizi. Non rimuovere l’avviso per dare un’apparenza di conformità.

## Coerenza tra testo e funzionamento

La demo salva le preferenze localmente e non abilita registrazione o invio di messaggi. Il sito è distribuito su GitHub Pages: non promettere che il fornitore non tratti IP o log. Il codice non integra pubblicità o analisi del comportamento. Le risorse di terzi e le impostazioni effettive di hosting vanno verificate; non aggiungere tracker non necessari prima del consenso.

La richiesta di un consenso marketing per servizi non attivi è stata rimossa. I nuovi salvataggi delle preferenze impostano `marketing=false`. Questo non cancella retroattivamente eventuali record già esistenti su un backend: verificarli e adeguarli prima del lancio. Non interpretare i vecchi flag come un consenso dimostrabile per campagne future. Le notifiche non sono inviate; un futuro avvio richiede una nuova verifica dei flussi.

Il consenso esistente alla data è una scelta facoltativa e revocabile. Il semplice flag non costituisce un registro completo dei consensi: prima della raccolta di dati reali occorre definire la prova del consenso, versione del testo, data dell’azione e revoca. Anche percorso, argomenti e altre preferenze possono rivelare dati sulla salute; non limitare la verifica dell’art. 9 alla data. Definire separatamente basi, finalità e condizioni per la chat, evitando di qualificare automaticamente come cura una chat educativa. Non aggiungere una casella “accetto la privacy” obbligatoria come consenso generale.

L’esportazione include i messaggi nel servizio reale. La cancellazione dell’account rimuove i record applicativi attivi in cascata; non promettere cancellazione immediata di backup, log dei fornitori o documenti professionali separati. Definire termini e procedure effettive. Non dichiarare cifratura end-to-end: non è implementata.

## Verifiche che restano organizzative o richiedono un servizio reale

Confermare ruoli e basi giuridiche per ciascuna finalità; accordi e responsabili art. 28; trasferimenti e subfornitori; tempi e responsabilità di conservazione; canali per diritti e reclami; procedure di sicurezza e gestione incidenti. Valutare necessità di registro dei trattamenti, DPO e valutazione d’impatto in base al caso concreto, senza presumere esenzioni o obblighi universali. Verificare le condizioni per utenti minorenni e dati di terzi. Pubblicare un’informativa definitiva e aggiornare la raccolta dei consensi prima di attivare dati sanitari o chat reale.

## Riferimenti da verificare nella versione vigente

- [GDPR — Regolamento (UE) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj/ita), in particolare artt. 5–9, 12–22, 25, 28, 32, 35 e capo V.
- [Codice in materia di protezione dei dati personali — Garante](https://www.garanteprivacy.it/codice), incluso l’art. 122 per gli strumenti di archiviazione/accesso sul terminale.
- [Garante per la protezione dei dati personali](https://www.garanteprivacy.it/), per diritti, reclami e indicazioni su cookie e tracciamento.
