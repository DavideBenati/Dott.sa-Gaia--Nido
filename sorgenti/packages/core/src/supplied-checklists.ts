import type { Checklist } from "./types";

// Supplied by Dott.sa Gaia in “Borsa parto.docx”. Keep these IDs aligned with
// migration 014 so progress stays attached when the server copy becomes available.
export const suppliedBirthBagChecklist: Checklist = {
  id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1400",
  title: "Borsa parto",
  description:
    "Lista fornita per MetiMaia, da adattare con la struttura e l’ostetrica.",
  stage: "pregnancy",
  status: "published",
  approved: true,
  isDemo: false,
  items: [
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1401",
      label: "Preparare 2–3 camicie da notte aperte sul davanti",
      note: "Per te · Scegli mezza manica o maniche lunghe ampie, secondo le tue preferenze; l’apertura sul davanti può essere comoda per allattare.",
    },
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1402",
      label: "Scegliere mutandine assorbenti o assorbenti per il post-partum",
      note: "Per te · Valuta la soluzione che trovi più comoda e le indicazioni della struttura.",
    },
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1403",
      label: "Mettere in borsa una vestaglia",
      note: "Per te · Preferibilmente con maniche ampie o senza polsini elastici.",
    },
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1404",
      label: "Preparare pantofole comode e infradito per la doccia",
      note: "Per te · Scegli pantofole con un appoggio confortevole.",
    },
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1405",
      label: "Organizzare il beauty per l’igiene personale",
      note: "Per te · Spazzolino e dentifricio, detergente intimo, asciugamani, accappatoio in microfibra, burrocacao, shampoo, balsamo e bagnodoccia in formato mini, elastici, mollettine e spazzola. Acqua termale e prodotti usa e getta sono facoltativi.",
    },
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1406",
      label: "Aggiungere un caricabatterie con cavo lungo",
      note: "Per te · Le prese possono essere lontane dal letto.",
    },
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1407",
      label: "Valutare uno spuntino da portare",
      note: "Per te · Nel documento: frutta secca o barretta energizzante. Verifica con la struttura cosa è consentito e adatto alle tue esigenze.",
    },
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1408",
      label:
        "Valutare con l’ostetrica l’eventuale uso di oli essenziali e idrolati",
      note: "Facoltativo da valutare con ostetrica · Il documento cita lavanda, neroli e idrolati di lavanda ed elicriso. Non sono necessari per la borsa. Non applicare né diffondere oli essenziali sul neonato o vicino a lui e non usare idrolati per il bambino senza un’indicazione professionale specifica; chiedi prima anche per l’uso materno.",
    },
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1409",
      label: "Valutare se portare conchiglie raccogli latte",
      note: "Per te · Facoltative: confrontati con l’ostetrica sulla loro utilità per te.",
    },
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1410",
      label: "Raccogliere tessera sanitaria e carta d’identità",
      note: "Documenti · Controlla la lista fornita dal punto nascita.",
    },
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1411",
      label: "Raccogliere i referti delle ultime due ecografie",
      note: "Documenti · Se disponibili, secondo le richieste della struttura.",
    },
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1412",
      label:
        "Aggiungere il referto della visita anestesiologica, se effettuata",
      note: "Documenti · Questa voce serve a organizzare referti già richiesti, non a indicare nuovi esami.",
    },
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1413",
      label: "Aggiungere il referto ECG, se richiesto e disponibile",
      note: "Documenti · Segui le indicazioni del punto nascita e dei professionisti che ti seguono.",
    },
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1414",
      label: "Raccogliere gli ultimi esami ematici disponibili",
      note: "Documenti · Porta i referti indicati dalla struttura.",
    },
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1415",
      label:
        "Verificare il documento del gruppo sanguigno richiesto dalla struttura",
      note: "Documenti · Controlla con il punto nascita quale documentazione portare.",
    },
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1416",
      label: "Aggiungere i referti dei tamponi vagino-rettali, se disponibili",
      note: "Documenti · Organizza quelli previsti dal tuo percorso e richiesti dalla struttura.",
    },
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1417",
      label: "Preparare 4–5 cambi del bambino in bustine separate",
      note: "Per il bambino · Nel documento: body, preferibilmente a kimono, maglietta e pantalone oppure tutina in cotone, calzini e cappellino. Etichetta le bustine come richiesto dalla struttura; adatta quantità e indumenti alle sue indicazioni.",
    },
    {
      id: "6fc3ea78-9c64-4cc8-bf88-e94f95ba1418",
      label: "Aggiungere una copertina o una mussola",
      note: "Per il bambino · Verifica le indicazioni del punto nascita.",
    },
  ],
};

export function withSuppliedChecklists(checklists: Checklist[]): Checklist[] {
  return checklists.some((item) => item.id === suppliedBirthBagChecklist.id)
    ? checklists
    : [suppliedBirthBagChecklist, ...checklists];
}
