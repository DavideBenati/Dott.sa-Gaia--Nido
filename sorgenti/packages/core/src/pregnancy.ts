/** Clinical pregnancy data stays separate from general journey preferences. */
export const pregnancyOutcomeOptions = [
  { id: "spontaneous", label: "Parto spontaneo" },
  { id: "cesarean", label: "Taglio cesareo" },
  { id: "other", label: "Altro esito" },
  { id: "not_indicated", label: "Preferisco non indicarlo" },
] as const;

export type PregnancyOutcome = (typeof pregnancyOutcomeOptions)[number]["id"];
export interface PregnancyProfile {
  last_menstrual_date: string | null;
  ultrasound_matches: boolean | null;
  ultrasound_weeks: number | null;
  ultrasound_days: number | null;
  ultrasound_reference_date: string | null;
  previous_pregnancies: boolean | null;
  previous_outcomes: PregnancyOutcome[];
  storage_consent: boolean;
  gaia_share_consent: boolean;
  personalization_consent: boolean;
  updated_at: string | null;
  consent_version?: string | null;
  consent_at?: string | null;
}
export type PregnancyProfileInput = Omit<
  PregnancyProfile,
  "updated_at" | "consent_version"
>;
export interface GestationalAge {
  weeks: number;
  days: number;
  totalDays: number;
  source: "last_menstrual_date" | "ultrasound";
}

const DAY = 86_400_000;
const MAX_DAYS = 43 * 7;

/** The clinic's calendar date, consistent with the server in Europe/Rome. */
export function todayCalendarDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((value) => value.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Parse a real YYYY-MM-DD date into a calendar day number, never elapsed local time. */
export function pregnancyCalendarDay(value: string | null): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || year > 9999) return null;
  const stamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(stamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  )
    return null;
  return stamp / DAY;
}

export function emptyPregnancyProfile(): PregnancyProfile {
  return {
    last_menstrual_date: null,
    ultrasound_matches: null,
    ultrasound_weeks: null,
    ultrasound_days: null,
    ultrasound_reference_date: null,
    previous_pregnancies: null,
    previous_outcomes: [],
    storage_consent: false,
    gaia_share_consent: false,
    personalization_consent: false,
    updated_at: null,
  };
}

export function gestationalAge(
  profile: Pick<
    PregnancyProfileInput,
    | "last_menstrual_date"
    | "ultrasound_matches"
    | "ultrasound_weeks"
    | "ultrasound_days"
    | "ultrasound_reference_date"
  >,
  today = todayCalendarDate(),
): GestationalAge | null {
  const current = pregnancyCalendarDay(today);
  if (current === null) return null;
  let totalDays: number;
  let source: GestationalAge["source"] = "last_menstrual_date";
  if (profile.ultrasound_matches === false) {
    const reference = pregnancyCalendarDay(profile.ultrasound_reference_date);
    const weeks = profile.ultrasound_weeks;
    const days = profile.ultrasound_days;
    if (
      reference === null ||
      reference > current ||
      weeks === null ||
      days === null ||
      !Number.isInteger(weeks) ||
      !Number.isInteger(days) ||
      weeks < 0 ||
      days < 0 ||
      days > 6 ||
      weeks * 7 + days > MAX_DAYS
    )
      return null;
    totalDays = weeks * 7 + days + current - reference;
    source = "ultrasound";
  } else {
    const start = pregnancyCalendarDay(profile.last_menstrual_date);
    if (start === null || start > current) return null;
    totalDays = current - start;
  }
  if (totalDays < 0 || totalDays > MAX_DAYS) return null;
  return {
    weeks: Math.floor(totalDays / 7),
    days: totalDays % 7,
    totalDays,
    source,
  };
}

export function pregnancyProfileIssue(
  profile: PregnancyProfileInput,
  today = todayCalendarDate(),
): string | null {
  if (!profile.storage_consent)
    return "Per salvare questi dati serve il consenso alla loro conservazione.";
  const current = pregnancyCalendarDay(today);
  if (current === null) return "La data di riferimento non è valida.";
  if (profile.last_menstrual_date !== null) {
    const start = pregnancyCalendarDay(profile.last_menstrual_date);
    if (start === null)
      return "Inserisci una data reale nel formato AAAA-MM-GG.";
    if (start > current)
      return "L’ultima mestruazione non può essere nel futuro.";
    if (current - start > MAX_DAYS)
      return "Controlla la data: il calcolo supporta fino a 43 settimane.";
  }
  if (profile.ultrasound_matches === true && !profile.last_menstrual_date)
    return "Indica l’ultima mestruazione prima di confermare il calcolo.";
  if (profile.ultrasound_matches === false && !gestationalAge(profile, today))
    return "Indica settimane da 0 a 43 e giorni da 0 a 6 dell’ecografia, con una data di riferimento valida (massimo 43+0).";
  if (
    profile.ultrasound_matches !== false &&
    (profile.ultrasound_weeks !== null ||
      profile.ultrasound_days !== null ||
      profile.ultrasound_reference_date !== null)
  )
    return "I valori manuali servono solo se il calcolo non corrisponde all’ecografia.";
  const outcomes = profile.previous_outcomes;
  if (
    outcomes.length > 4 ||
    new Set(outcomes).size !== outcomes.length ||
    outcomes.some(
      (value) => !pregnancyOutcomeOptions.some((option) => option.id === value),
    )
  )
    return "Controlla gli esiti delle gravidanze precedenti.";
  if (profile.previous_pregnancies !== true && outcomes.length > 0)
    return "Gli esiti sono facoltativi e riguardano solo gravidanze precedenti.";
  if (outcomes.includes("not_indicated") && outcomes.length > 1)
    return "Scegli gli esiti oppure preferisco non indicarlo.";
  return null;
}

/** This derived date may be used for recommendations only with its own consent. */
export function pregnancyEstimatedDueDate(
  profile: PregnancyProfile | null,
  today = todayCalendarDate(),
): string | null {
  if (!profile?.storage_consent || !profile.personalization_consent)
    return null;
  const age = gestationalAge(profile, today);
  const current = pregnancyCalendarDay(today);
  if (!age || current === null) return null;
  return new Date((current + 280 - age.totalDays) * DAY)
    .toISOString()
    .slice(0, 10);
}
