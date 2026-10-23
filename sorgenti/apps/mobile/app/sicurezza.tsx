import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { client, useApp } from "../src/state";
import { Text, TextInput } from "../src/typography";
import { Screen, Button, Notice, ui } from "../src/ui";
export default function Security() {
  const { email } = useApp();
  return (
    <Screen
      back
      title="Sicurezza dell’account"
      subtitle="Proteggi l’accesso con un’app di autenticazione."
    >
      {email ? (
        <SecurityContent key={email} />
      ) : (
        <Button onPress={() => router.push("/account?mode=login")}>
          Accedi
        </Button>
      )}
    </Screen>
  );
}
function SecurityContent() {
  const [factor, setFactor] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    if (client)
      void client.auth.mfa.listFactors().then(({ data, error }) => {
        if (active) {
          if (error)
            setMessage("Impossibile leggere i fattori di autenticazione.");
          else
            setFactor(
              data?.totp.find((f) => f.status === "verified")?.id ?? "",
            );
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function enroll() {
    if (!client) return;
    setBusy(true);
    try {
      if (factor && secret) {
        await client.auth.mfa.unenroll({ factorId: factor });
        setFactor("");
        setSecret("");
      }
      const { data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `metiMaia ${new Date().toISOString()}`,
      });
      if (error) throw error;
      setFactor(data.id);
      setSecret(data.totp.secret);
      setMessage(
        "Inserisci questa chiave manualmente nell’app di autenticazione, poi verifica un codice. Non condividere la chiave.",
      );
    } catch {
      setMessage(
        "Configurazione non riuscita. Riprova o verifica i fattori già presenti.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    if (!client) return;
    setBusy(true);
    try {
      const { error } = await client.auth.mfa.challengeAndVerify({
        factorId: factor,
        code,
      });
      if (error) throw error;
      setVerified(true);
      setSecret("");
      setCode("");
      setMessage(
        "Codice verificato: questa sessione ha ora il secondo fattore. Puoi riaprire il pannello.",
      );
    } catch {
      setMessage(
        "Codice non valido o scaduto. Usa il codice attuale dell’app.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function enforce() {
    if (!client) return;
    setBusy(true);
    const { error } = await client.rpc("require_professional_mfa");
    setMessage(
      error
        ? "Attivazione non riuscita. Occorrono configurazione v3, un ruolo professionale e il codice verificato."
        : "Protezione professionale attivata: database e chat richiederanno il secondo fattore nelle nuove sessioni.",
    );
    setBusy(false);
  }
  return (
    <View
      style={{ gap: 20, maxWidth: 640, width: "100%", alignSelf: "center" }}
    >
      <Notice>
        Usa un’app come Google Authenticator, Microsoft Authenticator o
        1Password. Conserva la chiave iniziale in un luogo sicuro: serve per
        recuperare l’accesso se cambi telefono.
      </Notice>
      {!factor ? (
        <Button disabled={busy} onPress={() => void enroll()}>
          Configura autenticazione a due fattori
        </Button>
      ) : !verified ? (
        <>
          {secret !== "" && (
            <Text
              selectable
              accessibilityLabel="Chiave per app di autenticazione"
              style={ui.card}
            >
              {secret}
            </Text>
          )}
          <TextInput
            accessibilityLabel="Codice di autenticazione"
            placeholder="Codice di 6 cifre"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
            maxLength={6}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            style={ui.input}
          />
          <Button
            disabled={busy || code.length !== 6}
            onPress={() => void verify()}
          >
            Verifica codice
          </Button>
        </>
      ) : (
        <>
          <Notice>
            Per Gaia: il pulsante seguente rende il secondo fattore obbligatorio
            anche nelle regole del database. Attivalo solo dopo aver custodito
            la chiave di recupero.
          </Notice>
          <Button disabled={busy} onPress={() => void enforce()}>
            Rendi obbligatorio per il pannello professionale
          </Button>
          <Button variant="secondary" onPress={() => router.push("/studio")}>
            Apri pannello
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
