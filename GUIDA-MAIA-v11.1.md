# MetiMaia v11.1 — spazi e guida ai banner

Questa versione include l’intero sito v11, con l’iscrizione uniforme e i traguardi, e riduce gli spazi inutili nell’intestazione e tra le sezioni.

## Cosa cambia

- Intestazione più compatta e distanze ridotte tra navigazione, Indietro, titolo e contenuti.
- Nella pagina Progetto, titolo e riquadri sono allineati nella stessa colonna di lettura.
- Il riquadro di benvenuto occupa meno spazio: su PC il logo affianca il titolo, mentre su telefono gli elementi si dispongono in verticale.
- Rimangono i testi, il logo originale, la navigazione, il contatto via email e tutte le funzioni della v11. I controlli principali mantengono un’area di tocco di almeno 44 pixel.

La pubblicità non viene attivata da questo aggiornamento. La [guida ai banner](BANNER-PUBBLICITARI-MAIA-v11.1.md) spiega le schede Amazon già disponibili, i banner di uno sponsor e l’eventuale integrazione Google AdSense.

## Come caricare il sito

1. Scarica **MAIA-Sito-v11.1-Spazi.zip**.
2. Apri Cloudflare → **Workers & Pages** → **lively-tooth-64c2** → **Deployments** → **New deployment**.
3. Carica lo ZIP. Se viene richiesta una cartella, estrailo e caricane il contenuto: `index.html` deve essere direttamente al primo livello.
4. Premi **Deploy** e attendi **Ready**.
5. Apri `https://metimaia.com/gaia` in una finestra privata e controlla gli spazi anche dal telefono.

Non servono nuovi aggiornamenti Supabase, chiavi o Edge Functions per queste correzioni. Se non hai ancora eseguito il file **015 della v11**, quello rimane necessario per salvare il badge Prima selezione nell’account: segui la [guida v11](GUIDA-MAIA-v11.md), senza ripetere le migrazioni già completate.

Il caricamento sul sito pubblico resta da eseguire nel tuo pannello Cloudflare.
