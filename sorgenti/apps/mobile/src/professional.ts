import { client } from "./state";
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
export async function loadProfile(): Promise<SiteProfile> {
  if (!client) return defaultProfile;
  const { data, error } = await client
    .from("site_profile")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return defaultProfile;
  if (
    !Array.isArray(data.services) ||
    data.services.some(
      (s: Service) =>
        !s ||
        typeof s.title !== "string" ||
        typeof s.description !== "string" ||
        typeof s.details !== "string",
    )
  )
    return defaultProfile;
  return { ...defaultProfile, ...data } as SiteProfile;
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
