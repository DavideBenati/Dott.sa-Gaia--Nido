export type MemberJourney =
  "pregnancy" | "postpartum" | "partner" | "exploring";

export const memberJourneyOptions = [
  {
    id: "pregnancy",
    label: "In gravidanza",
    description: "Gravidanza, preparazione alla nascita e domande sull’attesa.",
  },
  {
    id: "postpartum",
    label: "Dopo la nascita",
    description: "Recupero, allattamento e primi mesi insieme.",
  },
  {
    id: "partner",
    label: "Accompagno un genitore",
    description: "Per partner e persone che accompagnano la famiglia.",
  },
  {
    id: "exploring",
    label: "Mi informo",
    description: "Informazioni generali, senza indicare una fase personale.",
  },
] as const satisfies readonly {
  id: MemberJourney;
  label: string;
  description: string;
}[];

export const memberInterestOptions = [
  { id: "pregnancy", label: "Gravidanza" },
  { id: "birth_preparation", label: "Preparazione al parto" },
  { id: "birth", label: "Travaglio e nascita" },
  { id: "postpartum", label: "Dopo la nascita" },
  { id: "breastfeeding", label: "Allattamento" },
  { id: "newborn", label: "Cura del neonato" },
  { id: "wellbeing", label: "Benessere emotivo" },
  { id: "partner", label: "Supporto del partner" },
] as const;

export type MemberInterest = (typeof memberInterestOptions)[number]["id"];

export interface MemberProfile {
  nickname: string;
  journey_shared: boolean;
  shared_journey: MemberJourney | null;
  shared_interests: MemberInterest[];
  journey_consent_at: string | null;
  journey_consent_version: string | null;
  sharing_updated_at: string | null;
}

export interface SharedJourneyInput {
  journey: MemberJourney | null;
  interests: readonly string[];
  share: boolean;
  expectedUpdatedAt?: string | null;
}

export interface MemberDirectoryEntry {
  user_id: string;
  nickname: string;
  email: string;
  created_at: string;
  email_confirmed: boolean;
  journey_shared: boolean;
  shared_journey: MemberJourney | null;
  shared_interests: MemberInterest[];
  sharing_updated_at: string | null;
}

export interface MemberDirectoryResult {
  members: MemberDirectoryEntry[];
  total: number;
  can_view_journeys: boolean;
  journey_membership: boolean;
  journey_mfa_required: boolean;
  mfa_satisfied: boolean;
}

export function normalizeNickname(value: string): string {
  return value.trim().normalize("NFC");
}

export function nicknameIssue(value: string): string | null {
  const nickname = normalizeNickname(value);
  const length = Array.from(nickname).length;
  if (length < 2 || length > 40)
    return "Scegli un nickname da 2 a 40 caratteri.";
  if (
    Array.from(nickname).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || (code >= 127 && code <= 159);
    }) ||
    /[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff<>@]/u.test(nickname)
  )
    return "Usa un nickname senza email, parentesi angolari o caratteri di controllo.";
  return null;
}
