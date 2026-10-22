import React, { useState } from "react";
import { Pressable, Text, TextInput, View, Switch } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { type JourneyType } from "@nido/core";
import { useApp } from "../src/state";
import { Brand, Button, Notice, Screen, Tag, ui } from "../src/ui";
import { NestArt } from "../src/art";
import { colors, serif } from "../src/theme";
const choices: { id: JourneyType; title: string; subtitle: string }[] = [
  {
    id: "pregnancy",
    title: "Aspetto un bambino",
    subtitle: "Informazioni e piccoli passi per la gravidanza.",
  },
  {
    id: "partner",
    title: "Accompagno una persona",
    subtitle: "Uno spazio anche per chi sta accanto.",
  },
  {
    id: "postpartum",
    title: "Sono già genitore",
    subtitle: "I primi incontri, il recupero e i nuovi ritmi.",
  },
];
export default function Welcome() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { state, updatePreferences, demo } = useApp();
  const [step, setStep] = useState(edit ? 1 : 0);
  const [draft, setDraft] = useState({ ...state.preferences });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function finish(guest = false) {
    setBusy(true);
    setError("");
    try {
      await updatePreferences({
        ...draft,
        onboarded: true,
        personalized: guest ? false : draft.personalized,
        sensitiveConsent: guest ? false : draft.sensitiveConsent,
        date: guest ? null : draft.date,
      });
      router.replace("/(tabs)");
    } catch {
      setError("Non abbiamo salvato le preferenze. Riprova.");
    } finally {
      setBusy(false);
    }
  }
  function next() {
    setError("");
    if (
      step === 2 &&
      draft.date &&
      draft.personalized &&
      draft.sensitiveConsent
    ) {
      const d = new Date(draft.date + "T00:00:00Z");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
        Number.isNaN(d.valueOf()) ||
        d.toISOString().slice(0, 10) !== draft.date
      ) {
        setError(
          "Usa una data valida nel formato AAAA-MM-GG, oppure lascia vuoto.",
        );
        return;
      }
      if (draft.journey === "postpartum" && d.valueOf() > Date.now()) {
        setError("La data di nascita non può essere nel futuro.");
        return;
      }
    }
    setStep(step + 1);
  }
  return (
    <Screen>
      {step === 0 ? (
        <View style={{ gap: 22 }}>
          <NestArt variant={2} style={{ height: 230, borderRadius: 25 }} />
          <Brand />
          <Tag>IL TUO SPAZIO, FIN DALL’INIZIO</Tag>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: serif,
              fontSize: 43,
              lineHeight: 50,
              color: colors.ink,
            }}
          >
            Uno spazio per ogni nuovo inizio.
          </Text>
          <Text style={ui.body}>
            Gravidanza, nascita e primi giorni insieme. Nido ti accompagna con
            contenuti educativi e piccoli strumenti, da vivere con i tuoi tempi.
          </Text>
          <Text style={[ui.heading, { fontStyle: "italic" }]}>
            Insieme, passo dopo passo.
          </Text>
          <Button onPress={() => setStep(1)}>Iniziamo insieme</Button>
          <Button
            variant="quiet"
            disabled={busy}
            onPress={() => {
              void finish(true);
            }}
          >
            Esplora come ospite
          </Button>
          <Text style={ui.body}>
            Nessun account necessario. Nessuna data obbligatoria.
          </Text>
          {demo && (
            <Notice warm>
              DEMO MODE · Contenuti e percorsi sono esempi, non ancora
              revisionati da un’ostetrica.
            </Notice>
          )}
        </View>
      ) : (
        <View
          style={{ width: "100%", maxWidth: 620, alignSelf: "center", gap: 20 }}
        >
          <Button variant="quiet" onPress={() => setStep(step - 1)}>
            Passo precedente
          </Button>
          <Tag>{`IL TUO PERCORSO · ${step} DI 3`}</Tag>
          {step === 1 && (
            <>
              <Text accessibilityRole="header" style={ui.heading}>
                Da dove iniziamo?
              </Text>
              <Text style={ui.body}>
                Ogni storia è diversa. Potrai cambiare percorso quando vuoi.
              </Text>
              {choices.map((choice) => (
                <Pressable
                  key={choice.id}
                  accessibilityRole="radio"
                  accessibilityLabel={choice.title}
                  accessibilityState={{ checked: draft.journey === choice.id }}
                  aria-checked={draft.journey === choice.id}
                  onPress={() =>
                    setDraft({ ...draft, journey: choice.id, date: null })
                  }
                  style={[
                    ui.card,
                    {
                      gap: 8,
                      borderColor:
                        draft.journey === choice.id
                          ? colors.sageDark
                          : colors.border,
                      backgroundColor:
                        draft.journey === choice.id
                          ? colors.sagePale
                          : colors.paper,
                    },
                  ]}
                >
                  <Text style={ui.label}>{choice.title}</Text>
                  <Text style={ui.body}>{choice.subtitle}</Text>
                </Pressable>
              ))}
              <Notice>
                Il partner può utilizzare Nido senza condividere date o
                informazioni sulla salute di un’altra persona.
              </Notice>
            </>
          )}
          {step === 2 && (
            <>
              <Text accessibilityRole="header" style={ui.heading}>
                Un percorso che ti somiglia.
              </Text>
              <Text style={ui.body}>
                La data è facoltativa. Il tuo percorso funziona anche senza.
              </Text>
              <View style={[ui.row, { justifyContent: "space-between" }]}>
                <Text style={[ui.label, { flex: 1 }]}>
                  Desidero un percorso personalizzato
                </Text>
                <Switch
                  accessibilityLabel="Desidero un percorso personalizzato"
                  value={draft.personalized}
                  onValueChange={(value) =>
                    setDraft({
                      ...draft,
                      personalized: value,
                      date: value ? draft.date : null,
                      sensitiveConsent: value ? draft.sensitiveConsent : false,
                    })
                  }
                />
              </View>
              {draft.personalized && (
                <>
                  <Notice icon="lock">
                    Prima di scegliere una data: può rivelare informazioni sulla
                    salute.{" "}
                    {demo
                      ? "Nella demo resta su questo dispositivo, senza cifratura locale dedicata."
                      : "Se accedi sarà associata al tuo account; come ospite resta sul dispositivo."}{" "}
                    Puoi ritirare il consenso e cancellarla dal profilo.
                  </Notice>
                  <Button
                    variant="quiet"
                    onPress={() => router.push("/privacy")}
                  >
                    Leggi l’informativa privacy
                  </Button>
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel="Acconsento al salvataggio della data facoltativa"
                    accessibilityState={{ checked: draft.sensitiveConsent }}
                    aria-checked={draft.sensitiveConsent}
                    onPress={() =>
                      setDraft({
                        ...draft,
                        sensitiveConsent: !draft.sensitiveConsent,
                        date: draft.sensitiveConsent ? null : draft.date,
                      })
                    }
                    style={[
                      ui.card,
                      {
                        backgroundColor: draft.sensitiveConsent
                          ? colors.sagePale
                          : colors.paper,
                      },
                    ]}
                  >
                    <Text style={ui.body}>
                      {draft.sensitiveConsent ? "✓ " : ""}Acconsento al
                      salvataggio della data facoltativa per personalizzare il
                      mio percorso.
                    </Text>
                  </Pressable>
                  {draft.sensitiveConsent && (
                    <>
                      <Text style={ui.label}>
                        {draft.journey === "postpartum"
                          ? "Data di nascita (facoltativa)"
                          : "Data presunta del parto (facoltativa)"}
                      </Text>
                      <TextInput
                        accessibilityLabel={
                          draft.journey === "postpartum"
                            ? "Data di nascita facoltativa"
                            : "Data presunta del parto facoltativa"
                        }
                        placeholder="AAAA-MM-GG"
                        value={draft.date ?? ""}
                        maxLength={10}
                        onChangeText={(date) =>
                          setDraft({ ...draft, date: date || null })
                        }
                        style={ui.input}
                      />
                      <Text style={ui.body}>
                        Stima educativa approssimativa, non sostituisce la
                        datazione professionale.
                      </Text>
                    </>
                  )}
                </>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <Text accessibilityRole="header" style={ui.heading}>
                Solo ciò che ti fa stare bene.
              </Text>
              <Text style={ui.body}>
                Scegli i temi che desideri esplorare. Ogni famiglia può seguire
                un percorso diverso.
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {[
                  "Allattamento al seno",
                  "Alimentazione con formula",
                  "Alimentazione mista",
                  "Supporto e scelte informate",
                ].map((topic) => {
                  const active = draft.feedingTopics.includes(topic);
                  return (
                    <Pressable
                      key={topic}
                      accessibilityRole="checkbox"
                      accessibilityLabel={topic}
                      accessibilityState={{ checked: active }}
                      aria-checked={active}
                      onPress={() =>
                        setDraft({
                          ...draft,
                          feedingTopics: active
                            ? draft.feedingTopics.filter((t) => t !== topic)
                            : [...draft.feedingTopics, topic],
                        })
                      }
                      style={[ui.pill, active && ui.pillActive]}
                    >
                      <Text style={[ui.pillText, active && ui.pillTextActive]}>
                        {topic}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={ui.row}>
                <View style={{ flex: 1 }}>
                  <Text style={ui.label}>Promemoria del percorso</Text>
                  <Text style={ui.body}>
                    Preferenza salvata. Invio notifiche previsto in un prossimo
                    aggiornamento.
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="Promemoria del percorso"
                  value={draft.notifications}
                  onValueChange={(notifications) =>
                    setDraft({ ...draft, notifications })
                  }
                />
              </View>
              <View style={ui.row}>
                <View style={{ flex: 1 }}>
                  <Text style={ui.label}>Novità di Nido</Text>
                  <Text style={ui.body}>
                    Consenso marketing facoltativo e separato. Nessun invio
                    attivo.
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="Consenso marketing facoltativo"
                  value={draft.marketing}
                  onValueChange={(marketing) =>
                    setDraft({ ...draft, marketing })
                  }
                />
              </View>
            </>
          )}
          {error && (
            <Text accessibilityRole="alert" style={{ color: colors.error }}>
              {error}
            </Text>
          )}
          <Button
            disabled={busy}
            onPress={() => {
              if (step === 3) void finish();
              else next();
            }}
          >
            {busy
              ? "Salvataggio…"
              : step === 3
                ? "Entra nel tuo Nido"
                : "Continua"}
          </Button>
          <Button
            variant="quiet"
            disabled={busy}
            onPress={() => {
              void finish(true);
            }}
          >
            Continua senza personalizzazione
          </Button>
        </View>
      )}
    </Screen>
  );
}
