# NinniMeli v40 — logo originale sulle scatole illustrate

Sostituiti gli asterischi residui con il logo originale sia nella scatola dell’apertura sia nelle scatole segnaposto delle schede prodotto. Il file usato è lo stesso dell’intestazione e del footer:
https://thyonlpyemgjuqjclqte.supabase.co/storage/v1/object/public/product-images/NinniMeli_Logo.jpeg

Se l’immagine non è raggiungibile compare soltanto il nome NinniMeli, senza simboli sostitutivi. Nessun ridisegno del marchio. Il JPEG resta nel bucket pubblico Supabase: non rinominarlo o cancellarlo.

Cloudflare → Workers & Pages → ninni-meli-shop → Create deployment → Production → caricare Ninni-Meli-Sito-v40.zip → Deploy. Non servono modifiche a Worker, Supabase, Stripe o DNS. Lasciare ENABLE_TEST_CHECKOUT=false.

Il pacchetto conserva le ottimizzazioni della v39 e aggiorna gli hash delle risorse modificate. Verificati in browser i riferimenti al logo, assenza degli asterischi nelle due illustrazioni, fallback testuale, larghezze 320/390/768/1440, carrello e checkout disattivato. Risposte immagine e API simulate nei controlli locali.
