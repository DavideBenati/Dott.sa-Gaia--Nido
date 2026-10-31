import type { Checklist } from "./types";

// Practical drafts selected for MetiMaia. They are not published or clinically
// approved, and do not attribute authorship or a review to Gaia automatically.
export const practicalChecklistDrafts: Checklist[] = [
  {
    id: "5e1d23d0-b32e-5784-943a-4eb2ca4cfde8",
    title: "Organizzare il trasporto verso il punto nascita",
    description:
      "Per preparare tragitto, accompagnamento e rientro seguendo le indicazioni del punto nascita. Verifica le voci che ti riguardano; se una situazione non si applica, puoi segnarla come controllata.",
    stage: "pregnancy",
    status: "draft",
    approved: false,
    isDemo: false,
    items: [
      {
        id: "9531f973-1837-5c78-8963-63159c8eb553",
        label: "Salvare indirizzo e contatti del punto nascita",
        note: "Tieni questi riferimenti in uno spazio personale facilmente accessibile.",
      },
      {
        id: "5c76e5d2-d5c0-5f69-a886-ac39a00aafc0",
        label: "Verificare quale ingresso utilizzare, anche di notte",
        note: "Controlla le indicazioni aggiornate della struttura.",
      },
      {
        id: "2581a9f7-76b2-52cf-940f-0470a881231c",
        label: "Controllare il percorso principale e un’alternativa",
        note: "Valuta gli accessi e le eventuali limitazioni del tragitto.",
      },
      {
        id: "b21b97dc-8405-532b-8a15-3eab1b7d2d40",
        label: "Individuare parcheggio e punto di accesso per l’accompagnatore",
        note: "Se usi un altro mezzo, verifica dove può fermarsi.",
      },
      {
        id: "3fb83043-4d6b-57e5-b891-183d7acb2b80",
        label: "Concordare chi accompagna e come raggiungere la struttura",
        note: "Scegli l’organizzazione adatta alle tue esigenze.",
      },
      {
        id: "c64cf525-a329-55c3-9e8e-6ae6fef3cd32",
        label:
          "Prevedere un’alternativa se la persona scelta non è disponibile",
        note: "Concorda in anticipo un secondo riferimento o un altro mezzo.",
      },
      {
        id: "a1f839b9-22b4-50af-a186-29d4187d0932",
        label: "Tenere borse, documenti e chiavi facilmente recuperabili",
        note: "Prepara ciò che serve secondo la lista del punto nascita.",
      },
      {
        id: "166b4699-9298-55a2-9308-5301cbc80cb9",
        label: "Organizzare il rientro con il neonato",
        note: "Se viaggiate in auto, verifica che il seggiolino sia adatto e installato secondo le istruzioni del produttore. Non è necessario acquistare accessori non richiesti dal sistema di trasporto scelto.",
      },
    ],
  },
  {
    id: "cde0afce-dcc4-5f14-a20e-ff8eb8472f2a",
    title: "Casa pronta per un bambino che inizia a muoversi",
    description:
      "Per osservare gli ambienti dalla sua altezza e intervenire sui pericoli raggiungibili. Adatta la verifica ai tuoi spazi; se una situazione non si applica, puoi segnarla come controllata. Ripeti il controllo quando cambiano le capacità del bambino.",
    stage: "postpartum",
    status: "draft",
    approved: false,
    isDemo: false,
    items: [
      {
        id: "f3872866-c380-5080-9a74-1dfd238b11a7",
        label: "Controllare ogni stanza abbassandosi all’altezza del bambino",
        note: "Osserva ciò che può raggiungere, afferrare o tirare.",
      },
      {
        id: "da42caf1-dc6a-5b12-a81b-2ba37d973215",
        label: "Fissare mobili e televisori che potrebbero ribaltarsi",
        note: "Segui le istruzioni di fissaggio del produttore.",
      },
      {
        id: "e70f047c-2521-5d4a-a0b5-96b5154e92d4",
        label: "Proteggere l’accesso alle scale con barriere adatte",
        note: "Se non ci sono scale, segna la verifica come completata; considera anche eventuali dislivelli accessibili.",
      },
      {
        id: "a0f767a7-c803-5f7f-9a0f-427098f94b9c",
        label: "Verificare la sicurezza di finestre e accessi ai balconi",
        note: "Controlla anche mobili o oggetti che potrebbero essere usati per arrampicarsi.",
      },
      {
        id: "00c59829-c744-5eea-ab38-7492bb4ea64d",
        label:
          "Rendere inaccessibili farmaci, detergenti e altri prodotti pericolosi",
        note: "Riponili in uno spazio chiuso e non raggiungibile dal bambino.",
      },
      {
        id: "6e2d304b-1849-5c3d-890c-fc3ed89c4c09",
        label:
          "Riporre fuori portata monete, pile a bottone, magneti e piccoli oggetti",
        note: "Controlla pavimenti, mobili bassi e vani accessibili.",
      },
      {
        id: "251fc658-43ff-5dd1-82d3-ff8e77652cad",
        label: "Sistemare cavi elettrici e cordini di tende fuori portata",
        note: "Verifica anche quelli vicino al letto o ad altri punti di arrampicata.",
      },
      {
        id: "ddc1fc61-8ee5-5b7a-b7ba-7bc25ab1c080",
        label:
          "Controllare che bevande calde, pentole e manici non siano raggiungibili",
        note: "Controlla tavoli, bordi dei piani e accessi alla cucina.",
      },
      {
        id: "117586e3-99f4-5742-aac6-96270ee6cf17",
        label:
          "Ripetere il controllo quando il bambino acquisisce nuove capacità",
        note: "Rivaluta gli spazi quando inizia ad alzarsi o ad arrampicarsi.",
      },
    ],
  },
];
