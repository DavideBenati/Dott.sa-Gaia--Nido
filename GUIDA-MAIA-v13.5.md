# metiMaia v13.5 — una Home più essenziale

**MAIA-Sito-v13.5-Home-Essenziale.zip** contiene il sito completo aggiornato, con le funzioni delle versioni precedenti.

## Cosa cambia nella Home

La pagina propone tre contenuti principali:

1. **I miei documenti**, per chi ha effettuato l’accesso: i materiali condivisi da Gaia.
2. **Una checklist**, dando precedenza a quella già iniziata e mantenendo visibili i progressi. Le liste completate rimangono consultabili.
3. **Una lettura consigliata**, invece di tre schede. Il collegamento **Tutte le letture** apre il catalogo completo.

**Letture salvate** e **Tutte le checklist** sono collegamenti brevi, senza grandi schede duplicate. La pagina ha una colonna più raccolta anche da computer.

Le altre azioni sono disponibili aprendo **Altre opzioni**: personalizzazione, scheda per Gaia, traguardi, contatti, richiesta via email, consigli d’acquisto e guida all’installazione nel browser. La Home usa un footer breve con contatti e privacy.

Per gli ospiti restano letture, checklist e accesso all’account; i documenti personali richiedono l’accesso. Caricamento, errore e pulsante per riprovare rimangono visibili. Quando non ci sono ancora letture viene mostrato un messaggio esplicito, senza contenuti inventati.

## Come pubblicare

1. Scarica **MAIA-Sito-v13.5-Home-Essenziale.zip**.
2. Nel progetto del sito su **Cloudflare → Workers & Pages → Deployments → New deployment**, carica lo ZIP.
3. Se il pannello richiede una cartella, estrai lo ZIP e caricane il contenuto: `index.html` deve essere al primo livello.
4. Pubblica e attendi che il deployment sia pronto.
5. Apri l’app. Se compare una nuova versione, usa **Aggiorna MAIA**. Controlla che i contenuti principali precedano **Altre opzioni**.

Non sono necessarie nuove configurazioni Supabase. I materiali privati non sono contenuti nello ZIP pubblico. L’assistente ha preparato il pacchetto; il caricamento su Cloudflare va eseguito nel pannello.

## Verifiche

Controlli statici, test esistenti sulla selezione della checklist e prove browser verificano: una lettura visibile su tre disponibili, opzioni secondarie chiuse inizialmente, apertura del catalogo completo, documenti riservati, lista da riprendere, schermi stretti, ospiti e caricamento/errore del catalogo.

Le prove browser usano dati di esempio e servizi simulati, senza inviare email o modificare account reali. Il report allegato distingue il pacchetto finale dalla prima revisione della Home.
