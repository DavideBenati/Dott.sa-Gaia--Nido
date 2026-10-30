-- MetiMaia: recupero delle 14 letture dell'archivio, SOLO IN BOZZA.
-- I testi restano dimostrativi e NON approvati: non compaiono al pubblico.
-- Nessuna revisione clinica o abilitazione professionale viene attribuita.
-- Eseguire nel SQL Editor con il ruolo amministrativo fidato del progetto.
-- Non eseguire dall'app. Il file non contiene chiavi o account da impersonare.
-- Le righe gia presenti con lo stesso ID o indirizzo (slug) sono conservate.
-- L'identita dell'autore originale resta nel payload; author_id rimane NULL.
-- Il normale salvataggio da Studio creera l'autore dopo la verifica di Gaia.
begin;

-- Non alterare lo stato di un progetto che ha gia trigger disabilitati.
do $maia_recovery_preflight$
begin
  if not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid='public.articles'::regclass
      and tgname='articles_validate' and tgenabled='O' and not tgisinternal
  ) or not exists (
    select 1 from pg_catalog.pg_trigger
    where tgrelid='public.articles'::regclass
      and tgname='articles_review' and tgenabled='O' and not tgisinternal
  ) then
    raise exception 'Il recupero richiede i normali trigger editoriali attivi';
  end if;
end;
$maia_recovery_preflight$;

-- Solo categorie mancanti; nomi e modifiche esistenti restano invariati.
insert into public.article_categories(id,name,icon) values
('pregnancy','Gravidanza','sunny-outline'),
('preparation','Preparazione al parto','bag-outline'),
('birth','Travaglio e nascita','flower-outline'),
('recovery','Puerperio e recupero','leaf-outline'),
('breastfeeding','Allattamento al seno','heart-outline'),
('feeding','Alimentazione del neonato','water-outline'),
('wellbeing','Benessere emotivo','happy-outline'),
('partner','Il ruolo del partner','people-outline'),
('home','Primi giorni a casa','home-outline')
on conflict(id) do nothing;

-- DDL transazionale: il lock dura fino a COMMIT o ROLLBACK.
-- La validazione richiede un account redazionale, assente nel SQL Editor.
-- Viene sospeso SOLO questo trigger per le bozze fisse qui sotto.
-- articles_review rimane attivo: approved=false non produce revisioni.
alter table public.articles disable trigger articles_validate;

do $maia_recovery$
declare
  documents jsonb := $maia_recovery_documents$[
  {
    "id": "c43584cb-9a0d-5126-94a3-b640d9e18f29",
    "title": "Il primo trimestre, un passo alla volta",
    "subtitle": "Fare spazio alle domande e costruire una rete di riferimento, senza dover sapere già tutto.",
    "categoryId": "pregnancy",
    "stage": "pregnancy",
    "weekFrom": 0,
    "weekTo": 13,
    "imageUrl": "https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?auto=format&fit=crop&w=1200&q=80",
    "sections": [
      {
        "heading": "Una nuova quotidianità",
        "paragraphs": [
          "Scoprire una gravidanza può portare emozioni diverse, anche nello stesso giorno. Non esiste un modo giusto di sentirsi e non devi trasformare subito ogni abitudine.",
          "Un primo passo pratico è individuare il professionista o il servizio che seguirà il percorso. Chiedi come organizzare gli incontri e a chi rivolgerti tra un appuntamento e l’altro.",
          "Questo esempio offre spunti per preparare una conversazione: non descrive cosa dovrebbe accadere nel tuo caso e non sostituisce le indicazioni ricevute durante una visita."
        ]
      },
      {
        "heading": "Preparare il primo incontro",
        "paragraphs": [
          "Puoi annotare le domande in un posto semplice da ritrovare. Portare una persona di fiducia è una possibilità da valutare in base alle tue preferenze e all’organizzazione del servizio.",
          "Chiedi quali documenti servono, come vengono condivisi gli esiti e quali decisioni richiedono un colloquio. Il calendario degli accertamenti va definito con chi ti segue.",
          "Se assumi farmaci o integratori, parla con il professionista prima di modificarli. Nido non fornisce prescrizioni, dosaggi o indicazioni individuali sui trattamenti."
        ]
      },
      {
        "heading": "Scegliere cosa condividere",
        "paragraphs": [
          "Puoi decidere con chi parlare della gravidanza e quando farlo. Anche chiedere di mantenere riservata una notizia è un bisogno legittimo.",
          "Con il partner o una persona vicina, prova a nominare un aiuto concreto: accompagnarti, occuparsi di una commissione, ascoltare senza cercare subito una soluzione.",
          "Per dubbi sul tuo stato di salute contatta il servizio che ti segue. Se la preoccupazione è urgente, rivolgiti subito ai servizi sanitari appropriati del luogo in cui ti trovi."
        ]
      }
    ],
    "references": [
      {
        "label": "Lettura di approfondimento: NHS — Pregnancy",
        "url": "https://www.nhs.uk/pregnancy/"
      }
    ],
    "slug": "primo-trimestre",
    "readingMinutes": 3,
    "authorName": "Redazione Nido · esempio",
    "authorRole": "Contenuto dimostrativo, da revisionare",
    "publishedAt": null,
    "reviewedAt": null,
    "reviewerName": null,
    "status": "draft",
    "approved": false,
    "isDemo": true,
    "videoUrl": null
  },
  {
    "id": "b159e08a-6ddc-5e1e-812e-424a0ec9e81d",
    "title": "Secondo trimestre: trovare il proprio ritmo",
    "subtitle": "Tempo per informarsi, adattare la quotidianità e fare domande alle persone che ti accompagnano.",
    "categoryId": "pregnancy",
    "stage": "pregnancy",
    "weekFrom": 14,
    "weekTo": 27,
    "imageUrl": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80",
    "sections": [
      {
        "heading": "Un percorso personale",
        "paragraphs": [
          "Il passaggio da un trimestre all’altro è un riferimento orientativo, non un calendario di come dovresti sentirti. I racconti di altre persone non sono un metro per valutare il tuo percorso.",
          "Negli incontri puoi raccontare come stai vivendo lavoro, sonno, relazioni e organizzazione delle giornate. Sono aspetti utili a una conversazione completa, insieme alle domande cliniche.",
          "Scegli poche fonti affidabili e lascia spazio alle domande che restano aperte. Cercare informazioni per molte ore può rendere più difficile capire quali siano davvero pertinenti."
        ]
      },
      {
        "heading": "Dare forma alla preparazione",
        "paragraphs": [
          "Se ti interessa un corso di accompagnamento alla nascita, chiedi al consultorio o al servizio che ti segue quali percorsi sono disponibili e come partecipare.",
          "Puoi iniziare a conoscere i luoghi previsti per l’assistenza: modalità di accesso, contatti, presenza dell’accompagnatore e possibilità di porre domande prima della nascita.",
          "Per attività fisica, alimentazione e cambiamenti che ti preoccupano, chiedi indicazioni individuali al professionista. Questo contenuto non stabilisce attività adatte alla tua situazione."
        ]
      },
      {
        "heading": "Uno spazio per il partner",
        "paragraphs": [
          "Chi accompagna può partecipare alla preparazione senza conoscere ogni dettaglio sanitario. Condividere soltanto ciò che desideri aiuta a rispettare la tua riservatezza.",
          "Una breve conversazione settimanale può concentrarsi su una domanda: che cosa renderebbe più semplice la prossima settimana? Le risposte possono essere pratiche, emotive o entrambe.",
          "Se desideri supporto aggiuntivo, puoi chiedere quali servizi del territorio lavorano con future e nuove famiglie. Informarsi non obbliga a prendere subito una decisione."
        ]
      }
    ],
    "references": [
      {
        "label": "Lettura di approfondimento: NHS — Pregnancy",
        "url": "https://www.nhs.uk/pregnancy/"
      }
    ],
    "slug": "secondo-trimestre",
    "readingMinutes": 3,
    "authorName": "Redazione Nido · esempio",
    "authorRole": "Contenuto dimostrativo, da revisionare",
    "publishedAt": null,
    "reviewedAt": null,
    "reviewerName": null,
    "status": "draft",
    "approved": false,
    "isDemo": true,
    "videoUrl": null
  },
  {
    "id": "a771a209-0c15-51a0-8316-696c94d77821",
    "title": "Verso la nascita, con spazio per l’imprevisto",
    "subtitle": "Prepararsi al terzo trimestre con informazioni chiare e un’organizzazione flessibile.",
    "categoryId": "pregnancy",
    "stage": "pregnancy",
    "weekFrom": 28,
    "weekTo": 43,
    "imageUrl": "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&w=1200&q=80",
    "sections": [
      {
        "heading": "Mettere in ordine le informazioni",
        "paragraphs": [
          "Prepararsi alla nascita non significa prevedere ogni passaggio. Può significare sapere dove trovare un numero utile, quali documenti tenere insieme e chi può accompagnarti.",
          "Verifica con il punto nascita le modalità di accesso e le indicazioni per contattare l’équipe. Le informazioni organizzative possono cambiare da una struttura all’altra.",
          "Conserva una lista essenziale e facilmente accessibile anche a una persona di fiducia. Evita di inserire informazioni sanitarie private in documenti condivisi se non è necessario."
        ]
      },
      {
        "heading": "Preferenze, domande e decisioni",
        "paragraphs": [
          "Puoi preparare una pagina con desideri e domande da discutere: persone presenti, comunicazione, ambiente e possibilità di sollievo dal dolore. Non è un contratto sul futuro.",
          "Chiedi come vengono spiegate le opzioni e come partecipare alle decisioni se le circostanze cambiano. Comprendere una proposta comprende anche poter chiedere una spiegazione più semplice.",
          "Le scelte cliniche richiedono una valutazione individuale. Le preferenze non sostituiscono il colloquio con i professionisti che ti assistono."
        ]
      },
      {
        "heading": "Preparare il dopo",
        "paragraphs": [
          "Un piccolo piano per i giorni successivi può includere pasti, spesa, visite e persone da contattare. Lascia spazio a cambiare idea dopo aver conosciuto le tue esigenze.",
          "Concorda in anticipo chi può fare da filtro alle richieste di amici e parenti. Accogliere aiuto non significa dover accogliere visite quando non lo desideri.",
          "Per sapere quando e come contattare l’assistenza durante l’attesa, usa le indicazioni del tuo servizio. Nido non determina se un segnale richiede una valutazione."
        ]
      }
    ],
    "references": [
      {
        "label": "Lettura di approfondimento: NHS — Pregnancy",
        "url": "https://www.nhs.uk/pregnancy/"
      },
      {
        "label": "Lettura di approfondimento: NHS — Labour and birth",
        "url": "https://www.nhs.uk/pregnancy/labour-and-birth/"
      }
    ],
    "slug": "terzo-trimestre",
    "readingMinutes": 3,
    "authorName": "Redazione Nido · esempio",
    "authorRole": "Contenuto dimostrativo, da revisionare",
    "publishedAt": null,
    "reviewedAt": null,
    "reviewerName": null,
    "status": "draft",
    "approved": false,
    "isDemo": true,
    "videoUrl": null
  },
  {
    "id": "cd21a777-afd7-56b6-bd5b-85bbf32cf105",
    "title": "La borsa del parto, senza il superfluo",
    "authorName": "Dott.sa Gaia",
    "authorRole": "Autrice del documento originale · adattamento Nido",
    "subtitle": "Cosa preparare per te e il neonato, con i documenti da verificare insieme al punto nascita.",
    "categoryId": "preparation",
    "stage": "pregnancy",
    "weekFrom": 28,
    "weekTo": 43,
    "imageUrl": "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
    "sections": [
      {
        "heading": "Prima della lista, la struttura",
        "paragraphs": [
          "Questa lista riprende le informazioni del documento “Borsa parto.docx” condiviso per Nido. Il documento non riporta una revisione clinica: quantità e preferenze sono spunti da adattare, non requisiti validi per ogni struttura.",
          "Chiedi al punto nascita la lista aggiornata di ciò che viene fornito e di ciò che è utile portare. Le esigenze locali possono essere diverse dagli elenchi trovati online.",
          "Puoi organizzare la borsa in tre gruppi: per te, documenti e cambi del neonato. La checklist “Preparare la borsa per il parto” raccoglie gli stessi dettagli; nessun acquisto è obbligatorio."
        ]
      },
      {
        "heading": "Per te: abbigliamento e comfort",
        "paragraphs": [
          "2–3 camicie da notte aperte sul davanti, a mezza manica oppure con maniche lunghe ampie. L’apertura può rendere più comodo l’allattamento; maniche ampie o corte lasciano più libero il braccio per un eventuale accesso venoso. Il documento ricorda che nei reparti riscaldati può fare caldo anche in inverno: adatta i capi alla temperatura effettiva.",
          "Mutandine assorbenti post parto. Il documento le preferisce alle mutande a rete con assorbente: scegli la soluzione più comoda per te, secondo le indicazioni della struttura. Cita anche mutande o assorbenti rinfrescanti, da verificare con il personale prima dell’uso.",
          "Vestaglia con maniche ampie o senza polsini elastici; pantofole comode, possibilmente con plantare integrato, e infradito per la doccia."
        ]
      },
      {
        "heading": "Beauty e oggetti personali",
        "paragraphs": [
          "Nel beauty: spazzolino e dentifricio, detergente intimo, asciugamani usa e getta, accappatoio in microfibra, burrocacao, shampoo, balsamo e bagnodoccia in formato mini.",
          "Per i capelli e il comfort personale: elastici, mollettine, spazzola e, se la usi, acqua termale. Scegli prodotti che già tolleri e verifica eventuali indicazioni del reparto.",
          "Caricabatterie con filo lungo: le prese possono essere distanti dal letto. Il documento propone anche frutta secca o una barretta energizzante; verifica con l’équipe se e quando puoi mangiare, tenendo conto delle tue esigenze e di eventuali allergie."
        ]
      },
      {
        "heading": "Accessori facoltativi da valutare",
        "paragraphs": [
          "Il documento cita conchiglie raccoglilatte. Non sono indispensabili per tutte: se desideri usarle, chiedi indicazioni su utilità, igiene e modalità d’uso a chi ti segue nell’allattamento.",
          "Sono citati anche olio essenziale di lavanda o neroli, idrolato di lavanda “per mamma e bimbo” e idrolato di elicriso “GE mamma”. La sigla GE non è spiegata nel documento.",
          "Questa citazione non è un’indicazione d’uso: non applicare oli essenziali o idrolati sul neonato senza una specifica indicazione sanitaria. Prima di usarli per te o nell’ambiente del reparto, confrontati con il personale sanitario."
        ]
      },
      {
        "heading": "Documenti da tenere insieme",
        "paragraphs": [
          "Tessera sanitaria e carta d’identità.",
          "Ultime due ecografie refertate, referto della visita anestesiologica, ECG e ultimi esami ematici, se già effettuati e richiesti dalla struttura.",
          "Referto del gruppo sanguigno e risultati dei tamponi vagino-rettali, se eseguiti. Il documento parla di gruppo sanguigno “della struttura in cui si partorisce”: chiedi quali referti vengono accettati e se occorrono adempimenti specifici, senza dare per necessario ripetere un esame."
        ]
      },
      {
        "heading": "La borsa del neonato",
        "paragraphs": [
          "4–5 cambi, da adattare alla lista del punto nascita e alla stagione. Prepara ogni cambio in una bustina separata con nome e cognome del bambino, secondo le modalità richieste dalla struttura.",
          "Ogni cambio può comprendere un body, preferibilmente con apertura a kimono, maglietta e pantalone oppure una tutina in cotone, calzini e cappellino. Verifica quali capi sono effettivamente richiesti.",
          "Aggiungi una copertina o una mussola, se indicata dalla struttura."
        ]
      },
      {
        "heading": "Una preparazione condivisa",
        "paragraphs": [
          "Annota chi può recuperare eventuali oggetti dimenticati e come gestire le necessità pratiche a casa. Il partner può occuparsene senza accedere a documenti sanitari riservati.",
          "Puoi tenere pronta una lista degli oggetti da aggiungere all’ultimo momento, come caricatore e occhiali. Non è necessario completare tutto in una sola giornata.",
          "La borsa sostiene l’organizzazione, ma non misura quanto sei pronta alla nascita. Le competenze genitoriali non dipendono dal numero di cose acquistate."
        ]
      }
    ],
    "references": [
      {
        "label": "Lettura di approfondimento: NHS — Labour and birth",
        "url": "https://www.nhs.uk/pregnancy/labour-and-birth/"
      }
    ],
    "slug": "borsa-parto",
    "readingMinutes": 4,
    "publishedAt": null,
    "reviewedAt": null,
    "reviewerName": null,
    "status": "draft",
    "approved": false,
    "isDemo": true,
    "videoUrl": null
  },
  {
    "id": "da47ec24-9a52-53c9-809c-be22d007a6d5",
    "title": "Esserci: il partner durante il travaglio",
    "subtitle": "Ascolto, presenza e piccoli gesti per accompagnare rispettando desideri e riservatezza.",
    "categoryId": "partner",
    "stage": "pregnancy",
    "weekFrom": 24,
    "weekTo": 43,
    "imageUrl": "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=1200&q=80",
    "sections": [
      {
        "heading": "Chiedere, prima di fare",
        "paragraphs": [
          "La persona che accompagna non deve conoscere tutte le risposte. Può cominciare chiedendo quali gesti sono graditi e quali, invece, diventano invadenti.",
          "Un bisogno può cambiare nel tempo: silenzio, parole, contatto o spazio. Chiedere di nuovo con semplicità permette di adattare la presenza senza interpretare ogni comportamento.",
          "Concordate prima quali informazioni sanitarie possono essere condivise. Essere partner non dà automaticamente diritto a ricevere o raccontare dettagli privati."
        ]
      },
      {
        "heading": "Collaborare con l’équipe",
        "paragraphs": [
          "Chiedete al punto nascita come viene organizzata la presenza dell’accompagnatore. È utile conoscere anche le indicazioni pratiche di accesso, cambio e permanenza.",
          "Il partner può aiutare a ricordare una domanda o chiedere una spiegazione, rispettando la voce e le decisioni della persona assistita. Non assume il ruolo del professionista.",
          "Se non capisci una proposta, puoi chiedere di ripeterla con parole più chiare. Nelle situazioni urgenti segui le indicazioni dell’équipe presente."
        ]
      },
      {
        "heading": "Anche dopo la nascita",
        "paragraphs": [
          "Accompagnare continua nelle attività quotidiane: organizzare il rientro, comunicare con i familiari, preparare qualcosa da mangiare o proteggere un momento di riposo.",
          "Anche il partner può cercare uno spazio di ascolto e fare domande. Chiedere sostegno permette di partecipare senza pretendere di reggere ogni cosa da soli.",
          "Non c’è un modello unico di famiglia: la persona di fiducia può essere un partner, un’amica, un familiare o un’altra figura scelta."
        ]
      }
    ],
    "references": [
      {
        "label": "Lettura di approfondimento: NHS — Labour and birth",
        "url": "https://www.nhs.uk/pregnancy/labour-and-birth/"
      }
    ],
    "slug": "partner-travaglio",
    "readingMinutes": 3,
    "authorName": "Redazione Nido · esempio",
    "authorRole": "Contenuto dimostrativo, da revisionare",
    "publishedAt": null,
    "reviewedAt": null,
    "reviewerName": null,
    "status": "draft",
    "approved": false,
    "isDemo": true,
    "videoUrl": null
  },
  {
    "id": "dff71411-d7dc-53fd-8fa2-39950960abc3",
    "title": "Le fasi del travaglio: parole per orientarsi",
    "subtitle": "Conoscere il linguaggio dell’assistenza aiuta a fare domande, senza prevedere tempi o percorsi individuali.",
    "categoryId": "birth",
    "stage": "pregnancy",
    "weekFrom": 28,
    "weekTo": 43,
    "imageUrl": "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=80",
    "sections": [
      {
        "heading": "Una mappa, non un cronometro",
        "paragraphs": [
          "Nei racconti sulla nascita si incontrano parole come fase iniziale, dilatazione, nascita e secondamento. Sono termini che l’équipe può spiegare nel contesto della tua assistenza.",
          "Una suddivisione in fasi serve a descrivere il processo, non a fissare il tempo che dovresti impiegare. Il tuo percorso richiede osservazione e valutazione professionale.",
          "Questo testo dimostrativo non aiuta a riconoscere il travaglio né a decidere quando recarsi in ospedale. Per questi aspetti segui le indicazioni del servizio che ti accompagna."
        ]
      },
      {
        "heading": "Capire le proposte",
        "paragraphs": [
          "Durante l’assistenza puoi chiedere che cosa sta accadendo e qual è lo scopo di una valutazione o di una proposta. Usa parole tue, anche se non conosci i termini tecnici.",
          "Prima della nascita può essere utile informarsi su come il servizio presenta le opzioni di sostegno e sollievo dal dolore. Le possibilità vanno discusse individualmente.",
          "Un piano può cambiare. Avere spiegazioni comprensibili aiuta a partecipare alle decisioni senza dover avere studiato ogni possibile scenario."
        ]
      },
      {
        "heading": "Tenere vicini i contatti",
        "paragraphs": [
          "Conserva le istruzioni e i recapiti forniti dal punto nascita, distinguendo gli appuntamenti dai contatti per necessità non programmate.",
          "Se hai una preoccupazione urgente per la tua salute o quella del bambino, contatta immediatamente i servizi sanitari appropriati. Non attendere una risposta dall’app.",
          "Non confrontare la tua situazione con storie lette online per decidere se chiedere aiuto: una conversazione diretta con il servizio è il riferimento appropriato."
        ]
      }
    ],
    "references": [
      {
        "label": "Lettura di approfondimento: NHS — Labour and birth",
        "url": "https://www.nhs.uk/pregnancy/labour-and-birth/"
      }
    ],
    "slug": "fasi-travaglio",
    "readingMinutes": 3,
    "authorName": "Redazione Nido · esempio",
    "authorRole": "Contenuto dimostrativo, da revisionare",
    "publishedAt": null,
    "reviewedAt": null,
    "reviewerName": null,
    "status": "draft",
    "approved": false,
    "isDemo": true,
    "videoUrl": null
  },
  {
    "id": "dac5c987-94d1-5b1a-a880-86e8144f58f1",
    "title": "I primi giorni: conoscersi, con calma",
    "subtitle": "Piccoli accordi e una rete di aiuto per lasciare spazio alla nuova quotidianità.",
    "categoryId": "home",
    "stage": "postpartum",
    "weekFrom": 0,
    "weekTo": 4,
    "imageUrl": "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1200&q=80",
    "sections": [
      {
        "heading": "Organizzare l’essenziale",
        "paragraphs": [
          "Il rientro può portare domande molto pratiche. Tenere insieme appuntamenti, contatti e indicazioni ricevute alla dimissione evita di dover cercare tutto in un momento impegnativo.",
          "Puoi preparare una piccola zona con gli oggetti di uso quotidiano, rispettando le indicazioni professionali sulla sicurezza. Una casa pronta non deve essere una casa perfetta.",
          "Se qualcosa nelle istruzioni non è chiaro, chiedi al servizio di rispiegarlo prima del rientro o contattalo dopo. L’app non verifica le condizioni del neonato."
        ]
      },
      {
        "heading": "Un aiuto che risponde ai bisogni",
        "paragraphs": [
          "Alle persone vicine puoi proporre compiti precisi: portare un pasto, fare una commissione, occuparsi del bucato o accompagnare a un incontro.",
          "Decidete insieme come gestire visite e messaggi. Potete cambiare gli accordi quando avete bisogno di più tranquillità, senza dover dare spiegazioni dettagliate.",
          "Chi sostiene la famiglia può chiedere di cosa c’è bisogno prima di offrire consigli. Stare accanto significa anche rispettare scelte e tempi diversi dai propri."
        ]
      },
      {
        "heading": "A chi rivolgersi",
        "paragraphs": [
          "Individua i contatti del pediatra, dell’ostetrica, del consultorio e dei servizi che avete scelto. Chiedi quali canali usare per dubbi ordinari e per urgenze.",
          "Nido propone contenuti educativi, ma non è un canale di assistenza o monitoraggio. Se una preoccupazione è urgente, rivolgiti subito al servizio sanitario appropriato.",
          "Chiedere aiuto pratico o professionale fa parte della costruzione di una rete. Non occorre aspettare di sentirsi senza risorse per cercare un confronto."
        ]
      }
    ],
    "references": [
      {
        "label": "Lettura di approfondimento: NHS — After the birth",
        "url": "https://www.nhs.uk/pregnancy/labour-and-birth/after-the-birth/"
      }
    ],
    "slug": "primi-giorni",
    "readingMinutes": 3,
    "authorName": "Redazione Nido · esempio",
    "authorRole": "Contenuto dimostrativo, da revisionare",
    "publishedAt": null,
    "reviewedAt": null,
    "reviewerName": null,
    "status": "draft",
    "approved": false,
    "isDemo": true,
    "videoUrl": null
  },
  {
    "id": "5d6c424c-0e90-56af-9efb-362430db3d27",
    "title": "Messaggio di nascita per amici e parenti",
    "authorName": "Dott.sa Gaia",
    "authorRole": "Autrice del documento originale",
    "subtitle": "Un testo da personalizzare per condividere la gioia e organizzare le prime visite a casa.",
    "categoryId": "home",
    "stage": "postpartum",
    "weekFrom": 0,
    "weekTo": 6,
    "imageUrl": "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1200&q=80",
    "sections": [
      {
        "heading": "Un annuncio con i vostri tempi",
        "paragraphs": [
          "Il documento “messaggio nascita.docx” propone un messaggio che il papà può inviare ad amici e parenti per condividere il momento felice e concordare le prime visite a casa.",
          "Qui trovi il testo completo. Puoi selezionarlo per copiarlo e adattarlo alla tua famiglia prima di condividerlo."
        ]
      },
      {
        "heading": "Il messaggio da personalizzare",
        "paragraphs": [
          "Ciao a tutti!\n\nIl nostro piccolo è finalmente arrivato e siamo felicissimi di condividere con voi questa gioia immensa!\n\nPer goderci al meglio questi primi giorni insieme e prenderci cura del nostro cucciolo, ecco qualche piccolo accorgimento che vi chiediamo qualora voleste venirci a trovare a casa.\n\nPrima di venire a trovarci, contattate il papà per organizzarci al meglio. La mamma ha bisogno di riposare e recuperare le energie. Per rispettare i suoi tempi, quelli del nostro piccolo e per potere rendere unico il primo incontro con voi, avremmo bisogno di sapere quando vorrete venire a trovarci.\n\nLavarsi bene le mani appena si entra in casa.\n\nSe possibile, togliersi le scarpe all'ingresso.\n\nEvitare di baciare il piccolo sul viso, sulle mani e sui piedini.\n\nSappiamo che non vedete l'ora di conoscerlo e di riempirlo di coccole, e anche noi di costruire nuovi ricordi insieme a voi.\n\nUn abbraccio grande a tutti e a prestissimo!"
        ]
      },
      {
        "heading": "Prima di condividerlo",
        "paragraphs": [
          "Potete adattare “papà”, “mamma” e “piccolo” alle persone, ai nomi e alle parole che usate in famiglia. Concordate insieme chi farà da riferimento per organizzare gli incontri.",
          "Rileggete il messaggio e scegliete le richieste che desiderate comunicare. Potete aggiornare gli accordi sulle visite secondo le vostre esigenze e i vostri tempi."
        ]
      }
    ],
    "references": [],
    "slug": "messaggio-nascita",
    "readingMinutes": 3,
    "publishedAt": null,
    "reviewedAt": null,
    "reviewerName": null,
    "status": "draft",
    "approved": false,
    "isDemo": true,
    "videoUrl": null
  },
  {
    "id": "5fd506cc-ccf5-5484-8a9b-b166ea3df5ed",
    "title": "Sonno sicuro del neonato",
    "authorName": "Dott.sa Gaia",
    "authorRole": "Autrice del documento originale · adattamento Nido",
    "subtitle": "Dieci indicazioni per preparare un ambiente di riposo sicuro, di giorno e di notte.",
    "categoryId": "home",
    "stage": "postpartum",
    "weekFrom": 0,
    "weekTo": 52,
    "imageUrl": "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1200&q=80",
    "sections": [
      {
        "heading": "Il riposo e l’ambiente che lo accoglie",
        "paragraphs": [
          "Questa guida riorganizza il documento “sonno sicuro.docx” condiviso per Nido. È un contenuto educativo da revisionare, da discutere con il pediatra o con i professionisti che seguono il bambino.",
          "Il sonno accompagna la crescita e lo sviluppo del neonato. Preparare un ambiente di riposo adatto aiuta a ridurre il rischio di SIDS, la morte improvvisa del lattante, senza poterlo azzerare."
        ]
      },
      {
        "heading": "1. Adagialo sempre sulla schiena",
        "paragraphs": [
          "Metti il bambino a dormire in posizione supina, cioè a pancia in su. Vale per ogni sonnellino, sia di giorno sia di notte."
        ]
      },
      {
        "heading": "2. Scegli un materasso rigido e piano",
        "paragraphs": [
          "Usa un materasso stabile, piano e adatto alla culla o al lettino. Evita superfici morbide, inclinate o improvvisate."
        ]
      },
      {
        "heading": "3. Lascia il lettino libero",
        "paragraphs": [
          "Nella culla non mettere cuscini, peluche, paracolpi, coperte morbide, riduttori o altri accessori che possano ostacolare la respirazione. Il lenzuolo con angoli deve aderire bene al materasso."
        ]
      },
      {
        "heading": "4. Stessa stanza, superficie separata",
        "paragraphs": [
          "Tieni la culla nella camera dei genitori almeno per i primi sei mesi e, se possibile, per il primo anno. Il bambino deve avere una superficie di riposo separata e sicura."
        ]
      },
      {
        "heading": "5. Proteggilo dal fumo e dalla sonnolenza degli adulti",
        "paragraphs": [
          "Evita il fumo durante la gravidanza e dopo la nascita, e proteggi il bambino dal fumo passivo. Alcol, droghe e farmaci che provocano sonnolenza rendono particolarmente pericoloso condividere il letto: la superficie separata resta l’indicazione di riferimento anche in loro assenza.",
          "Non addormentarti con il neonato su un divano o una poltrona: non sono superfici adatte al suo sonno."
        ]
      },
      {
        "heading": "6. Evita il surriscaldamento",
        "paragraphs": [
          "Mantieni la stanza a una temperatura confortevole, vesti il bambino in modo adeguato e non coprirgli la testa durante il sonno.",
          "Il documento indica orientativamente 19–21 °C. È un riferimento del testo, non una soglia universale: confronta le indicazioni sull’ambiente e sull’abbigliamento con chi segue il bambino."
        ]
      },
      {
        "heading": "7. Scegli un sacco nanna della misura corretta",
        "paragraphs": [
          "Un sacco nanna adatto alla taglia, senza pesi, permette di tenere caldo il bambino evitando coperte libere vicino al viso. Il lenzuolo del materasso deve essere ben aderente; lascia bocca e naso liberi."
        ]
      },
      {
        "heading": "8. Sostegno all’allattamento, senza giudizi",
        "paragraphs": [
          "L’allattamento al seno è associato a una riduzione del rischio di SIDS. Se desideri allattare, chiedi sostegno a un’ostetrica o a un professionista qualificato. Ogni famiglia merita supporto senza giudizi e le regole dell’ambiente sicuro valgono qualunque sia l’alimentazione scelta."
        ]
      },
      {
        "heading": "9. Attenzione al sonno fuori dal lettino",
        "paragraphs": [
          "Seggiolini auto, sdraiette, passeggini, fasce e marsupi non sono tutti progettati per il sonno. Se il bambino si addormenta in un dispositivo non adatto a dormire, trasferiscilo appena possibile e in sicurezza su una superficie piana adatta, adagiandolo sulla schiena.",
          "Durante il viaggio usa sempre il seggiolino auto omologato: effettua il trasferimento quando è possibile farlo in sicurezza, mai mentre il veicolo è in movimento."
        ]
      },
      {
        "heading": "10. Succhietto e vaccinazioni",
        "paragraphs": [
          "Il succhietto può essere proposto durante il sonno, senza forzare il bambino. Se allatti al seno, attendi che l’allattamento sia ben avviato e chiedi indicazioni a chi ti segue. Se il bambino lo rifiuta, non insistere; durante il sonno evita cordini e accessori.",
          "Segui il calendario vaccinale raccomandato con il pediatra. Succhietto, vaccinazioni e allattamento non sostituiscono le regole dell’ambiente di riposo."
        ]
      },
      {
        "heading": "Accompagnarlo al sonno con calma",
        "paragraphs": [
          "Impara a riconoscere segnali di stanchezza come sbadigli, sguardo distolto o irritabilità. Una routine semplice, con luci soffuse e pochi stimoli, può accompagnare il momento della nanna.",
          "Parlagli dolcemente e offrigli contatto, coccole e rassicurazione durante la veglia, rispettando i suoi bisogni. I risvegli notturni sono normali nei primi mesi di vita.",
          "La vicinanza emotiva e il sonno sicuro possono convivere: dopo averlo consolato, allattato o coccolato, rimettilo nella sua culla, sulla schiena, quando è il momento di dormire."
        ]
      },
      {
        "heading": "Una nota sugli oli essenziali",
        "paragraphs": [
          "Il documento propone anche l’uso di olio essenziale di lavanda in un diffusore. Questa guida non lo presenta come una misura di sonno sicuro e non riporta dosi o tempi d’uso. Prima di usare oli essenziali o diffusori nella stanza di un neonato, confrontati con il pediatra."
        ]
      },
      {
        "heading": "Un messaggio per i genitori",
        "paragraphs": [
          "La SIDS è un evento raro ma molto doloroso. Nessuna singola misura può eliminare completamente il rischio; seguire le indicazioni per il sonno sicuro aiuta a ridurlo.",
          "Non serve essere genitori perfetti. Conoscere le regole principali e condividerle con chi si prende cura del bambino può aiutare a organizzare la nanna con maggiore consapevolezza."
        ]
      }
    ],
    "references": [],
    "slug": "sonno-sicuro",
    "readingMinutes": 4,
    "publishedAt": null,
    "reviewedAt": null,
    "reviewerName": null,
    "status": "draft",
    "approved": false,
    "isDemo": true,
    "videoUrl": null
  },
  {
    "id": "b20e5513-513b-5871-95d3-61f261277b98",
    "title": "Il puerperio: dare spazio al recupero",
    "subtitle": "Un tempo da attraversare con sostegno, informazioni e aspettative rispettose.",
    "categoryId": "recovery",
    "stage": "postpartum",
    "weekFrom": 0,
    "weekTo": 12,
    "imageUrl": "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80",
    "sections": [
      {
        "heading": "Il corpo non ha una scadenza",
        "paragraphs": [
          "Il recupero dopo una nascita è personale. Fotografie e racconti sui social non indicano come dovrebbe essere il tuo corpo né quali attività siano adatte a te.",
          "Alla dimissione chiedi istruzioni scritte e comprensibili sulle cure e sui controlli previsti. Le indicazioni dipendono dal percorso di nascita e dalla tua situazione.",
          "Questo esempio non suggerisce esercizi, trattamenti o tempi di ripresa. Per iniziare o modificare attività dopo il parto serve un confronto con il professionista che ti segue."
        ]
      },
      {
        "heading": "Semplificare la giornata",
        "paragraphs": [
          "Quando possibile, riduci gli impegni non essenziali e condividi i compiti. Una richiesta concreta può essere più semplice da accogliere di un generico invito ad aiutare.",
          "Prevedere pasti semplici, commissioni condivise e momenti senza visite può creare spazio per le tue esigenze. L’organizzazione è un sostegno, non un’altra prova da superare.",
          "Se non hai una rete vicina, chiedi al consultorio o ai servizi territoriali quali risorse sono disponibili. Le opportunità variano secondo il luogo in cui vivi."
        ]
      },
      {
        "heading": "Portare le domande al controllo",
        "paragraphs": [
          "Puoi annotare domande sul recupero fisico, sulla sessualità, sull’alimentazione e sul benessere emotivo. Sono temi da poter discutere con rispetto e riservatezza.",
          "Non utilizzare la data del parto come unica misura di ciò che dovresti riuscire a fare. Il confronto individuale aiuta a definire il percorso appropriato per te.",
          "Per una preoccupazione sanitaria urgente, contatta subito i servizi appropriati. Non aspettare il controllo programmato o una conferma da un contenuto online."
        ]
      }
    ],
    "references": [
      {
        "label": "Lettura di approfondimento: NHS — After the birth",
        "url": "https://www.nhs.uk/pregnancy/labour-and-birth/after-the-birth/"
      }
    ],
    "slug": "recupero-puerperio",
    "readingMinutes": 3,
    "authorName": "Redazione Nido · esempio",
    "authorRole": "Contenuto dimostrativo, da revisionare",
    "publishedAt": null,
    "reviewedAt": null,
    "reviewerName": null,
    "status": "draft",
    "approved": false,
    "isDemo": true,
    "videoUrl": null
  },
  {
    "id": "ac1d4df3-08d8-5b4d-9f49-5148c0950740",
    "title": "Le prime poppate: imparare insieme",
    "subtitle": "Un invito a osservare, fare domande e cercare sostegno senza giudizi.",
    "categoryId": "breastfeeding",
    "stage": "postpartum",
    "weekFrom": 0,
    "weekTo": 8,
    "imageUrl": "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1200&q=80",
    "sections": [
      {
        "heading": "Partire dai tuoi desideri",
        "paragraphs": [
          "Se desideri allattare al seno, puoi parlarne con l’ostetrica o con il servizio che ti accompagna. Le tue domande meritano ascolto, anche se il percorso è diverso da come lo immaginavi.",
          "Le prime esperienze possono richiedere un confronto pratico con una persona qualificata. Un articolo non può osservare una poppata, valutare il bambino o proporre un piano individuale.",
          "Nido non misura la quantità di latte, non valuta la crescita e non sostituisce gli incontri con i professionisti. Le indicazioni personali restano affidate al servizio che vi segue."
        ]
      },
      {
        "heading": "Preparare domande utili",
        "paragraphs": [
          "Puoi chiedere a chi rivolgerti per osservare insieme una poppata e come organizzare il supporto dopo il rientro. È utile conoscere recapiti e modalità di accesso prima di averne bisogno.",
          "Se hai dolore, dubbi sull’alimentazione o preoccupazioni per il bambino, chiedi una valutazione professionale. Non cercare di confermare una difficoltà confrontando fotografie o descrizioni online.",
          "Questo contenuto non propone posizioni obbligatorie, frequenze personalizzate o rimedi. Ogni indicazione va contestualizzata da chi può conoscere la vostra situazione."
        ]
      },
      {
        "heading": "Una rete che sostiene",
        "paragraphs": [
          "Il partner o una persona vicina può aiutare occupandosi delle attività quotidiane, facilitando gli appuntamenti o proteggendo uno spazio tranquillo quando lo desideri.",
          "Il modo di alimentare il bambino non definisce il valore di un genitore. È possibile cercare sostegno rispettoso anche quando desideri riconsiderare un percorso.",
          "Le letture indicate sono materiali generali di approfondimento. Questo testo è dimostrativo e richiede revisione professionale prima dell’uso come contenuto editoriale di produzione."
        ]
      }
    ],
    "references": [
      {
        "label": "Lettura di approfondimento: NHS — Feeding your baby",
        "url": "https://www.nhs.uk/conditions/baby/breastfeeding-and-bottle-feeding/"
      },
      {
        "label": "Lettura di approfondimento: OMS — Breastfeeding",
        "url": "https://www.who.int/health-topics/breastfeeding"
      }
    ],
    "slug": "prime-poppate",
    "readingMinutes": 3,
    "authorName": "Redazione Nido · esempio",
    "authorRole": "Contenuto dimostrativo, da revisionare",
    "publishedAt": null,
    "reviewedAt": null,
    "reviewerName": null,
    "status": "draft",
    "approved": false,
    "isDemo": true,
    "videoUrl": null
  },
  {
    "id": "f348f47f-82b4-5c1d-bc2d-84a5a045e03b",
    "title": "Allattamento: chiedere sostegno è un primo passo",
    "subtitle": "Come trovare un riferimento e preparare una richiesta di aiuto chiara.",
    "categoryId": "breastfeeding",
    "stage": "postpartum",
    "weekFrom": 0,
    "weekTo": 52,
    "imageUrl": "https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?auto=format&fit=crop&w=1200&q=80",
    "sections": [
      {
        "heading": "Non serve aspettare",
        "paragraphs": [
          "Puoi chiedere supporto per una domanda, per una difficoltà o semplicemente per capire meglio il percorso. Non devi dimostrare che il problema sia abbastanza importante.",
          "Dolore, preoccupazioni sull’alimentazione o dubbi sul benessere del bambino richiedono un confronto con un professionista. L’app non riconosce né classifica questi segnali.",
          "Se la tua preoccupazione è urgente, rivolgiti immediatamente ai servizi sanitari appropriati. Non aspettare la risposta di un gruppo online o un appuntamento ordinario."
        ]
      },
      {
        "heading": "Trovare il contatto giusto",
        "paragraphs": [
          "Il consultorio, l’ostetrica, il pediatra o il servizio della tua zona possono indicare come accedere a un sostegno qualificato. Chiedi quali sono le competenze della persona a cui ti rivolgi.",
          "Quando contatti il servizio, puoi dire qual è la domanda che vuoi affrontare e chiedere tempi e modalità della valutazione. Condividi informazioni sanitarie soltanto attraverso canali appropriati.",
          "Se il primo canale non è disponibile, chiedi quale alternativa utilizzare. La rete varia da un territorio all’altro: Nido non offre prenotazione, chat clinica o assistenza in tempo reale."
        ]
      },
      {
        "heading": "Portare la tua esperienza",
        "paragraphs": [
          "Le tue preferenze, la vita quotidiana e il sostegno disponibile fanno parte della conversazione. Puoi chiedere che ogni proposta sia spiegata senza giudizi o pressioni.",
          "Dopo l’incontro, verifica di aver compreso il piano concordato e quando ricontattare il professionista. Se un’indicazione non è chiara, è appropriato chiedere di rispiegarla.",
          "Un percorso può cambiare. Il supporto dovrebbe aiutare a prendere decisioni informate nella tua situazione, senza misurare il valore della tua esperienza con un unico risultato."
        ]
      }
    ],
    "references": [
      {
        "label": "Lettura di approfondimento: NHS — Feeding your baby",
        "url": "https://www.nhs.uk/conditions/baby/breastfeeding-and-bottle-feeding/"
      },
      {
        "label": "Lettura di approfondimento: OMS — Breastfeeding",
        "url": "https://www.who.int/health-topics/breastfeeding"
      }
    ],
    "slug": "supporto-allattamento",
    "readingMinutes": 3,
    "authorName": "Redazione Nido · esempio",
    "authorRole": "Contenuto dimostrativo, da revisionare",
    "publishedAt": null,
    "reviewedAt": null,
    "reviewerName": null,
    "status": "draft",
    "approved": false,
    "isDemo": true,
    "videoUrl": null
  },
  {
    "id": "390f534c-5d8f-5f4c-bd83-dd472c857a8c",
    "title": "Alimentare il neonato: percorsi diversi",
    "subtitle": "Informazioni e sostegno rispettosi, qualunque sia il percorso della tua famiglia.",
    "categoryId": "feeding",
    "stage": "postpartum",
    "weekFrom": 0,
    "weekTo": 26,
    "imageUrl": "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=1200&q=80",
    "sections": [
      {
        "heading": "Una conversazione senza etichette",
        "paragraphs": [
          "Le famiglie possono avere esperienze diverse di alimentazione del neonato. Il sostegno professionale parte dalla situazione del bambino, dalle esigenze della famiglia e da informazioni comprensibili.",
          "Puoi scegliere in Nido quali argomenti desideri leggere, senza dichiarare come alimenti il bambino. Questa scelta serve a organizzare la biblioteca, non a fornire consigli clinici personalizzati.",
          "Le preferenze non sostituiscono una valutazione del pediatra o di altri professionisti. L’app non calcola quantità, intervalli, crescita o adeguatezza dell’alimentazione."
        ]
      },
      {
        "heading": "Chiedere istruzioni appropriate",
        "paragraphs": [
          "Per latte formulato, latte estratto o un percorso misto, chiedi indicazioni specifiche su preparazione, conservazione e utilizzo ai professionisti e alle fonti ufficiali pertinenti.",
          "Non modificare diluizioni o modalità di preparazione sulla base di suggerimenti informali. Questo esempio non contiene istruzioni operative per preparare o somministrare alimenti.",
          "Se hai ricevuto indicazioni diverse, chiedi al professionista di chiarirle nel vostro contesto. Annotare la domanda aiuta a portare il dubbio alla persona che può valutarlo."
        ]
      },
      {
        "heading": "Proteggere uno spazio di fiducia",
        "paragraphs": [
          "Commenti e confronti possono rendere difficile parlare delle proprie esigenze. Puoi chiedere alle persone vicine di rispettare le decisioni concordate con i professionisti.",
          "Chi ti sostiene può aiutare nelle attività pratiche e nell’organizzare gli incontri, senza sostituirsi alle indicazioni ricevute. Non occorre giustificare ogni scelta ai conoscenti.",
          "Se temi che il bambino non stia bene, contatta l’assistenza sanitaria. Per preoccupazioni urgenti chiedi aiuto immediato: leggere altri articoli non è un passaggio necessario."
        ]
      }
    ],
    "references": [
      {
        "label": "Lettura di approfondimento: NHS — Feeding your baby",
        "url": "https://www.nhs.uk/conditions/baby/breastfeeding-and-bottle-feeding/"
      }
    ],
    "slug": "percorsi-alimentazione",
    "readingMinutes": 3,
    "authorName": "Redazione Nido · esempio",
    "authorRole": "Contenuto dimostrativo, da revisionare",
    "publishedAt": null,
    "reviewedAt": null,
    "reviewerName": null,
    "status": "draft",
    "approved": false,
    "isDemo": true,
    "videoUrl": null
  },
  {
    "id": "74567acc-d69e-5ab6-8391-ddd0ad5b8abd",
    "title": "Dopo la nascita, anche tu hai bisogno di cura",
    "subtitle": "Dare voce alle emozioni e conoscere le persone a cui chiedere sostegno.",
    "categoryId": "wellbeing",
    "stage": "postpartum",
    "weekFrom": 0,
    "weekTo": 52,
    "imageUrl": "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1200&q=80",
    "sections": [
      {
        "heading": "Fare posto alle emozioni",
        "paragraphs": [
          "Dopo la nascita possono esserci emozioni diverse da quelle immaginate. Non è necessario mostrarsi sempre felici o disponibili per meritare ascolto.",
          "Questo articolo non distingue una condizione clinica da un’esperienza emotiva. Se ciò che provi ti preoccupa, parlane con il professionista o con il servizio di salute mentale della tua zona.",
          "Nido non propone questionari diagnostici o punteggi di rischio. Le parole che usi per raccontarti sono un punto di partenza per una conversazione, non un risultato da interpretare nell’app."
        ]
      },
      {
        "heading": "Rendere concreto il sostegno",
        "paragraphs": [
          "Puoi iniziare dicendo a una persona fidata: “Ho bisogno che mi ascolti” oppure “Vorrei aiuto per contattare un professionista”. Non serve trovare una spiegazione perfetta.",
          "Chiedere un aiuto pratico può alleggerire un compito, ma non sostituisce il sostegno sanitario quando ne hai bisogno. I due livelli possono essere presenti insieme.",
          "Anche il partner e gli altri genitori possono chiedere ascolto per le proprie emozioni. Le reti familiari e i servizi territoriali possono offrire punti di contatto differenti."
        ]
      },
      {
        "heading": "Quando la preoccupazione è urgente",
        "paragraphs": [
          "Se temi per la tua sicurezza o quella di un’altra persona, o pensi di poter fare del male a te o al bambino, contatta immediatamente i servizi sanitari di emergenza del luogo in cui ti trovi.",
          "Se puoi farlo in sicurezza, chiedi a una persona fidata di restare con te e aiutarti a raggiungere l’assistenza. Non attendere una risposta dall’app, che non è monitorata.",
          "I numeri e i servizi dipendono dal Paese: verifica i contatti locali. Questa indicazione non è una valutazione della tua situazione e non deve ritardare la richiesta di aiuto."
        ]
      }
    ],
    "references": [
      {
        "label": "Lettura di approfondimento: NHS — Postnatal depression",
        "url": "https://www.nhs.uk/mental-health/conditions/post-natal-depression/overview/"
      },
      {
        "label": "Lettura di approfondimento: NHS — After the birth",
        "url": "https://www.nhs.uk/pregnancy/labour-and-birth/after-the-birth/"
      }
    ],
    "slug": "benessere-emotivo",
    "readingMinutes": 3,
    "authorName": "Redazione Nido · esempio",
    "authorRole": "Contenuto dimostrativo, da revisionare",
    "publishedAt": null,
    "reviewedAt": null,
    "reviewerName": null,
    "status": "draft",
    "approved": false,
    "isDemo": true,
    "videoUrl": null
  }
]$maia_recovery_documents$::jsonb;
  document jsonb;
  inserted_article_id uuid;
  ref jsonb;
begin
  for document in select value from jsonb_array_elements(documents)
  loop
    inserted_article_id := null;
    insert into public.articles(
      id,slug,category_id,author_id,status,approved,is_demo,payload
    ) values (
      (document->>'id')::uuid, document->>'slug', document->>'categoryId',
      null, 'draft', false, true, document
    )
    on conflict do nothing
    returning id into inserted_article_id;

    -- Nessun aggiornamento o sostituzione di fonti per letture gia esistenti.
    if inserted_article_id is null then continue; end if;
    for ref in select value from jsonb_array_elements(document->'references')
    loop
      insert into public.article_references(article_id,label,url)
      values(inserted_article_id,ref->>'label',ref->>'url');
    end loop;
  end loop;
end;
$maia_recovery$;

alter table public.articles enable trigger articles_validate;
commit;

-- Verifica finale: l'importazione non rende visibili le bozze agli iscritti.
select
  count(*) as articoli_totali,
  count(*) filter (where status='draft') as bozze,
  count(*) filter (
    where status='published' and approved and not is_demo
  ) as visibili_sul_sito
from public.articles;
