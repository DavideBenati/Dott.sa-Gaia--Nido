import { Text, TextInput } from "../src/typography";
import React, { useState } from "react";
import { Pressable, View, Switch } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { type JourneyType } from "@nido/core";
import { PregnancyProfileEditor } from "../src/pregnancy-profile-editor";
import { useApp } from "../src/state";
import {
  Brand,
  Button,
  Notice,
  Screen,
  StageHeading,
  Tag,
  ui,
} from "../src/ui";
import { colors, serif } from "../src/theme";
const choices: {
  id: JourneyType | "exploring";
  title: string;
  subtitle: string;
}[] = [
  {
    id: "pregnancy",
    title: "Aspetto un bambino",
    subtitle: "Informazioni e piccoli passi per la gravidanza.",
  },
  {
    id: "partner",
    title: "Sono un familiare o amico",
    subtitle: "Per accompagnare la famiglia, nell’attesa o dopo la nascita.",
  },
  {
    id: "postpartum",
    title: "Dopo la nascita",
    subtitle: "I primi incontri, il recupero e i nuovi ritmi.",
  },
  {
    id: "exploring",
    title: "Mi informo",
    subtitle: "Esploro i contenuti senza indicare una fase personale.",
  },
];
export default function Welcome() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { state, updatePreferences, demo, email, updatePregnancyProfile } =
    useApp();
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
        marketing: false,
        personalized:
          guest || draft.exploreOnly || draft.journey === "partner"
            ? false
            : draft.personalized,
        sensitiveConsent:
          guest || draft.exploreOnly || draft.journey === "partner"
            ? false
            : draft.sensitiveConsent,
        date:
          guest || draft.exploreOnly || draft.journey === "partner"
            ? null
            : draft.date,
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
    <Screen stageKey={step} focusTargetId={`welcome-step-${step}`}>
      {step === 0 ? (
        <View
          style={{ width: "100%", maxWidth: 680, alignSelf: "center", gap: 20 }}
        >
          <Brand compact />
          <Tag>IL TUO SPAZIO, FIN DALL’INIZIO</Tag>
          <StageHeading
            id="welcome-step-0"
            style={{
              fontFamily: serif,
              fontSize: 36,
              lineHeight: 43,
              color: colors.ink,
            }}
          >
            Da dove iniziamo?
          </StageHeading>
          <Text style={ui.body}>
            Scegli il punto da cui partire e crea il tuo account: ritroverai
            checklist, articoli preferiti e le persone con cui vuoi condividere
            il percorso.
          </Text>
          {choices.map((choice) => {
            const selected =
              choice.id === "exploring"
                ? Boolean(draft.exploreOnly)
                : !draft.exploreOnly && draft.journey === choice.id;
            return (
              <Pressable
                key={choice.id}
                accessibilityRole="radio"
                accessibilityLabel={choice.title}
                accessibilityState={{ checked: selected }}
                aria-checked={selected}
                onPress={() =>
                  setDraft({
                    ...draft,
                    journey:
                      choice.id === "exploring" ? "pregnancy" : choice.id,
                    exploreOnly: choice.id === "exploring",
                    date: null,
                  })
                }
                style={[
                  ui.card,
                  {
                    gap: 6,
                    padding: 18,
                    borderColor: selected ? colors.sageDark : colors.border,
                    backgroundColor: selected ? colors.sagePale : colors.paper,
                  },
                ]}
              >
                <Text style={[ui.label, selected && { fontWeight: "700" }]}>
                  {choice.title}
                </Text>
                <Text style={ui.body}>{choice.subtitle}</Text>
              </Pressable>
            );
          })}
          <Button
            onPress={() =>
              email
                ? setStep(1)
                : router.push({
                    pathname: "/account",
                    params: {
                      journey: draft.exploreOnly ? "exploring" : draft.journey,
                    },
                  })
            }
          >
            {email ? "Personalizza il mio percorso" : "Iscriviti e iniziamo"}
          </Button>
          {!email && (
            <Button
              variant="secondary"
              onPress={() => router.push("/account?mode=login")}
            >
              Hai già un account? Accedi
            </Button>
          )}
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
            Puoi leggere anche senza account. Le informazioni personali restano
            facoltative.
          </Text>
          {demo && (
            <Notice warm>
              Modalità dimostrativa: account e sincronizzazione richiedono
              Supabase.
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
              <StageHeading id="welcome-step-1">Da dove iniziamo?</StageHeading>
              <Text style={ui.body}>
                Ogni storia è diversa. Potrai cambiare percorso quando vuoi.
              </Text>
              {choices.map((choice) => (
                <Pressable
                  key={choice.id}
                  accessibilityRole="radio"
                  accessibilityLabel={choice.title}
                  accessibilityState={{
                    checked:
                      choice.id === "exploring"
                        ? Boolean(draft.exploreOnly)
                        : !draft.exploreOnly && draft.journey === choice.id,
                  }}
                  aria-checked={
                    choice.id === "exploring"
                      ? Boolean(draft.exploreOnly)
                      : !draft.exploreOnly && draft.journey === choice.id
                  }
                  onPress={() =>
                    setDraft({
                      ...draft,
                      journey:
                        choice.id === "exploring" ? "pregnancy" : choice.id,
                      exploreOnly: choice.id === "exploring",
                      date: null,
                    })
                  }
                  style={[
                    ui.card,
                    {
                      gap: 8,
                      borderColor: (
                        choice.id === "exploring"
                          ? draft.exploreOnly
                          : !draft.exploreOnly && draft.journey === choice.id
                      )
                        ? colors.sageDark
                        : colors.border,
                      backgroundColor: (
                        choice.id === "exploring"
                          ? draft.exploreOnly
                          : !draft.exploreOnly && draft.journey === choice.id
                      )
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
                Un familiare o un amico può utilizzare MetiMaia senza
                condividere date o informazioni sulla salute di un’altra
                persona.
              </Notice>
            </>
          )}
          {step === 2 && (
            <>
              <StageHeading id="welcome-step-2">
                Un percorso che ti somiglia.
              </StageHeading>
              {draft.exploreOnly ? (
                <Notice>
                  Il percorso generale non usa date o stime di settimane. Nel
                  prossimo passaggio puoi scegliere i temi che ti interessano.
                </Notice>
              ) : draft.journey === "partner" ? (
                <>
                  <Text style={ui.body}>Quale fase desideri approfondire?</Text>
                  {(
                    [
                      ["pregnancy", "Durante l’attesa"],
                      ["postpartum", "Dopo la nascita"],
                    ] as const
                  ).map(([stage, label]) => (
                    <Button
                      key={stage}
                      variant={
                        (draft.partnerStage ?? "pregnancy") === stage
                          ? "secondary"
                          : "quiet"
                      }
                      onPress={() =>
                        setDraft({
                          ...draft,
                          partnerStage: stage,
                          date: null,
                          personalized: false,
                          sensitiveConsent: false,
                        })
                      }
                    >
                      {`${(draft.partnerStage ?? "pregnancy") === stage ? "✓ " : ""}${label}`}
                    </Button>
                  ))}
                  {email && (
                    <Button
                      variant="secondary"
                      onPress={() => router.push("/condivisioni")}
                    >
                      Collega il nickname della persona che accompagni
                    </Button>
                  )}
                  <Notice>
                    Per accompagnare una persona basta scegliere la fase: non
                    servono date o dati sulla salute di altri.
                  </Notice>
                </>
              ) : draft.journey === "pregnancy" ? (
                email ? (
                  <PregnancyProfileEditor
                    key={email}
                    onProfileChange={updatePregnancyProfile}
                  />
                ) : (
                  <>
                    <Notice>
                      Accedi per compilare la scheda facoltativa della
                      gravidanza. I dati non saranno condivisi con familiari e
                      amici.
                    </Notice>
                    <Button
                      onPress={() => router.push("/account?journey=pregnancy")}
                    >
                      Crea account o accedi
                    </Button>
                  </>
                )
              ) : (
                <>
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
                          sensitiveConsent: value
                            ? draft.sensitiveConsent
                            : false,
                        })
                      }
                    />
                  </View>
                  {draft.personalized && (
                    <>
                      <Notice icon="lock">
                        Prima di scegliere una data: può rivelare informazioni
                        sulla salute.{" "}
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
                          trattamento della data facoltativa, che può rivelare
                          informazioni sulla salute, per personalizzare il mio
                          percorso. Posso revocare il consenso dal profilo e
                          continuare senza data.
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
            </>
          )}
          {step === 3 && (
            <>
              <StageHeading id="welcome-step-3">
                Solo ciò che ti fa stare bene.
              </StageHeading>
              <Text style={ui.body}>
                Scegli i temi che desideri esplorare. Ogni famiglia può seguire
                un percorso diverso.
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {[
                  "Gravidanza",
                  "Preparazione al parto",
                  "Travaglio e nascita",
                  "Dopo la nascita",
                  "Cura del neonato",
                  "Benessere emotivo",
                  "Ruolo del partner",
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
              <Text style={ui.body}>
                Le comunicazioni promozionali non sono attive. Non ti chiediamo
                un consenso per invii futuri.
              </Text>
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
            {busy ? "Salvataggio…" : step === 3 ? "Entra in MAIA" : "Continua"}
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
