export const bookingTopics = [
  "Informazioni sui servizi",
  "Richiesta di un incontro ostetrico",
  "Informazioni su accompagnamento alla nascita",
  "Informazioni sul periodo dopo la nascita",
] as const;
export interface BookingRequest {
  name: string;
  email: string;
  topic: string;
  date: string;
  time: string;
  mode: string;
}
export function bookingIssues(
  request: BookingRequest,
  today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" }),
): string[] {
  const issues: string[] = [];
  if (!request.name.trim() || request.name.trim().length > 100)
    issues.push("Inserisci il tuo nome (massimo 100 caratteri).");
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email.trim()) ||
    request.email.length > 254
  )
    issues.push("Inserisci un’email valida per essere ricontattata/o.");
  if (!bookingTopics.includes(request.topic as (typeof bookingTopics)[number]))
    issues.push("Scegli il motivo della richiesta.");
  if (request.date) {
    const date = new Date(request.date + "T12:00:00Z");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(request.date) ||
      Number.isNaN(date.valueOf()) ||
      date.toISOString().slice(0, 10) !== request.date ||
      request.date < today
    )
      issues.push(
        "Indica una data valida, da oggi in poi, nel formato AAAA-MM-GG, oppure lascia vuoto.",
      );
  }
  if (!["Da concordare", "Mattina", "Pomeriggio"].includes(request.time))
    issues.push("Scegli una fascia oraria valida.");
  if (
    ![
      "Da concordare",
      "In presenza, se disponibile",
      "A distanza, se disponibile",
    ].includes(request.mode)
  )
    issues.push("Scegli una modalità valida.");
  return issues;
}
export function bookingText(request: BookingRequest): string {
  return `Buongiorno Dott.ssa Brunetti,\nvorrei chiedere disponibilità per: ${request.topic}.\n\nNome: ${request.name.trim()}\nEmail di ricontatto: ${request.email.trim()}\nData preferita: ${request.date || "Da concordare"}\nFascia oraria: ${request.time}\nModalità: ${request.mode}\n\nComprendo che questa è una richiesta di disponibilità e che l’appuntamento sarà confermato solo dopo una risposta della dottoressa.\nGrazie.`;
}
