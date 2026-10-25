import type { SiteProfile } from "./professional";

// Editorial source: “filosofia di MetiMaia”, supplied on 25 October 2026.
// Existing profile columns hold the project introduction, meaning/symbol,
// stages and philosophy, without a schema change.
export const gaiaPresentation = {
  bio: "Ogni nascita dà inizio a un nuovo viaggio. Insieme, è più bello.\n\nMetiMaia è uno spazio dedicato alle famiglie, per accompagnarle dalla gravidanza alla nascita e nei primi anni di vita del bambino, attraverso informazioni affidabili, strumenti pratici e il sostegno della competenza ostetrica.\n\nUn luogo in cui trovare risposte, acquisire consapevolezza e sentirsi accompagnati in una delle trasformazioni più importanti della vita: diventare famiglia.\n\nBenvenuti in MetiMaia\n\nInizia un percorso fatto di emozioni, scoperte, domande e cambiamenti che coinvolgono tutti. La gravidanza, il parto, il post-partum e i primi anni di vita portano con sé nuove responsabilità, nuovi equilibri e un modo diverso di guardare al mondo.\n\nMetiMaia nasce dal desiderio di rendere questo percorso più consapevole e meno solitario, mettendo la conoscenza e la competenza ostetrica al servizio di mamme, papà, partner e di tutte le persone che partecipano alla crescita di un bambino.\n\nAttraverso contenuti basati sulle evidenze scientifiche, guide pratiche e strumenti utili nella quotidianità, vogliamo aiutare le famiglie a orientarsi, comprendere i propri bisogni e affrontare ogni fase con maggiore fiducia.\n\nPerché informare significa prendersi cura, e accompagnare significa esserci senza giudicare, rispettando la storia e le scelte di ogni famiglia.",
  qualifications:
    "Il significato di MetiMaia\n\nIl nome MetiMaia racchiude l’essenza della nostra visione: conoscenza, vita, crescita e condivisione.\n\nMeti richiama simbolicamente Meti (Metide), figura della mitologia greca associata alla saggezza, all’intelligenza pratica e alla capacità di trovare soluzioni. Rappresenta la competenza, la conoscenza scientifica e la consapevolezza necessarie per affrontare le domande e le sfide che accompagnano la genitorialità.\n\nMaia richiama la figura mitologica greca, madre di Ermes, e diventa simbolicamente espressione di maternità, vita e crescita. Rappresenta la trasformazione che coinvolge l’intera famiglia, che giorno dopo giorno costruisce nuovi legami, relazioni ed equilibri.\n\nInoltre «Με τη μαία» (me ti maía) significa letteralmente «con l'ostetrica». Nel nome trova spazio quindi anche il significato simbolico che esprime il cuore del progetto: esserci, camminare insieme e crescere insieme.\n\nIl fiore di loto: il simbolo di MetiMaia\n\nIl fiore di loto rappresenta l’anima del progetto. Affonda le sue radici nell’acqua e cresce lentamente verso la luce, fino a sbocciare in superficie. È un simbolo che richiama la vita, la trasformazione e la possibilità di crescere anche attraverso i momenti più complessi.\n\nLa nascita di un bambino trasforma profondamente non soltanto chi diventa genitore, ma l’intera famiglia, che impara a conoscersi, ad adattarsi e a trovare nuovi equilibri.\n\nPer MetiMaia, il loto rappresenta la possibilità di crescere, trasformarsi e sbocciare insieme.\n\nLe sue radici simboleggiano le basi su cui costruire: conoscenza, fiducia e sostegno. Il suo stelo rappresenta il percorso, con le sue tappe e i suoi cambiamenti. Il fiore che si apre richiama la crescita, la scoperta e la bellezza di una nuova vita che prende forma.\n\nOgni famiglia ha i propri tempi, ogni percorso è unico e ogni nascita porta con sé la possibilità di un nuovo inizio.\n\nCome il fiore di loto, possiamo crescere attraverso il cambiamento e trovare, passo dopo passo, il nostro modo di sbocciare.",
  service_area:
    "La nostra filosofia\n\nCrediamo che ogni famiglia meriti informazioni chiare, sostegno competente e uno spazio in cui sentirsi accolta senza giudizio.\n\nCrediamo nella conoscenza come strumento di libertà e consapevolezza, nella relazione come parte fondamentale della cura e nel rispetto delle scelte individuali.\n\nPer questo MetiMaia vuole offrire contenuti affidabili e aggiornati, collegati alle evidenze scientifiche, senza sostituirsi alla relazione con i professionisti sanitari, ma aiutando le famiglie a viverla in modo più consapevole.\n\nNon vogliamo proporre un modello ideale di genitorialità da raggiungere, ma fornire strumenti per trovare il proprio modo di esserlo.\n\nPerché non esiste un’unica maniera di diventare famiglia. Esistono storie diverse, bisogni differenti e un percorso unico per ciascuno.\n\nInsieme, nel viaggio della genitorialità\n\nMetiMaia nasce da un’ostetrica, ma si rivolge a tutta la famiglia.\n\nÈ un progetto che vuole avvicinare la competenza professionale alla vita quotidiana, rendere la conoscenza accessibile e offrire un sostegno concreto nei momenti in cui le domande sono tante e le certezze sembrano poche.\n\nUn luogo in cui informarsi, prepararsi, scoprire e crescere. Un compagno di viaggio da consultare nelle diverse tappe, sapendo che chiedere aiuto è una risorsa e che non è necessario avere tutte le risposte.\n\nPerché quando una famiglia cresce, cresce insieme a lei anche il bisogno di conoscenza, ascolto e cura.\n\nMetiMaia vuole esserci, un passo alla volta.\n\nMetiMaia — La conoscenza che accompagna, la cura che unisce",
  services: [
    {
      title: "La gravidanza",
      description:
        "Comprendere i cambiamenti del corpo, conoscere le tappe della gestazione, prepararsi alla nascita e vivere l’attesa con maggiore consapevolezza.",
      details: "",
    },
    {
      title: "La nascita e il post-partum",
      description:
        "Orientarsi tra travaglio, parto, recupero materno, allattamento, emozioni e nuovi equilibri familiari.",
      details: "",
    },
    {
      title: "Il primo anno di vita",
      description:
        "Scoprire le cure del neonato, il sonno sicuro, l’alimentazione, le tappe dello sviluppo e le risorse utili nella quotidianità.",
      details: "",
    },
    {
      title: "La crescita della famiglia",
      description:
        "Riconoscere i bisogni di ciascuno, valorizzare il ruolo di ogni genitore e costruire insieme nuove abitudini e relazioni.",
      details: "",
    },
  ],
  contact_email: "ostetricamaia@gmail.com",
} satisfies Pick<
  SiteProfile,
  "bio" | "qualifications" | "service_area" | "services" | "contact_email"
>;

export function withGaiaPresentation(profile: SiteProfile): SiteProfile {
  return {
    ...profile,
    ...gaiaPresentation,
    contact_email: profile.contact_email || gaiaPresentation.contact_email,
    services: gaiaPresentation.services.map((service) => ({ ...service })),
  };
}

export function isInitialGaiaPresentation(profile: SiteProfile): boolean {
  // Only replace a recognised former starter or the supplied personal bio.
  // Later intentional edits and empty fields stay respected.
  const starter =
    profile.bio.trim() ===
      "Come ostetrica desidero accompagnarvi con ascolto, rispetto e competenza. Ogni famiglia ha la propria storia, i propri tempi e il proprio modo di crescere insieme." &&
    !profile.qualifications.trim() &&
    profile.service_area.trim() ===
      "Modalità, luoghi e disponibilità da concordare direttamente." &&
    profile.services.length === 0;
  const previousDocument =
    profile.bio
      .trim()
      .startsWith(
        "Ciao, sono Gaia. Benvenuta in questo spazio dedicato a te, alla nuova vita che cresce e alla tua famiglia.",
      ) && profile.qualifications.includes("2.300 ore di tirocinio clinico");
  return starter || previousDocument;
}
