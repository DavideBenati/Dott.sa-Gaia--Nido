import React, { useEffect, useState } from "react";
import { View, Platform } from "react-native";
import { router } from "expo-router";
import { Screen, Button, Notice, ui } from "../src/ui";
import { Text, TextInput } from "../src/typography";
import { useApp } from "../src/state";
import { useEditorAccess } from "../src/editor-access";
import {
  defaultProfile,
  loadProfile,
  saveProfile,
  type SiteProfile,
} from "../src/professional";
export default function Settings() {
  const { email } = useApp();
  return (
    <Screen
      back
      title="Gaia, servizi e privacy"
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
  useEffect(() => {
    let active = true;
    if (allowed)
      void loadProfile().then((p) => {
        if (active) {
          setProfile(p);
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [allowed]);
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  function update(p: Partial<SiteProfile>) {
    setProfile((v) => ({ ...v, ...p }));
    setDirty(true);
    setMessage("");
  }
  async function save() {
    setBusy(true);
    try {
      await saveProfile(profile);
      setDirty(false);
      setMessage("Modifiche salvate. La pagina Gaia e servizi è aggiornata.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Salvataggio non riuscito.");
    } finally {
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
        <Notice>Caricamento…</Notice>
      ) : (
        <>
          <Notice>
            Non inserire dati di pazienti. Pubblica solo qualifiche verificate e
            servizi effettivamente disponibili. Foto: indirizzo HTTPS di
            un’immagine che puoi utilizzare.
          </Notice>
          <Text style={ui.heading}>Prima di pubblicare la presentazione</Text>
          <Text style={ui.body}>
            {[
              !profile.portrait_url && "Foto professionale facoltativa",
              !profile.qualifications && "Qualifiche/iscrizione da verificare",
              !profile.services.length && "Servizi da definire",
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
            inventate. Non pubblicare prezzi o disponibilità provvisori come
            confermati.
          </Notice>
          {field("Presentazione", "bio")}
          {field("Foto: URL HTTPS (facoltativo)", "portrait_url")}
          {field(
            "Qualifiche e iscrizione professionale verificate",
            "qualifications",
          )}
          {field("Zone, modalità e disponibilità", "service_area")}
          {field("Email pubblica di contatto", "contact_email")}
          <Text style={ui.heading}>Servizi</Text>
          {profile.services.map((service, i) => (
            <View style={[ui.card, { gap: 12 }]} key={i}>
              {(["title", "description", "details"] as const).map((key) => (
                <TextInput
                  key={key}
                  accessibilityLabel={`${key === "title" ? "Titolo" : key === "description" ? "Descrizione" : "Dettagli"} servizio ${i + 1}`}
                  placeholder={
                    key === "title"
                      ? "Nome del servizio"
                      : key === "description"
                        ? "Descrizione"
                        : "Modalità e altre informazioni confermate"
                  }
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
                onPress={() =>
                  update({
                    services: profile.services.filter((_, n) => n !== i),
                  })
                }
              >
                Rimuovi servizio
              </Button>
            </View>
          ))}
          <Button
            variant="secondary"
            disabled={profile.services.length >= 20}
            onPress={() =>
              update({
                services: [
                  ...profile.services,
                  { title: "", description: "", details: "" },
                ],
              })
            }
          >
            Aggiungi servizio
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
          <Button variant="secondary" onPress={() => router.push("/gaia")}>
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
