import { client } from "./state";
export const newsletterConsentVersion = "2026-10-23-v1";
export async function requestNewsletterSubscription(email: string) {
  if (!client) throw new Error("Newsletter non disponibile.");
  const { error } = await client.functions.invoke("newsletter", {
    body: {
      email: email.trim(),
      consent: true,
      consentVersion: newsletterConsentVersion,
    },
  });
  if (error)
    throw new Error(
      "Iscrizione non riuscita. La newsletter potrebbe non essere ancora attiva: riprova più tardi.",
    );
}

export async function confirmNewsletter(
  action: "confirm" | "unsubscribe",
  token: string,
): Promise<string> {
  if (!client) throw new Error("Newsletter non disponibile.");
  const { data, error } = await client.functions.invoke("newsletter", {
    body: { action, token },
  });
  if (error)
    throw new Error(
      "Operazione non riuscita: il link potrebbe essere scaduto o già utilizzato. Se hai già confermato non occorre ripetere l’operazione.",
    );
  return data.message;
}
