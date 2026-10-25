-- Replace the requested project presentation; preserve email, photo and privacy settings.
-- Keep legacy catalog rows, but only publish Amazon recommendations.
begin;
update public.site_profile set
  bio = 'Ogni nascita dà inizio a un nuovo viaggio. Insieme, è più bello.

MetiMaia è uno spazio dedicato alle famiglie, per accompagnarle dalla gravidanza alla nascita e nei primi anni di vita del bambino, attraverso informazioni affidabili, strumenti pratici e il sostegno della competenza ostetrica.

Un luogo in cui trovare risposte, acquisire consapevolezza e sentirsi accompagnati in una delle trasformazioni più importanti della vita: diventare famiglia.

Benvenuti in MetiMaia

Inizia un percorso fatto di emozioni, scoperte, domande e cambiamenti che coinvolgono tutti. La gravidanza, il parto, il post-partum e i primi anni di vita portano con sé nuove responsabilità, nuovi equilibri e un modo diverso di guardare al mondo.

MetiMaia nasce dal desiderio di rendere questo percorso più consapevole e meno solitario, mettendo la conoscenza e la competenza ostetrica al servizio di mamme, papà, partner e di tutte le persone che partecipano alla crescita di un bambino.

Attraverso contenuti basati sulle evidenze scientifiche, guide pratiche e strumenti utili nella quotidianità, vogliamo aiutare le famiglie a orientarsi, comprendere i propri bisogni e affrontare ogni fase con maggiore fiducia.

Perché informare significa prendersi cura, e accompagnare significa esserci senza giudicare, rispettando la storia e le scelte di ogni famiglia.',
  qualifications = 'Il significato di MetiMaia

Il nome MetiMaia racchiude l’essenza della nostra visione: conoscenza, vita, crescita e condivisione.

Meti richiama simbolicamente Meti (Metide), figura della mitologia greca associata alla saggezza, all’intelligenza pratica e alla capacità di trovare soluzioni. Rappresenta la competenza, la conoscenza scientifica e la consapevolezza necessarie per affrontare le domande e le sfide che accompagnano la genitorialità.

Maia richiama la figura mitologica greca, madre di Ermes, e diventa simbolicamente espressione di maternità, vita e crescita. Rappresenta la trasformazione che coinvolge l’intera famiglia, che giorno dopo giorno costruisce nuovi legami, relazioni ed equilibri.

Inoltre «Με τη μαία» (me ti maía) significa letteralmente «con l''ostetrica». Nel nome trova spazio quindi anche il significato simbolico che esprime il cuore del progetto: esserci, camminare insieme e crescere insieme.

Il fiore di loto: il simbolo di MetiMaia

Il fiore di loto rappresenta l’anima del progetto. Affonda le sue radici nell’acqua e cresce lentamente verso la luce, fino a sbocciare in superficie. È un simbolo che richiama la vita, la trasformazione e la possibilità di crescere anche attraverso i momenti più complessi.

La nascita di un bambino trasforma profondamente non soltanto chi diventa genitore, ma l’intera famiglia, che impara a conoscersi, ad adattarsi e a trovare nuovi equilibri.

Per MetiMaia, il loto rappresenta la possibilità di crescere, trasformarsi e sbocciare insieme.

Le sue radici simboleggiano le basi su cui costruire: conoscenza, fiducia e sostegno. Il suo stelo rappresenta il percorso, con le sue tappe e i suoi cambiamenti. Il fiore che si apre richiama la crescita, la scoperta e la bellezza di una nuova vita che prende forma.

Ogni famiglia ha i propri tempi, ogni percorso è unico e ogni nascita porta con sé la possibilità di un nuovo inizio.

Come il fiore di loto, possiamo crescere attraverso il cambiamento e trovare, passo dopo passo, il nostro modo di sbocciare.',
  service_area = 'La nostra filosofia

Crediamo che ogni famiglia meriti informazioni chiare, sostegno competente e uno spazio in cui sentirsi accolta senza giudizio.

Crediamo nella conoscenza come strumento di libertà e consapevolezza, nella relazione come parte fondamentale della cura e nel rispetto delle scelte individuali.

Per questo MetiMaia vuole offrire contenuti affidabili e aggiornati, collegati alle evidenze scientifiche, senza sostituirsi alla relazione con i professionisti sanitari, ma aiutando le famiglie a viverla in modo più consapevole.

Non vogliamo proporre un modello ideale di genitorialità da raggiungere, ma fornire strumenti per trovare il proprio modo di esserlo.

Perché non esiste un’unica maniera di diventare famiglia. Esistono storie diverse, bisogni differenti e un percorso unico per ciascuno.

Insieme, nel viaggio della genitorialità

MetiMaia nasce da un’ostetrica, ma si rivolge a tutta la famiglia.

È un progetto che vuole avvicinare la competenza professionale alla vita quotidiana, rendere la conoscenza accessibile e offrire un sostegno concreto nei momenti in cui le domande sono tante e le certezze sembrano poche.

Un luogo in cui informarsi, prepararsi, scoprire e crescere. Un compagno di viaggio da consultare nelle diverse tappe, sapendo che chiedere aiuto è una risorsa e che non è necessario avere tutte le risposte.

Perché quando una famiglia cresce, cresce insieme a lei anche il bisogno di conoscenza, ascolto e cura.

MetiMaia vuole esserci, un passo alla volta.

MetiMaia — La conoscenza che accompagna, la cura che unisce',
  services = '[{"title":"La gravidanza","description":"Comprendere i cambiamenti del corpo, conoscere le tappe della gestazione, prepararsi alla nascita e vivere l’attesa con maggiore consapevolezza.","details":""},{"title":"La nascita e il post-partum","description":"Orientarsi tra travaglio, parto, recupero materno, allattamento, emozioni e nuovi equilibri familiari.","details":""},{"title":"Il primo anno di vita","description":"Scoprire le cure del neonato, il sonno sicuro, l’alimentazione, le tappe dello sviluppo e le risorse utili nella quotidianità.","details":""},{"title":"La crescita della famiglia","description":"Riconoscere i bisogni di ciascuno, valorizzare il ruolo di ogni genitore e costruire insieme nuove abitudini e relazioni.","details":""}]'::jsonb
where id = 1;
-- Refresh only the old provider starter text, never a custom privacy notice.
update public.site_profile set privacy_providers =
  'Cloudflare ospita il sito; Supabase gestisce autenticazione e database del progetto; Resend gestisce le email. Amazon è esterno per i consigli d’acquisto e Hostpoint Meet per le videochiamate aperte su richiesta.'
where id = 1 and privacy_providers in (
  'Cloudflare ospita il sito. Supabase gestisce autenticazione e database del progetto in Irlanda. Resend gestisce l’invio email; Stripe gestisce i pagamenti quando lo Shop è attivo. I collegamenti Amazon aprono un servizio esterno.',
  'Cloudflare ospita il sito; Supabase gestisce autenticazione e database in Irlanda; Resend gestisce le email. Stripe gestisce i pagamenti quando lo Shop è attivo. Amazon è un servizio esterno.'
);
update public.shop_settings set enabled = false where id = 1;
drop policy if exists shop_products_public on public.shop_products;
create policy shop_products_public on public.shop_products for select to anon,authenticated using (
  kind = 'amazon' and status = 'published' and exists (
    select 1 from public.shop_settings where id = 1 and recommendations_enabled
  )
);
commit;
