import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Screen, Button, Notice, ui } from "../src/ui";
import { Text, TextInput } from "../src/typography";
import { useApp } from "../src/state";
import { useUnsavedChanges } from "../src/unsaved-changes";
import { useEditorAccess } from "../src/editor-access";
import {
  defaultProfile,
  loadProfile,
  saveProfile,
  type SiteProfile,
} from "../src/professional";
import {
  isInitialGaiaPresentation,
  withGaiaPresentation,
} from "../src/gaia-presentation";
export default function Settings() {
  const { email } = useApp();
  return (
    <Screen
      back
      professional
      title="Presentazione MetiMaia e privacy"
      subtitle="Le modifiche salvate alla presentazione diventano pubbliche."
    >
      {email ? (
        <Editor key={email} />
      ) : (
        <Button onPress={() => router.push("/account?mode=login")}>
          Accedi
        </Button>
      )}
    </Screen>
  );
}
function Editor() {
  const { allowed, checking } = useEditorAccess();
  const [profile, setProfile] = useState<SiteProfile>(defaultProfile);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const saving = useRef(false);
  const { allowNavigation, confirmDiscard } = useUnsavedChanges(dirty);
  useEffect(() => {
    let active = true;
    if (allowed) {
      setReady(false);
      setLoadError("");
      setMessage("");
      void loadProfile({ strict: true })
        .then((p) => {
          if (active) {
            setProfile(p);
            setReady(true);
            setDirty(false);
          }
        })
        .catch((error) => {
          if (active)
            setLoadError(
              error instanceof Error
                ? error.message
                : "Caricamento non riuscito. Riprova prima di modificare i dati.",
            );
        });
    }
    return () => {
      active = false;
    };
  }, [allowed, reload]);
  function update(p: Partial<SiteProfile>) {
    if (saving.current) return;
    setProfile((v) => ({ ...v, ...p }));
    setDirty(true);
    setMessage("");
  }
  async function save() {
    if (!ready || !dirty || saving.current || !allowed) return;
    saving.current = true;
    setBusy(true);
    setMessage("");
    try {
      await saveProfile(profile);
      setDirty(false);
      setMessage("Modifiche salvate. La presentazione MetiMaia è aggiornata.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Salvataggio non riuscito.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function field(
    label: string,
    key:
      | "bio"
      | "portrait_url"
      | "qualifications"
      | "service_area"
      | "contact_email"
      | "privacy_providers"
      | "privacy_retention"
      | "privacy_transfers",
  ) {
    return (
      <View key={key} style={{ gap: 8 }}>
        <Text style={ui.label}>{label}</Text>
        <TextInput
          accessibilityLabel={label}
          editable={!busy}
          value={profile[key]}
          onChangeText={(v) => update({ [key]: v })}
          multiline={key !== "contact_email" && key !== "portrait_url"}
          maxLength={10000}
          style={ui.input}
        />
      </View>
    );
  }
  return (
    <View
      style={{ maxWidth: 800, width: "100%", alignSelf: "center", gap: 20 }}
    >
      {checking ? (
        <Notice>Verifica permessi…</Notice>
      ) : !allowed ? (
        <Notice>
          Accesso riservato. Se hai attivato la protezione a due fattori,
          verifica il codice nella pagina Sicurezza.
        </Notice>
      ) : !ready ? (
        loadError ? (
          <View accessibilityRole="alert" style={{ gap: 12 }}>
            <Notice warm>{loadError}</Notice>
            <Button onPress={() => setReload((value) => value + 1)}>
              Riprova caricamento informazioni
            </Button>
          </View>
        ) : (
          <Notice>Caricamento delle informazioni attuali…</Notice>
        )
      ) : (
        <>
          <Notice>
            Non inserire dati di pazienti. Questi testi presentano il progetto
            MetiMaia alle famiglie. La pagina pubblica usa il logo del progetto.
          </Notice>
          <Text style={ui.heading}>
            {isInitialGaiaPresentation(profile)
              ? "La presentazione è pronta"
              : "Prima di pubblicare la presentazione"}
          </Text>
          <Text style={ui.body}>
            {isInitialGaiaPresentation(profile)
              ? "La pagina pubblica mostra già la filosofia di MetiMaia dal nuovo documento. Per modificarla da qui, premi Usa la presentazione dal documento e poi Salva modifiche."
              : [
                  !profile.bio && "Introduzione del progetto da completare",
                  !profile.services.length && "Tappe del percorso da definire",
                  !profile.privacy_retention &&
                    "Criteri di conservazione da definire",
                  !profile.privacy_transfers &&
                    "Trasferimenti e garanzie da verificare",
                ]
                  .filter(Boolean)
                  .join(" · ") ||
                "I campi principali sono compilati: verifica che siano corretti e aggiornati."}
          </Text>
          <Notice>
            I campi non compilati non vengono sostituiti con informazioni
            inventate. Puoi aggiornare i contenuti del progetto senza pubblicare
            informazioni personali.
          </Notice>
          <View style={[ui.card, { gap: 12 }]}>
            <Text accessibilityRole="header" style={ui.heading}>
              La filosofia di MetiMaia
            </Text>
            <Text style={ui.body}>
              Inserisce introduzione, significato del nome e del loto, quattro
              tappe e filosofia dal nuovo documento. Puoi rivedere il testo
              prima di premere Salva modifiche. Email, foto archiviata e
              informazioni privacy vengono conservate.
            </Text>
            <Button
              variant="secondary"
              disabled={busy}
              onPress={() => {
                if (
                  !confirmDiscard(
                    "Vuoi sostituire i testi del progetto e le tappe con la filosofia di MetiMaia dal documento? Le modifiche non salvate in questi campi saranno sostituite.",
                  )
                )
                  return;
                update(withGaiaPresentation(profile));
                setMessage(
                  "Presentazione inserita. Controlla i campi e premi Salva modifiche per pubblicarla.",
                );
              }}
            >
              Usa la presentazione dal documento
            </Button>
          </View>
          {field("Introduzione e benvenuto", "bio")}

          {field("Il nome e il fiore di loto", "qualifications")}
          {field("Filosofia e messaggio alle famiglie", "service_area")}
          {field("Email pubblica di contatto", "contact_email")}
          <Text style={ui.heading}>Tappe del percorso</Text>
          {profile.services.map((service, i) => (
            <View style={[ui.card, { gap: 12 }]} key={i}>
              {(["title", "description", "details"] as const).map((key) => (
                <TextInput
                  key={key}
                  accessibilityLabel={`${key === "title" ? "Titolo" : key === "description" ? "Descrizione" : "Dettagli"} tappa ${i + 1}`}
                  placeholder={
                    key === "title"
                      ? "Nome della tappa"
                      : key === "description"
                        ? "Descrizione"
                        : "Approfondimento facoltativo"
                  }
                  editable={!busy}
                  value={service[key]}
                  multiline
                  style={ui.input}
                  maxLength={4000}
                  onChangeText={(v) =>
                    update({
                      services: profile.services.map((s, n) =>
                        n === i ? { ...s, [key]: v } : s,
                      ),
                    })
                  }
                />
              ))}
              <Button
                variant="quiet"
                disabled={busy}
                onPress={() =>
                  update({
                    services: profile.services.filter((_, n) => n !== i),
                  })
                }
              >
                Rimuovi tappa
              </Button>
            </View>
          ))}
          <Button
            variant="secondary"
            disabled={busy || profile.services.length >= 20}
            onPress={() =>
              update({
                services: [
                  ...profile.services,
                  { title: "", description: "", details: "" },
                ],
              })
            }
          >
            Aggiungi tappa
          </Button>
          <Text style={ui.heading}>Informazioni privacy</Text>
          <Notice>
            Compila con informazioni corrispondenti alla gestione effettiva e
            fai verificare il testo. Il salvataggio non certifica la conformità
            legale.
          </Notice>
          {field("Fornitori e ruoli", "privacy_providers")}
          {field("Tempi e criteri di conservazione", "privacy_retention")}
          {field("Trasferimenti e garanzie", "privacy_transfers")}
          <Text style={ui.body}>
            {dirty
              ? "Ci sono modifiche non salvate."
              : "Nessuna modifica in attesa."}
          </Text>
          <Button disabled={busy || !dirty} onPress={() => void save()}>
            {busy ? "Salvataggio…" : "Salva modifiche"}
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onPress={() => allowNavigation(() => router.push("/gaia"))}
          >
            Apri pagina pubblica
          </Button>
        </>
      )}
      {message !== "" && (
        <View accessibilityRole="alert">
          <Notice>{message}</Notice>
        </View>
      )}
    </View>
  );
}
