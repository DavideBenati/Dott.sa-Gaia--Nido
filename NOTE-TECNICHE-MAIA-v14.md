# metiMaia v14 — note tecniche

La release consolida l’interfaccia e i percorsi esistenti. Il riepilogo in Home legge `session_document_access` con un filtro esplicito sull’account, un join ai documenti attivi e pronti, conteggio completo e ordinamento per data di concessione. Le tabelle e le policy esistenti sono sufficienti; nessuna migrazione viene introdotta.

L’identità viene verificata prima e dopo la lettura. Il componente rimuove il riepilogo al cambio di schermata o al passaggio in background e scarta risposte obsolete. Non introduce un registro di lettura o archivi locali dei titoli.

La navigazione mantiene accessibili le rotte nascoste tramite i soli pulsanti delle schede; non usa `href:null`, che nella versione di Expo Router utilizzata trasformerebbe la destinazione in un reindirizzamento.

## Dipendenze

Aggiornamento mirato di Expo CLI a **58.1.18** e node-forge a **1.4.2**, con le relative dipendenze ammesse dai vincoli dichiarati. La versione principale dell’SDK resta **Expo 58**. Le modifiche sono registrate nel lockfile e la build è stata ripetuta con il nuovo albero.

L’esecuzione finale di `npm audit --omit=dev` non segnala livelli alti o critici. Restano due avvisi moderati, propagati a 29 voci nell’albero delle dipendenze, senza correzione compatibile indicata dall’audit:

- **glob:** GHSA-3g3m-2fjr-6pw4 — cancellazione tramite AbortSignal e scansione del filesystem.
- **minimatch:** GHSA-g3hv-75wg-m249 — possibile consumo di risorse nella gestione dei pattern.

Queste librerie appartengono agli strumenti di configurazione/compilazione. Lo ZIP pubblicato contiene file statici per Cloudflare, senza `node_modules` o server Node. Questa distinzione non costituisce una certificazione di assenza di vulnerabilità. Gli avvisi vanno rivalutati quando gli aggiornamenti compatibili degli strumenti saranno disponibili; non sono state imposte versioni maggiori incompatibili per azzerare il report.

## Evidenza e limiti

I risultati completi sono nel report della release. I controlli automatici verificano anche le policy RLS in un database di prova e i percorsi browser con backend simulato. Non verificano la consegna di email reali, i menu nativi di ogni telefono, la configurazione effettiva del progetto Supabase o il contenuto della libreria privata online. La prova reale successiva alla pubblicazione è descritta nella guida.
