import { describe, expect, it } from "vitest";
import {
  emptyPregnancyProfile,
  gestationalAge,
  pregnancyCalendarDay,
  pregnancyEstimatedDueDate,
  pregnancyProfileIssue,
  todayCalendarDate,
} from "./pregnancy";

describe("Profilo gravidanza facoltativo", () => {
  it("calcola settimane e giorni su giorni di calendario anche durante il cambio ora", () => {
    const profile = {
      ...emptyPregnancyProfile(),
      last_menstrual_date: "2026-10-11",
    };
    expect(gestationalAge(profile, "2026-10-25")).toEqual({
      weeks: 2,
      days: 0,
      totalDays: 14,
      source: "last_menstrual_date",
    });
    expect(todayCalendarDate(new Date("2026-10-24T22:30:00Z"))).toBe(
      "2026-10-25",
    );
    expect(todayCalendarDate(new Date("2026-10-25T22:30:00Z"))).toBe(
      "2026-10-25",
    );
  });
  it("rifiuta giorni inesistenti, futuri e valori oltre 43+0", () => {
    expect(pregnancyCalendarDay("2026-02-30")).toBeNull();
    expect(pregnancyCalendarDay("2024-02-29")).not.toBeNull();
    expect(
      gestationalAge(
        { ...emptyPregnancyProfile(), last_menstrual_date: "2026-10-26" },
        "2026-10-25",
      ),
    ).toBeNull();
    expect(
      gestationalAge(
        { ...emptyPregnancyProfile(), last_menstrual_date: "2025-12-28" },
        "2026-10-25",
      )?.weeks,
    ).toBe(43);
    expect(
      gestationalAge(
        { ...emptyPregnancyProfile(), last_menstrual_date: "2025-12-27" },
        "2026-10-25",
      ),
    ).toBeNull();
  });
  it("fa avanzare la datazione ecografica dal giorno in cui è stata indicata", () => {
    const profile = {
      ...emptyPregnancyProfile(),
      last_menstrual_date: "2026-08-01",
      ultrasound_matches: false,
      ultrasound_weeks: 12,
      ultrasound_days: 6,
      ultrasound_reference_date: "2026-10-25",
    };
    expect(gestationalAge(profile, "2026-10-26")).toEqual({
      weeks: 13,
      days: 0,
      totalDays: 91,
      source: "ultrasound",
    });
    expect(
      gestationalAge({ ...profile, ultrasound_days: 7 }, "2026-10-25"),
    ).toBeNull();
    expect(
      gestationalAge(
        { ...profile, ultrasound_reference_date: "2026-10-26" },
        "2026-10-25",
      ),
    ).toBeNull();
  });
  it("non deduce la personalizzazione dal consenso a conservare o condividere", () => {
    const profile = {
      ...emptyPregnancyProfile(),
      storage_consent: true,
      gaia_share_consent: true,
      last_menstrual_date: "2026-08-01",
    };
    expect(pregnancyEstimatedDueDate(profile, "2026-10-25")).toBeNull();
    expect(
      pregnancyEstimatedDueDate(
        { ...profile, personalization_consent: true },
        "2026-10-25",
      ),
    ).toBe("2027-05-08");
  });
  it("permette anamnesi facoltativa senza forzare un esito o un parto", () => {
    const profile = {
      ...emptyPregnancyProfile(),
      storage_consent: true,
      previous_pregnancies: true,
    };
    expect(pregnancyProfileIssue(profile, "2026-10-25")).toBeNull();
    expect(
      pregnancyProfileIssue(
        { ...profile, previous_outcomes: ["other"] },
        "2026-10-25",
      ),
    ).toBeNull();
    expect(
      pregnancyProfileIssue(
        {
          ...profile,
          previous_pregnancies: false,
          previous_outcomes: ["cesarean"],
        },
        "2026-10-25",
      ),
    ).toBeTruthy();
    expect(
      pregnancyProfileIssue(
        { ...profile, previous_outcomes: ["not_indicated", "spontaneous"] },
        "2026-10-25",
      ),
    ).toBeTruthy();
  });
});
