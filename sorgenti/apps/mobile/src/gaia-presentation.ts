import type { SiteProfile } from "./professional";

// Editorial source: the presentation supplied by Gaia on 24 October 2026.
// No professional-register number, prices or response times were supplied.
export const gaiaPhone = {
  label: "392 793 9566",
  call: "tel:+393927939566",
  whatsapp: "https://wa.me/393927939566",
};

export const gaiaPresentation = {
  bio: [
    "Ciao, sono Gaia. Benvenuta in questo spazio dedicato a te, alla nuova vita che cresce e alla tua famiglia.",
    "Se sei qui, probabilmente stai attraversando uno dei momenti più intensi, emozionanti e ricchi di trasformazione della tua vita. Come ostetrica desidero camminare al tuo fianco, passo dopo passo, offrendoti supporto clinico, pratico ed emotivo durante la gravidanza, il parto e i primi mesi da mamma.",
    "Non c’è una ricetta unica per diventare genitori o per partorire. Il mio obiettivo è mettere a tua disposizione l’esperienza ospedaliera e la preparazione scientifica, per rispondere alle tue domande e affrontare insieme dubbi e paure.",
    "Lavoreremo insieme ascoltando il tuo corpo, le tue emozioni e i desideri della tua famiglia.",
  ].join("\n\n"),
  qualifications: [
    "Da 5 anni lavoro come ostetrica presso l’Ospedale San Pietro Fatebenefratelli di Roma. In sala parto e in reparto accompagno le mamme durante la nascita e nei momenti più delicati del loro percorso.",
    "La mia formazione sul campo è iniziata con oltre 2.300 ore di tirocinio clinico nelle sale parto, nei reparti e nei pronto soccorso della Clinica Fabia Mater, dell’Azienda Ospedaliera Sant’Andrea, dell’Ospedale Sandro Pertini e del San Pietro Fatebenefratelli.",
    "Credo in uno sguardo completo sulla salute della donna, che unisca competenza scientifica, ascolto e attenzione al benessere. Per questo continuo a studiare e ad approfondire la mia formazione.",
    "Master di I livello in Chirurgia per la Salute della Donna — Università Cattolica del Sacro Cuore di Roma. Un percorso dedicato all’attività di strumentista e alla sala operatoria, anche nel contesto del parto cesareo.",
    "Master biennale in Oli Essenziali e Formulazioni Cosmetiche — in fase di completamento presso l’Università Cattolica. Sto portando avanti una tesi sperimentale sulla diffusione nell’aria di una miscela di oli essenziali, per studiarne il rapporto con i livelli di cortisolo, un ormone coinvolto nella risposta allo stress. Si tratta di una ricerca in corso.",
    "Diploma da Istruttrice di Ginnastica in Gravidanza. Una formazione per accompagnare il movimento, la preparazione del bacino e del pavimento pelvico e il benessere del corpo durante la gestazione.",
  ].join("\n\n"),
  service_area:
    "Roma: attività ospedaliera presso l’Ospedale San Pietro Fatebenefratelli e consulenze private. Modalità, luoghi, disponibilità ed eventuali costi delle consulenze vengono concordati direttamente.",
  services: [
    {
      title: "Corsi di accompagnamento al parto",
      description:
        "Incontri pratici, teorici ed emozionali per le future mamme e la coppia, in un percorso in cui sentirsi ascoltati e accolti.",
      details:
        "Travaglio, gestione del dolore e posizioni per il parto, ma anche allattamento, cura del neonato e ritorno a casa.",
    },
    {
      title: "Ginnastica e movimento in gravidanza",
      description:
        "Sessioni dedicate al corpo che cambia, alla respirazione e alla mobilità pelvica, per accompagnare la preparazione alla nascita.",
      details:
        "Il percorso viene adattato alle esigenze della persona e alle indicazioni professionali pertinenti alla gravidanza.",
    },
    {
      title: "Aromaterapia e gestione dello stress",
      description:
        "Uno spazio dedicato al benessere olfattivo e al rilassamento, da valutare insieme nel contesto del percorso ostetrico.",
      details:
        "Il percorso si definisce insieme, tenendo conto delle esigenze personali e del contesto della gravidanza.",
    },
    {
      title: "Supporto dopo il parto e allattamento",
      description:
        "Dalla consulenza sull’allattamento ai primi giorni a casa con il bambino: ascolto e accompagnamento per la nuova quotidianità della famiglia.",
      details:
        "Modalità e disponibilità del supporto si concordano direttamente.",
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
    services: gaiaPresentation.services.map((service) => ({ ...service })),
  };
}

export function isInitialGaiaPresentation(profile: SiteProfile): boolean {
  // Recognise the complete former starter, rather than filling individual
  // empty fields: subsequent intentional edits/removals must stay respected.
  return (
    profile.bio.trim() ===
      "Come ostetrica desidero accompagnarvi con ascolto, rispetto e competenza. Ogni famiglia ha la propria storia, i propri tempi e il proprio modo di crescere insieme." &&
    !profile.qualifications.trim() &&
    profile.service_area.trim() ===
      "Modalità, luoghi e disponibilità da concordare direttamente." &&
    profile.services.length === 0 &&
    profile.contact_email.trim().toLowerCase() ===
      gaiaPresentation.contact_email
  );
}
