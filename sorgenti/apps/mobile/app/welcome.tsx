import { Text, TextInput } from "../src/typography";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, View, Switch } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  PROFILE_TYPE_CHOICES,
  isProfileType,
  preferencesForProfileType,
  type Preferences,
} from "@nido/core";
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
import { cancelAccountEntry } from "../src/entry-navigation";
import { confirmPendingNavigation } from "../src/unsaved-changes";

export default function Welcome() {
  const { userId, email, preferencesLoaded } = useApp();
  if (email && !preferencesLoaded)
    return (
      <Screen>
        <Notice>
          Non riusciamo a caricare le preferenze. Accedi nuovamente prima di
          completare il profilo.
        </Notice>
        <Button onPress={() => router.replace("/account")}>
          Vai all’account
        </Button>
      </Screen>
    );
  return <WelcomeFlow key={userId ?? "guest"} />;
}

function WelcomeFlow() {
  const { edit, returnTo, stage } = useLocalSearchParams<{
    edit?: string;
    returnTo?: string;
    stage?: string;
  }>();
  const {
    state,
    updatePreferences,
    demo,
    email,
    userId,
    updatePregnancyProfile,
  } = useApp();
  const [step, setStep] = useState(() => {
    if (!email) return 0;
    if (
      !isProfileType(state.preferences.profileType) ||
      stage === "profile" ||
      (edit && !stage)
    )
      return 1;
    if (stage === "topics") return 3;
    return ["parent", "partner"].includes(state.preferences.profileType)
      ? 2
      : 3;
  });
  const [draft, setDraft] = useState({ ...state.preferences });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function moveTo(nextStep: number) {
    router.setParams({
      stage: nextStep === 1 ? "profile" : nextStep === 2 ? "journey" : "topics",
    });
    setStep(nextStep);
  }
  function browse() {
    if (!confirmPendingNavigation()) return;
    cancelAccountEntry();
    router.replace("/(tabs)");
  }
  async function finish(skipPersonalization = false) {
    if (busy || !confirmPendingNavigation()) return;
    if (!email) {
      browse();
      return;
    }
    if (!isProfileType(draft.profileType)) {
      setError("Scegli il tipo di profilo per completare l’iscrizione.");
      moveTo(1);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const general = draft.profileType !== "parent";
      await updatePreferences({
        ...draft,
        onboarded: true,
        personalized:
          skipPersonalization || general ? false : draft.personalized,
        sensitiveConsent:
          skipPersonalization || general ? false : draft.sensitiveConsent,
        date: skipPersonalization || general ? null : draft.date,
      });
      if (mounted.current)
        router.replace(
          returnTo === "documents"
            ? "/miei-documenti"
            : returnTo === "project"
              ? "/gaia?start=1"
              : "/(tabs)",
        );
    } catch {
      if (mounted.current)
        setError("Non abbiamo salvato le preferenze. Riprova.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function next() {
    if (busy || !confirmPendingNavigation()) return;
    setError("");
    if (step === 1 && !isProfileType(draft.profileType)) {
      setError("Scegli il tipo di profilo per continuare.");
      return;
    }
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
    setBusy(true);
    try {
      const nextDraft: Preferences =
        step === 1
          ? {
              ...preferencesForProfileType(draft, draft.profileType!),
              onboarded: false,
            }
          : draft;
      await updatePreferences(nextDraft);
      if (!mounted.current) return;
      setDraft(nextDraft);
      moveTo(
        step === 1 && !["parent", "partner"].includes(nextDraft.profileType!)
          ? 3
          : step + 1,
      );
    } catch {
      if (mounted.current)
        setError("Non abbiamo salvato le preferenze. Riprova.");
    } finally {
      if (mounted.current) setBusy(false);
    }
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
            Crea il tuo account per ritrovare checklist, articoli preferiti e le
            persone con cui vuoi condividere il percorso. Dopo l’accesso
            sceglierai il tipo di profilo e ciò che desideri approfondire.
          </Text>
          <Button onPress={() => router.push("/account")}>
            Iscriviti e iniziamo
          </Button>
          {!email && (
            <Button
              variant="secondary"
              onPress={() => router.push("/account?mode=login")}
            >
              Hai già un account? Accedi
            </Button>
          )}
          <Button variant="quiet" disabled={busy} onPress={browse}>
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
          {step > 1 && (
            <Button
              variant="quiet"
              disabled={busy}
              onPress={() => {
                if (confirmPendingNavigation())
                  moveTo(
                    step === 3 &&
                      !["parent", "partner"].includes(draft.profileType ?? "")
                      ? 1
                      : step - 1,
                  );
              }}
            >
              Passo precedente
            </Button>
          )}
          <Tag>{`IL TUO PROFILO · ${step} DI 3`}</Tag>
          {step === 1 && (
            <>
              <StageHeading id="welcome-step-1">
                Come vuoi vivere MAIA?
              </StageHeading>
              <Text style={ui.body}>
                Scegli il tipo di profilo per completare l’iscrizione. Potrai
                cambiarlo dal profilo; date e informazioni personali restano
                facoltative.
              </Text>
              {PROFILE_TYPE_CHOICES.map((choice) => {
                const selected = draft.profileType === choice.id;
                return (
                  <Pressable
                    key={choice.id}
                    accessibilityRole="radio"
                    accessibilityLabel={choice.title}
                    accessibilityState={{ checked: selected, disabled: busy }}
                    aria-checked={selected}
                    disabled={busy}
                    onPress={() =>
                      setDraft({ ...draft, profileType: choice.id })
                    }
                    style={[
                      ui.card,
                      {
                        gap: 8,
                        borderColor: selected ? colors.sageDark : colors.border,
                        backgroundColor: selected
                          ? colors.sagePale
                          : colors.paper,
                      },
                    ]}
                  >
                    <Text style={ui.label}>{choice.title}</Text>
                    <Text style={ui.body}>{choice.subtitle}</Text>
                  </Pressable>
                );
              })}
            </>
          )}
          {step === 2 && (
            <>
              <StageHeading id="welcome-step-2">
                Un percorso che ti somiglia.
              </StageHeading>
              {draft.profileType === "parent" && (
                <>
                  <Text style={ui.body}>Quale fase desideri approfondire?</Text>
                  {(
                    [
                      ["pregnancy", "Durante l’attesa"],
                      ["postpartum", "Dopo la nascita"],
                    ] as const
                  ).map(([stage, label]) => (
                    <Pressable
                      key={stage}
                      accessibilityRole="radio"
                      accessibilityLabel={label}
                      accessibilityState={{
                        checked: draft.journey === stage,
                        disabled: busy,
                      }}
                      aria-checked={draft.journey === stage}
                      disabled={busy}
                      onPress={() => {
                        if (
                          draft.journey === stage ||
                          !confirmPendingNavigation()
                        )
                          return;
                        setDraft({
                          ...draft,
                          journey: stage,
                          date: null,
                          personalized: false,
                          sensitiveConsent: false,
                        });
                      }}
                      style={[
                        ui.card,
                        {
                          backgroundColor:
                            draft.journey === stage
                              ? colors.sagePale
                              : colors.paper,
                        },
                      ]}
                    >
                      <Text
                        style={ui.label}
                      >{`${draft.journey === stage ? "● " : "○ "}${label}`}</Text>
                    </Pressable>
                  ))}
                </>
              )}
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
                      disabled={busy}
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
                    key={userId ?? email}
                    onProfileChange={updatePregnancyProfile}
                  />
                ) : (
                  <>
                    <Notice>
                      Accedi per compilare la scheda facoltativa della
                      gravidanza. I dati non saranno condivisi con familiari e
                      amici.
                    </Notice>
                    <Button onPress={() => router.push("/account")}>
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
              {["relative", "friend"].includes(draft.profileType ?? "") && (
                <>
                  <Notice>
                    Puoi sostenere la famiglia senza indicare date o
                    informazioni sulla salute di un’altra persona.
                  </Notice>
                  <Button
                    variant="secondary"
                    onPress={() => router.push("/condivisioni")}
                  >
                    Collega il nickname della persona che accompagni
                  </Button>
                </>
              )}
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
            disabled={busy || (step === 1 && !isProfileType(draft.profileType))}
            onPress={() => {
              if (step === 3) void finish();
              else void next();
            }}
          >
            {busy ? "Salvataggio…" : step === 3 ? "Entra in MAIA" : "Continua"}
          </Button>
          {step > 1 && (
            <Button
              variant="quiet"
              disabled={busy}
              onPress={() => {
                void finish(true);
              }}
            >
              Continua senza personalizzazione
            </Button>
          )}
          <Button variant="quiet" disabled={busy} onPress={browse}>
            Continua a leggere, completo il profilo più tardi
          </Button>
        </View>
      )}
    </Screen>
  );
}
