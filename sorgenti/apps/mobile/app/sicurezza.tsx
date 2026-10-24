import React, { useCallback, useRef, useState } from "react";
import { Image, Platform, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { client, useApp } from "../src/state";
import { Text, TextInput } from "../src/typography";
import { Screen, Button, Notice, ui } from "../src/ui";

type ReturnArea = "/studio" | "/documenti-studio" | "/messaggi";
const returnLabels: Record<ReturnArea, string> = {
  "/studio": "Torna a Studio",
  "/documenti-studio": "Torna ai documenti riservati",
  "/messaggi": "Torna alle conversazioni",
};
function qrImage(source: string): string {
  // The SVG comes from Supabase enrollment, never from a remote QR service.
  // Encode the payload because the SDK can return an unescaped SVG data URI.
  let svg = source.trim();
  if (svg.startsWith("data:image/svg+xml")) {
    const comma = svg.indexOf(",");
    if (comma < 0) return "";
    if (svg.slice(0, comma).includes(";base64")) return svg;
    const payload = svg.slice(comma + 1);
    try {
      svg = decodeURIComponent(payload);
    } catch {
      svg = payload;
    }
  }
  if (!svg.trimStart().startsWith("<svg")) return "";
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
export default function Security() {
  const { email } = useApp();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const destination: ReturnArea =
    typeof returnTo === "string" &&
    Object.prototype.hasOwnProperty.call(returnLabels, returnTo)
      ? (returnTo as ReturnArea)
      : "/studio";
  return (
    <Screen
      back
      title="Sicurezza dell’account"
      subtitle="Proteggi l’accesso con un’app di autenticazione."
    >
      {email ? (
        <SecurityContent key={email} returnTo={destination} />
      ) : (
        <Button onPress={() => router.push("/account?mode=login")}>
          Accedi
        </Button>
      )}
    </Screen>
  );
}
function SecurityContent({ returnTo }: { returnTo: ReturnArea }) {
  const [factor, setFactor] = useState("");
  const [secret, setSecret] = useState("");
  const [qr, setQr] = useState("");
  const [showManualKey, setShowManualKey] = useState(false);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pendingFactor = useRef("");
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setLoadError("");
      void (async () => {
        try {
          if (!client) throw new Error();
          const [factors, assurance] = await Promise.all([
            client.auth.mfa.listFactors(),
            client.auth.mfa.getAuthenticatorAssuranceLevel(),
          ]);
          if (factors.error || assurance.error || !assurance.data?.currentLevel)
            throw new Error();
          if (!active) return;
          setFactor(
            factors.data.totp.find((f) => f.status === "verified")?.id ??
              pendingFactor.current,
          );
          setVerified(assurance.data.currentLevel === "aal2");
        } catch {
          if (active)
            setLoadError(
              "Impossibile verificare lo stato di sicurezza. Controlla la connessione e riprova.",
            );
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [version]),
  );
  async function enroll() {
    if (!client || busy || loading || loadError) return;
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `metiMaia ${new Date().toISOString()}`,
      });
      if (error) throw error;
      pendingFactor.current = data.id;
      setFactor(data.id);
      setSecret(data.totp.secret);
      setQr(qrImage(data.totp.qr_code));
      setShowManualKey(Platform.OS !== "web");
      setMessage(
        "Aggiungi metiMaia nell’app di autenticazione e inserisci qui il codice di 6 cifre generato dall’app.",
      );
    } catch {
      setMessage(
        "Configurazione non riuscita. Controlla la connessione e riprova; se avevi già configurato un’app, aggiorna lo stato di sicurezza.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    if (!client || busy || !factor || code.length !== 6) return;
    setBusy(true);
    setMessage("");
    try {
      const challenge = await client.auth.mfa.challengeAndVerify({
        factorId: factor,
        code,
      });
      if (challenge.error) throw challenge.error;
      const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data?.currentLevel !== "aal2")
        throw new Error();
      pendingFactor.current = "";
      setVerified(true);
      setSecret("");
      setQr("");
      setShowManualKey(false);
      setCode("");
      setMessage(
        "Codice verificato: questa sessione ha ora il secondo fattore. Puoi tornare all’area da cui provenivi.",
      );
    } catch {
      setMessage(
        "Verifica non riuscita. Usa il codice attuale dell’app di autenticazione e controlla la connessione.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function enforce() {
    if (!client || busy || !verified) return;
    setBusy(true);
    const { error } = await client.rpc("require_professional_mfa");
    setMessage(
      error
        ? "Attivazione non riuscita. Occorrono un ruolo professionale autorizzato, la configurazione aggiornata e il secondo fattore verificato."
        : "Protezione professionale attivata: database e chat richiederanno il secondo fattore nelle nuove sessioni.",
    );
    setBusy(false);
  }
  return (
    <View
      style={{ gap: 20, maxWidth: 640, width: "100%", alignSelf: "center" }}
    >
      {loading ? (
        <Notice>Verifica dello stato di sicurezza…</Notice>
      ) : loadError ? (
        <View accessibilityRole="alert" style={{ gap: 12 }}>
          <Notice>{loadError}</Notice>
          <Button onPress={() => setVersion((value) => value + 1)}>
            Riprova verifica dello stato
          </Button>
        </View>
      ) : verified ? (
        <>
          <Notice>Secondo fattore già verificato per questa sessione.</Notice>
          <Button onPress={() => router.replace(returnTo)}>
            {returnLabels[returnTo]}
          </Button>
          <View style={[ui.card, { gap: 14 }]}>
            <Text accessibilityRole="header" style={ui.heading}>
              Protezione del pannello professionale
            </Text>
            <Text style={ui.body}>
              Per Gaia: puoi rendere obbligatorio il secondo fattore anche per
              gli altri strumenti professionali. Conserva prima la chiave
              iniziale dell’app in un luogo sicuro.
            </Text>
            <Button
              variant="secondary"
              disabled={busy}
              onPress={() => void enforce()}
            >
              Rendi obbligatorio per il pannello professionale
            </Button>
          </View>
        </>
      ) : (
        <>
          <Notice>
            Usa Google Authenticator, Microsoft Authenticator o un’app
            equivalente. Il codice arriva dall’app di autenticazione, non via
            email. Conserva la chiave iniziale in un luogo sicuro e non
            condividerla.
          </Notice>
          {!factor ? (
            <Button disabled={busy} onPress={() => void enroll()}>
              Configura autenticazione a due fattori
            </Button>
          ) : (
            <>
              {secret !== "" && (
                <View style={[ui.card, { gap: 14 }]}>
                  <Text accessibilityRole="header" style={ui.heading}>
                    Aggiungi metiMaia nell’app
                  </Text>
                  {Platform.OS === "web" && qr !== "" && (
                    <>
                      <Text style={ui.body}>
                        Dal telefono apri l’app di autenticazione, aggiungi un
                        account e scansiona questo QR.
                      </Text>
                      <Image
                        source={{ uri: qr }}
                        accessibilityLabel="QR per configurare metiMaia nell’app di autenticazione"
                        style={{
                          width: 220,
                          height: 220,
                          maxWidth: "100%",
                          alignSelf: "center",
                        }}
                        resizeMode="contain"
                      />
                    </>
                  )}
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onPress={() => setShowManualKey((value) => !value)}
                  >
                    {showManualKey
                      ? "Nascondi chiave manuale"
                      : "Mostra chiave per inserimento manuale"}
                  </Button>
                  {(showManualKey || qr === "") && (
                    <>
                      <Text style={ui.body}>
                        Se usi lo stesso telefono o non puoi scansionare il QR,
                        aggiungi un account manualmente: nome metiMaia, chiave
                        qui sotto, tipo basato sul tempo.
                      </Text>
                      <Text
                        selectable
                        accessibilityLabel="Chiave per app di autenticazione"
                        style={ui.body}
                      >
                        {secret}
                      </Text>
                    </>
                  )}
                </View>
              )}
              <Text style={ui.label}>
                Codice generato dall’app di autenticazione
              </Text>
              <TextInput
                accessibilityLabel="Codice di autenticazione"
                placeholder="Codice di 6 cifre"
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
                maxLength={6}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                editable={!busy}
                style={ui.input}
                onSubmitEditing={() => void verify()}
              />
              <Button
                disabled={busy || code.length !== 6}
                onPress={() => void verify()}
              >
                {busy ? "Verifica…" : "Verifica codice"}
              </Button>
            </>
          )}
        </>
      )}
      {message !== "" && (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Notice>{message}</Notice>
        </View>
      )}
      {!loading && !loadError && (
        <Button
          variant="quiet"
          disabled={busy || secret !== ""}
          onPress={() => setVersion((value) => value + 1)}
        >
          Aggiorna stato di sicurezza
        </Button>
      )}
    </View>
  );
}
