import { client } from "./state";
import { publicProfessionalText } from "@nido/core";
import {
  isInitialGaiaPresentation,
  withGaiaPresentation,
} from "./gaia-presentation";
export type Service = { title: string; description: string; details: string };
export interface SiteProfile {
  id: number;
  bio: string;
  portrait_url: string;
  qualifications: string;
  service_area: string;
  services: Service[];
  contact_email: string;
  privacy_providers: string;
  privacy_retention: string;
  privacy_transfers: string;
  privacy_reviewed: boolean;
}
export const defaultProfile: SiteProfile = {
  id: 1,
  bio: "Come ostetrica desidero accompagnarvi con ascolto, rispetto e competenza. Ogni famiglia ha la propria storia, i propri tempi e il proprio modo di crescere insieme.",
  portrait_url: "",
  qualifications: "",
  service_area: "Modalità, luoghi e disponibilità da concordare direttamente.",
  services: [],
  contact_email: "ostetricamaia@gmail.com",
  privacy_providers:
    "Cloudflare ospita il sito; Supabase gestisce autenticazione e database in Irlanda; Resend gestisce le email. Stripe gestisce i pagamenti quando lo Shop è attivo. Amazon è un servizio esterno.",
  privacy_retention: "",
  privacy_transfers: "",
  privacy_reviewed: false,
};
// Public pages use a presentation copy; Studio keeps the original saved values.
export function publicProfile(stored: SiteProfile): SiteProfile {
  const profile = isInitialGaiaPresentation(stored)
    ? withGaiaPresentation(stored)
    : stored;
  return {
    ...profile,
    bio: publicProfessionalText(profile.bio),
    qualifications: publicProfessionalText(profile.qualifications),
    service_area: publicProfessionalText(profile.service_area),
    services: profile.services.map((service) => ({
      ...service,
      title: publicProfessionalText(service.title),
      description: publicProfessionalText(service.description),
      details: publicProfessionalText(service.details),
    })),
    privacy_providers: publicProfessionalText(profile.privacy_providers),
    privacy_retention: publicProfessionalText(profile.privacy_retention),
    privacy_transfers: publicProfessionalText(profile.privacy_transfers),
  };
}
export async function loadProfile({
  strict = false,
}: { strict?: boolean } = {}): Promise<SiteProfile> {
  const unavailable =
    "Impossibile caricare le informazioni attuali. Riprova prima di modificarle: nessun dato è stato sostituito.";
  try {
    if (!client) throw new Error(unavailable);
    const { data, error } = await client
      .from("site_profile")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) throw new Error(unavailable);
    const textFields = [
      "bio",
      "portrait_url",
      "qualifications",
      "service_area",
      "contact_email",
      "privacy_providers",
      "privacy_retention",
      "privacy_transfers",
    ] as const;
    if (
      data.id !== 1 ||
      !Array.isArray(data.services) ||
      data.services.some(
        (service: Service) =>
          !service ||
          typeof service.title !== "string" ||
          typeof service.description !== "string" ||
          typeof service.details !== "string",
      ) ||
      (strict &&
        (textFields.some((key) => typeof data[key] !== "string") ||
          typeof data.privacy_reviewed !== "boolean"))
    )
      throw new Error(unavailable);
    return { ...defaultProfile, ...data } as SiteProfile;
  } catch {
    if (strict) throw new Error(unavailable);
    return defaultProfile;
  }
}
export async function saveProfile(profile: SiteProfile) {
  if (!client) throw new Error("Servizio non disponibile.");
  const { assertEditor } = await import("@nido/data");
  await assertEditor(client);
  if (profile.portrait_url && !profile.portrait_url.startsWith("https://"))
    throw new Error("La foto deve usare HTTPS.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.contact_email))
    throw new Error("Contatto email non valido.");
  if (
    profile.services.length > 20 ||
    profile.services.some(
      (s) =>
        !s.title.trim() ||
        !s.description.trim() ||
        s.title.length > 200 ||
        s.description.length > 4000 ||
        s.details.length > 4000,
    )
  )
    throw new Error(
      "Completa titolo e descrizione di ogni servizio (massimo 20 servizi).",
    );
  const { error } = await client
    .from("site_profile")
    .upsert({ ...profile, updated_at: new Date().toISOString() });
  if (error)
    throw new Error(
      "Salvataggio non riuscito. Verifica i permessi e la configurazione v3.",
    );
}
export async function invokeSiteAction(body: object) {
  if (!client) throw new Error("Servizio non disponibile.");
  const { data, error } = await client.functions.invoke("site-actions", {
    body,
    timeout: 20000,
  });
  if (error)
    throw new Error(
      "Operazione non completata. Verifica la connessione e l’attivazione della funzione site-actions in Supabase.",
    );
  return data;
}
