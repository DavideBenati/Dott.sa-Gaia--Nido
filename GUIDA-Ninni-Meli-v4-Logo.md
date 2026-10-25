# NinniMeli — sito v4 con logo originale

Caricare Ninni-Meli-Sito-v4-Logo.zip in Cloudflare → Compute → Workers & Pages → ninni-meli-shop → Create deployment → Production → Deploy. Non cambiare Worker, DNS, Supabase o Stripe. Lasciare ENABLE_TEST_CHECKOUT=false.

Il logo originale è visualizzato in intestazione e footer attraverso l’URL pubblico fornito dall’utente:
https://thyonlpyemgjuqjclqte.supabase.co/storage/v1/object/public/product-images/NinniMeli_Logo.jpeg

L’immagine non è stata ridisegnata, ritagliata o modificata. Il file JPEG resta ospitato nel bucket pubblico Supabase: non cancellarlo, rinominarlo o rendere privato il bucket. Lo ZIP contiene il riferimento a quell’immagine, non una copia locale del JPEG, perché il proxy di questo ambiente ne impedisce il download (CONNECT HTTP 403). Se non disponibile, il sito mostra il nome NinniMeli come alternativa testuale. Le risorse CSS/JS usano la versione 4 per aggiornare la cache.

Verifiche browser locali con risposte simulate per immagine e API: due posizioni logo, URL corretto, rapporto dimensioni conservato, larghezze 320/390/768/1440 senza overflow, fallback immagine, catalogo e checkout disattivato. La resa del JPEG remoto effettivo va verificata dopo il deployment.
