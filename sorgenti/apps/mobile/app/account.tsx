import React, { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { useApp } from "../src/state";
import { Screen, Notice, Button, ui } from "../src/ui";
export default function Account() {
  const { demo, email: accountEmail, signIn, signOut } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit() {
    if (!email.includes("@") || password.length < 8) {
      setMessage("Inserisci una email e una password di almeno 8 caratteri.");
      return;
    }
    setBusy(true);
    try {
      setMessage(await signIn(email, password, create));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Accesso non riuscito.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen back title="Il tuo account, i tuoi tempi.">
      {demo ? (
        <Notice warm>
          DEMO MODE · L’accesso e la registrazione non sono attivi. Preferenze,
          salvati e checklist funzionano su questo dispositivo senza account.
        </Notice>
      ) : accountEmail ? (
        <View style={[ui.card, { gap: 20 }]}>
          <Text style={ui.body}>{accountEmail}</Text>
          <Notice>
            I dati dell’ospite non vengono importati automaticamente nel tuo
            account.
          </Notice>
          <Button
            onPress={() => {
              void signOut().catch(() => setMessage("Uscita non riuscita."));
            }}
          >
            Esci dall’account
          </Button>
        </View>
      ) : (
        <View style={[ui.card, { gap: 18 }]}>
          <Text style={ui.heading}>
            {create ? "Crea il tuo spazio." : "Bentornata, bentornato."}
          </Text>
          <Text style={ui.label}>Email</Text>
          <TextInput
            accessibilityLabel="Email account"
            style={ui.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={ui.label}>Password</Text>
          <TextInput
            accessibilityLabel="Password account"
            style={ui.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          <Notice icon="lock">
            Useremo l’email per l’accesso. Il marketing richiede un consenso
            separato.
          </Notice>
          <Button
            disabled={busy}
            onPress={() => {
              void submit();
            }}
          >
            {create ? "Crea account" : "Accedi"}
          </Button>
          <Button variant="quiet" onPress={() => setCreate(!create)}>
            {create
              ? "Hai già un account? Accedi"
              : "Non hai un account? Registrati"}
          </Button>
        </View>
      )}
      {message && <Notice>{message}</Notice>}
    </Screen>
  );
}
