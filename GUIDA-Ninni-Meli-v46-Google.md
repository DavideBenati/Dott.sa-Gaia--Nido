# Indicizzazione Google — v46

Pubblicare Ninni-Meli-Sito-v46.zip su Cloudflare Pages, progetto ninni-meli-shop, Production. Include tutte le modifiche v45; checkout ancora disattivato.

Rimosso noindex/nofollow, inserito canonical https://ninnimeli.com/, aggiunti robots.txt e sitemap.xml. La sitemap elenca soltanto la homepage pubblica: le sezioni con ancora e le schede in dialogo non sono pagine autonome.

Dopo la pubblicazione:
1. Controllare https://ninnimeli.com/robots.txt e https://ninnimeli.com/sitemap.xml.
2. Aprire https://search.google.com/search-console e aggiungere una proprietà Dominio: ninnimeli.com.
3. Copiare il valore TXT fornito da Google. In Cloudflare, Domains → ninnimeli.com → DNS → Records → Add record: tipo TXT, nome @, contenuto esatto fornito da Google. Salvare e verificare in Search Console. Mantenere il TXT dopo la verifica.
4. Nella sezione Sitemap inviare https://ninnimeli.com/sitemap.xml.
5. In Controllo URL inserire https://ninnimeli.com/, eseguire il test dal vivo e richiedere l'indicizzazione.

La configurazione rende il sito idoneo alla scansione; Google decide se e quando indicizzarlo e la posizione nei risultati. Nessuna garanzia di tempi o posizionamento. In caso di blocco nel test dal vivo verificare le regole di sicurezza Cloudflare prima di modificarle; non disattivare le protezioni indiscriminatamente.

Verifica locale: integrità ZIP, sitemap XML, URL canonico, robots e assenza di noindex nel pacchetto. Accesso pubblico e Search Console da verificare dopo il caricamento.
