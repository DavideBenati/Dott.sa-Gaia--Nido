import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Platform, View } from "react-native";
import {
  gestationalAge,
  pregnancyOutcomeOptions,
  todayCalendarDate,
  type PregnancyProfile,
} from "@nido/core";
import { client } from "./state";
import { loadMemberPregnancyProfile } from "./pregnancy-profile";
import { Text } from "./typography";
import { Button, Notice, ui } from "./ui";

const dateLabel = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
};
const answerLabel = (value: boolean | null) =>
  value === null ? "Non indicato" : value ? "Sì" : "No";

/** Clinical details are fetched separately, only on an explicit request. */
export function PregnancyReadOnly({ userId }: { userId: string }) {
  const [opened, setOpened] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<PregnancyProfile | null>(null);
  const [error, setError] = useState("");
  const [today, setToday] = useState(todayCalendarDate);
  const mounted = useRef(false);
  const requestVersion = useRef(0);
  const clear = useCallback(() => {
    requestVersion.current++;
    setProfile(null);
    setError("");
    setLoading(false);
    setOpened(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    clear();
    return () => {
      mounted.current = false;
      requestVersion.current++;
    };
  }, [userId, clear]);

  useEffect(() => {
    // A changed session or a backgrounded screen must not retain clinical
    // details. Reopening always checks current consent and authorization.
    const subscription = client?.auth.onAuthStateChange((event) => {
      if (event !== "INITIAL_SESSION" && mounted.current) clear();
    });
    const appSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" && mounted.current) clear();
    });
    const visibilityChanged = () => {
      if (document.visibilityState !== "visible" && mounted.current) clear();
    };
    if (Platform.OS === "web" && typeof document !== "undefined")
      document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      subscription?.data.subscription.unsubscribe();
      appSubscription.remove();
      if (Platform.OS === "web" && typeof document !== "undefined")
        document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [clear]);

  useEffect(() => {
    if (!opened) return;
    const timer = setInterval(() => setToday(todayCalendarDate()), 60_000);
    return () => clearInterval(timer);
  }, [opened]);

  async function load() {
    if (!client || loading) return;
    const request = ++requestVersion.current;
    setOpened(true);
    setLoading(true);
    setProfile(null);
    setError("");
    setToday(todayCalendarDate());
    try {
      const saved = await loadMemberPregnancyProfile(client, userId);
      if (!mounted.current || request !== requestVersion.current) return;
      setProfile(saved);
    } catch {
      if (mounted.current && request === requestVersion.current)
        setError(
          "Dati gravidanza non disponibili. Verifica l’abilitazione e il codice di sicurezza, poi riprova.",
        );
    } finally {
      if (mounted.current && request === requestVersion.current)
        setLoading(false);
    }
  }

  const age = profile ? gestationalAge(profile, today) : null;
  return (
    <View style={[ui.card, { gap: 14 }]}>
      <Text accessibilityRole="header" style={ui.heading}>
        Dati gravidanza condivisi
      </Text>
      <Text style={ui.body}>
        Dati facoltativi scelti dalla persona, consultabili da Gaia con
        l’abilitazione riservata. La scheda è in sola lettura.
      </Text>
      {!opened ? (
        <Button variant="secondary" onPress={() => void load()}>
          Apri dati gravidanza condivisi
        </Button>
      ) : loading ? (
        <Notice>Verifica del consenso e dei dati attuali…</Notice>
      ) : error ? (
        <View accessibilityRole="alert" style={{ gap: 12 }}>
          <Notice warm>{error}</Notice>
          <Button variant="secondary" onPress={() => void load()}>
            Riprova dati gravidanza
          </Button>
        </View>
      ) : !profile ? (
        <Notice>
          Non ci sono dati gravidanza condivisi con Gaia per questo account.
        </Notice>
      ) : (
        <>
          <Text style={ui.body}>
            Ultima mestruazione:{" "}
            {profile.last_menstrual_date
              ? dateLabel(profile.last_menstrual_date)
              : "Non indicata"}
          </Text>
          <Text style={ui.body}>
            Età gestazionale oggi ({dateLabel(today)}):{" "}
            {age
              ? `${age.weeks} settimane + ${age.days} giorni`
              : "Non disponibile: verifica le date con la persona."}
          </Text>
          <Text style={ui.body}>
            Corrisponde alla datazione ecografica?{" "}
            {answerLabel(profile.ultrasound_matches)}
          </Text>
          {profile.ultrasound_matches === false &&
            profile.ultrasound_reference_date && (
              <Text style={ui.body}>
                Datazione ecografica indicata il{" "}
                {dateLabel(profile.ultrasound_reference_date)}:{" "}
                {profile.ultrasound_weeks} settimane + {profile.ultrasound_days}{" "}
                giorni. L’età gestazionale di oggi avanza da questa data.
              </Text>
            )}
          <Text style={ui.body}>
            Gravidanze precedenti: {answerLabel(profile.previous_pregnancies)}
          </Text>
          {profile.previous_pregnancies === true && (
            <Text style={ui.body}>
              Esiti indicati:{" "}
              {profile.previous_outcomes.length
                ? profile.previous_outcomes
                    .map(
                      (outcome) =>
                        pregnancyOutcomeOptions.find(
                          (option) => option.id === outcome,
                        )?.label ?? "Non indicato",
                    )
                    .join(" · ")
                : "Non indicati"}
            </Text>
          )}
          <Text style={ui.body}>
            Stima informativa basata sui dati dichiarati; la datazione clinica
            va confermata con la professionista.
          </Text>
        </>
      )}
      {opened && !loading && (
        <View style={{ gap: 10 }}>
          <Button variant="quiet" onPress={() => void load()}>
            Aggiorna dati gravidanza
          </Button>
          <Button variant="quiet" onPress={clear}>
            Chiudi dati gravidanza
          </Button>
        </View>
      )}
    </View>
  );
}
