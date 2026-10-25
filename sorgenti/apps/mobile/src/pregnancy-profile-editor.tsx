import React, { useEffect, useRef, useState } from "react";
import { AppState, Pressable, View } from "react-native";
import { router, useIsFocused } from "expo-router";
import {
  emptyPregnancyProfile,
  gestationalAge,
  pregnancyOutcomeOptions,
  pregnancyProfileIssue,
  todayCalendarDate,
  type PregnancyProfile,
  type PregnancyProfileInput,
} from "@nido/core";
import { client, useApp } from "./state";
import { Text, TextInput } from "./typography";
import { Button, Notice, ui } from "./ui";
import { useUnsavedChanges } from "./unsaved-changes";
import {
  loadMyPregnancyProfile,
  pregnancyProfileOwner,
  revokeMyPregnancyPersonalization,
  revokeMyPregnancyProfile,
  revokeMyPregnancySharing,
  saveMyPregnancyProfile,
} from "./pregnancy-profile";

function inputFrom(profile: PregnancyProfile | null): PregnancyProfileInput {
  const value = profile ?? emptyPregnancyProfile();
  return {
    last_menstrual_date: value.last_menstrual_date,
    ultrasound_matches: value.ultrasound_matches,
    ultrasound_weeks: value.ultrasound_weeks,
    ultrasound_days: value.ultrasound_days,
    ultrasound_reference_date: value.ultrasound_reference_date,
    previous_pregnancies: value.previous_pregnancies,
    previous_outcomes: [...value.previous_outcomes],
    storage_consent: value.storage_consent,
    gaia_share_consent: value.gaia_share_consent,
    personalization_consent: value.personalization_consent,
  };
}
function Choice({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  disabled: boolean;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={ui.label}>{label}</Text>
      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
      >
        {[
          { value: true, label: "Sì" },
          { value: false, label: "No" },
          { value: null, label: "Non indicato" },
        ].map((choice) => (
          <Pressable
            key={String(choice.value)}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${choice.label}`}
            accessibilityState={{ checked: value === choice.value, disabled }}
            aria-checked={value === choice.value}
            disabled={disabled}
            onPress={() => onChange(choice.value)}
            style={[ui.card, { padding: 12 }]}
          >
            <Text style={ui.body}>
              {value === choice.value ? "●" : "○"} {choice.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
function Consent({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      aria-checked={value}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={{ paddingVertical: 12 }}
    >
      <Text style={ui.body}>
        {value ? "☑" : "☐"} {label}
      </Text>
    </Pressable>
  );
}

export function PregnancyProfileEditor({
  onProfileChange,
}: {
  onProfileChange?: (profile: PregnancyProfile | null) => void;
}) {
  const { email } = useApp();
  const focused = useIsFocused();
  const [saved, setSaved] = useState<PregnancyProfile | null>(null);
  const [draft, setDraft] = useState<PregnancyProfileInput>(() =>
    inputFrom(null),
  );
  const [base, setBase] = useState(() => JSON.stringify(inputFrom(null)));
  const [owner, setOwner] = useState("");
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [manualEditing, setManualEditing] = useState(false);
  const [today, setToday] = useState(todayCalendarDate);
  const generation = useRef(0);
  const mounted = useRef(true);
  const callback = useRef(onProfileChange);
  callback.current = onProfileChange;
  const dirty = ready && JSON.stringify(draft) !== base;
  const { confirmDiscard } = useUnsavedChanges(dirty);
  const locked = loading || saving || !ready;

  function accept(profile: PregnancyProfile | null) {
    const next = inputFrom(profile);
    setSaved(profile);
    setDraft(next);
    setBase(JSON.stringify(next));
    setManualEditing(false);
    setReady(true);
    callback.current?.(profile);
  }
  function clear() {
    setSaved(null);
    setDraft(inputFrom(null));
    setBase(JSON.stringify(inputFrom(null)));
    setOwner("");
    setReady(false);
    setSaving(false);
    setExpanded(false);
    setMessage("");
    setError("");
  }
  async function reload() {
    if (!client) {
      setLoading(false);
      setError("Accedi per conservare una scheda gravidanza.");
      return;
    }
    const request = ++generation.current;
    setLoading(true);
    setReady(false);
    setError("");
    setMessage("");
    try {
      const account = await pregnancyProfileOwner(client);
      const profile = await loadMyPregnancyProfile(client, account);
      if (!mounted.current || request !== generation.current) return;
      setOwner(account);
      accept(profile);
    } catch (cause) {
      if (mounted.current && request === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Scheda gravidanza non disponibile. Riprova.",
        );
    } finally {
      if (mounted.current && request === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    if (focused && email) void reload();
    else {
      generation.current++;
      clear();
    }
    return () => {
      generation.current++;
    };
    // Reload for a fresh route/account; the server snapshot never lives on disk.
  }, [focused, email]);
  useEffect(() => {
    const timer = setInterval(() => setToday(todayCalendarDate()), 60_000);
    const auth = client?.auth.onAuthStateChange((_event, session) => {
      if (owner && session?.user.id !== owner) {
        generation.current++;
        clear();
      }
    });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        generation.current++;
        clear();
      } else if (focused && email) void reload();
    });
    return () => {
      clearInterval(timer);
      auth?.data.subscription.unsubscribe();
      subscription.remove();
    };
  }, [owner, focused, email]);

  function change(patch: Partial<PregnancyProfileInput>) {
    setDraft((current) => ({ ...current, ...patch }));
    setMessage("");
  }
  async function save() {
    if (locked || !client || !owner) return;
    if (!draft.storage_consent && saved?.storage_consent) {
      await revoke();
      return;
    }
    if (
      manualEditing &&
      draft.ultrasound_reference_date !== todayCalendarDate()
    ) {
      setMessage(
        "È cambiato il giorno: aggiorna settimane e giorni ecografici riferiti a oggi.",
      );
      return;
    }
    const issue = pregnancyProfileIssue(draft, todayCalendarDate());
    if (issue) {
      setMessage(issue);
      return;
    }
    const request = generation.current;
    setSaving(true);
    setMessage("");
    try {
      const profile = await saveMyPregnancyProfile(
        client,
        draft,
        saved?.updated_at ?? null,
        owner,
      );
      if (!mounted.current || request !== generation.current) return;
      accept(profile);
      setMessage(
        "Scheda gravidanza salvata. Puoi modificare o ritirare ogni consenso qui.",
      );
    } catch (cause) {
      if (mounted.current && request === generation.current)
        setMessage(
          cause instanceof Error
            ? cause.message
            : "Scheda non salvata. Riprova.",
        );
    } finally {
      if (mounted.current && request === generation.current) setSaving(false);
    }
  }
  async function revoke() {
    if (loading || saving || !client || !owner) return;
    const request = generation.current;
    setSaving(true);
    setMessage("");
    try {
      const profile = await revokeMyPregnancyProfile(client, owner);
      if (!mounted.current || request !== generation.current) return;
      accept(profile);
      setExpanded(false);
      setMessage(
        "Consensi ritirati e dati gravidanza rimossi dalla scheda attiva.",
      );
    } catch (cause) {
      if (mounted.current && request === generation.current)
        setMessage(
          cause instanceof Error
            ? cause.message
            : "Revoca non confermata. Riprova.",
        );
    } finally {
      if (mounted.current && request === generation.current) setSaving(false);
    }
  }
  async function revokePurpose(purpose: "gaia" | "personalization") {
    if (loading || saving || !client || !owner) return;
    const request = generation.current;
    setSaving(true);
    setMessage("");
    try {
      const profile = await (purpose === "gaia"
        ? revokeMyPregnancySharing(client, owner)
        : revokeMyPregnancyPersonalization(client, owner));
      if (!mounted.current || request !== generation.current) return;
      accept(profile);
      setMessage(
        purpose === "gaia"
          ? "Condivisione con Gaia ritirata. I dati restano privati nel tuo account."
          : "Consenso alla personalizzazione ritirato.",
      );
    } catch (cause) {
      if (mounted.current && request === generation.current)
        setMessage(
          cause instanceof Error
            ? cause.message
            : "Revoca non confermata. Riprova.",
        );
    } finally {
      if (mounted.current && request === generation.current) setSaving(false);
    }
  }
  const age = gestationalAge(draft, today);
  const lmpAge = gestationalAge({ ...draft, ultrasound_matches: null }, today);
  if (!email || !focused) return null;
  return (
    <View style={[ui.card, { gap: 16 }]}>
      <Text accessibilityRole="header" style={ui.heading}>
        La mia gravidanza · facoltativo
      </Text>
      <Text style={ui.body}>
        Se aspetti un bambino, puoi indicare queste informazioni per il tuo
        percorso. Sono dati sulla salute: scegli separatamente se conservarli,
        condividerli con Gaia e usarli per i contenuti. Non sono condivisi con
        familiari o altri iscritti.
      </Text>
      <Button variant="quiet" onPress={() => router.push("/privacy")}>
        Leggi l’informativa sui dati personali
      </Button>
      {loading ? (
        <Notice>Caricamento scheda gravidanza…</Notice>
      ) : error ? (
        <>
          <Notice warm>{error}</Notice>
          <Button onPress={() => void reload()}>
            Riprova scheda gravidanza
          </Button>
        </>
      ) : !expanded ? (
        <>
          <Text style={ui.body}>
            {saved?.storage_consent
              ? saved.gaia_share_consent
                ? "Hai una scheda gravidanza condivisa con Gaia."
                : "La tua scheda gravidanza è privata."
              : "Puoi continuare senza indicare dati sulla gravidanza."}
          </Text>
          <Button variant="secondary" onPress={() => setExpanded(true)}>
            {saved?.storage_consent
              ? "Apri la mia scheda gravidanza"
              : "Aggiungi dati gravidanza facoltativi"}
          </Button>
        </>
      ) : (
        <>
          <Text style={ui.label}>
            Data dell’ultima mestruazione (facoltativa)
          </Text>
          <TextInput
            accessibilityLabel="Data dell’ultima mestruazione"
            placeholder="AAAA-MM-GG"
            value={draft.last_menstrual_date ?? ""}
            onChangeText={(value) =>
              change({ last_menstrual_date: value.trim() || null })
            }
            editable={!locked}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={10}
            style={ui.input}
          />
          <Text style={ui.body}>
            {lmpAge
              ? `Calcolo dall’ultima mestruazione: ${lmpAge.weeks} settimane + ${lmpAge.days} giorni oggi.`
              : "La data permette di calcolare automaticamente settimane e giorni."}
          </Text>
          <Choice
            label="Il calcolo corrisponde all’ecografia?"
            value={draft.ultrasound_matches}
            disabled={locked}
            onChange={(value) => {
              change({
                ultrasound_matches: value,
                ultrasound_weeks: null,
                ultrasound_days: null,
                ultrasound_reference_date:
                  value === false ? todayCalendarDate() : null,
              });
              setManualEditing(value === false);
            }}
          />
          {draft.ultrasound_matches === false && (
            <View style={{ gap: 12 }}>
              {age && (
                <Text style={ui.body}>
                  Età gestazionale ecografica oggi: {age.weeks} settimane +{" "}
                  {age.days} giorni.
                </Text>
              )}
              {!manualEditing && draft.ultrasound_reference_date ? (
                <>
                  <Text style={ui.body}>
                    Valori indicati il {draft.ultrasound_reference_date}:{" "}
                    {draft.ultrasound_weeks} settimane + {draft.ultrasound_days}{" "}
                    giorni. Il calcolo avanza ogni giorno.
                  </Text>
                  <Button
                    variant="quiet"
                    disabled={locked}
                    onPress={() => {
                      change({
                        ultrasound_weeks: age?.weeks ?? null,
                        ultrasound_days: age?.days ?? null,
                        ultrasound_reference_date: todayCalendarDate(),
                      });
                      setManualEditing(true);
                    }}
                  >
                    Modifica la datazione riferita a oggi
                  </Button>
                </>
              ) : (
                <>
                  <Text style={ui.label}>
                    Settimane e giorni secondo l’ecografia, riferiti a oggi (
                    {today})
                  </Text>
                  <TextInput
                    accessibilityLabel="Settimane ecografiche oggi"
                    placeholder="Settimane (0–43)"
                    value={
                      draft.ultrasound_weeks === null
                        ? ""
                        : String(draft.ultrasound_weeks)
                    }
                    onChangeText={(value) => {
                      if (/^\d{0,2}$/u.test(value))
                        change({
                          ultrasound_weeks: value === "" ? null : Number(value),
                          ultrasound_reference_date: todayCalendarDate(),
                        });
                    }}
                    keyboardType="number-pad"
                    editable={!locked}
                    maxLength={2}
                    style={ui.input}
                  />
                  <TextInput
                    accessibilityLabel="Giorni ecografici oggi"
                    placeholder="Giorni (0–6)"
                    value={
                      draft.ultrasound_days === null
                        ? ""
                        : String(draft.ultrasound_days)
                    }
                    onChangeText={(value) => {
                      if (/^\d?$/u.test(value))
                        change({
                          ultrasound_days: value === "" ? null : Number(value),
                          ultrasound_reference_date: todayCalendarDate(),
                        });
                    }}
                    keyboardType="number-pad"
                    editable={!locked}
                    maxLength={1}
                    style={ui.input}
                  />
                </>
              )}
            </View>
          )}
          <Choice
            label="Hai avuto altre gravidanze?"
            value={draft.previous_pregnancies}
            disabled={locked}
            onChange={(value) =>
              change({
                previous_pregnancies: value,
                previous_outcomes:
                  value === true ? draft.previous_outcomes : [],
              })
            }
          />
          {draft.previous_pregnancies === true && (
            <View style={{ gap: 8 }}>
              <Text style={ui.label}>
                Esiti precedenti (facoltativi; puoi scegliere più esiti)
              </Text>
              {pregnancyOutcomeOptions.map((option) => (
                <Consent
                  key={option.id}
                  label={option.label}
                  value={draft.previous_outcomes.includes(option.id)}
                  disabled={locked}
                  onChange={(checked) =>
                    change({
                      previous_outcomes: checked
                        ? option.id === "not_indicated"
                          ? [option.id]
                          : [
                              ...draft.previous_outcomes.filter(
                                (value) => value !== "not_indicated",
                              ),
                              option.id,
                            ]
                        : draft.previous_outcomes.filter(
                            (value) => value !== option.id,
                          ),
                    })
                  }
                />
              ))}
            </View>
          )}
          <Consent
            label="Acconsento esplicitamente a conservare nel mio account questi dati sulla gravidanza e sulle gravidanze precedenti. Posso ritirare il consenso e rimuoverli in qualsiasi momento."
            value={draft.storage_consent}
            onChange={(value) => change({ storage_consent: value })}
            disabled={locked}
          />
          <Consent
            label="Acconsento esplicitamente a condividere questi dati sulla salute con Gaia, per preparare il mio accompagnamento. È facoltativo e posso revocarlo separatamente."
            value={draft.gaia_share_consent}
            onChange={(value) => change({ gaia_share_consent: value })}
            disabled={locked}
          />
          <Consent
            label="Acconsento a usare la datazione di questa scheda per personalizzare i contenuti del mio percorso. È una scelta facoltativa e separata."
            value={draft.personalization_consent}
            onChange={(value) => change({ personalization_consent: value })}
            disabled={locked}
          />
          <Text style={ui.body}>
            La stima non sostituisce la datazione e le indicazioni del
            professionista che ti segue. Tutte le risposte sono facoltative.
          </Text>
          <Button disabled={locked || !dirty} onPress={() => void save()}>
            {saving ? "Salvataggio…" : "Salva la scheda gravidanza"}
          </Button>
          <Button
            variant="quiet"
            disabled={locked}
            onPress={() => {
              if (
                confirmDiscard(
                  "Ricaricare sostituirà le modifiche non salvate. Vuoi continuare?",
                )
              )
                void reload();
            }}
          >
            Ricarica scheda salvata
          </Button>
        </>
      )}
      {saved?.gaia_share_consent && (
        <Button
          variant="quiet"
          disabled={loading || saving}
          onPress={() => void revokePurpose("gaia")}
        >
          Ritira subito la condivisione gravidanza con Gaia
        </Button>
      )}
      {saved?.personalization_consent && (
        <Button
          variant="quiet"
          disabled={loading || saving}
          onPress={() => void revokePurpose("personalization")}
        >
          Ritira subito la personalizzazione gravidanza
        </Button>
      )}
      {saved?.storage_consent && (
        <Button
          variant="quiet"
          disabled={loading || saving}
          onPress={() => void revoke()}
        >
          Ritira tutti i consensi e rimuovi i dati gravidanza
        </Button>
      )}
      {message !== "" && (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Notice>{message}</Notice>
        </View>
      )}
    </View>
  );
}
