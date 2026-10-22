import { Text, TextInput } from "../src/typography";
import React, { useEffect, useState } from "react";
import { View, Pressable, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useApp } from "../src/state";
import { Screen, Notice, Button, ui } from "../src/ui";
import { colors } from "../src/theme";
export default function Account() {
  const {
    demo,
    email: accountEmail,
    signIn,
    signOut,
    passwordRecovery,
    requestPasswordReset,
    changePassword,
  } = useApp();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [create, setCreate] = useState(params.mode !== "login");
  const [showPassword, setShowPassword] = useState(false);
  const [reset, setReset] = useState(false);
  const [change, setChange] = useState(false);
  const editingPassword = Boolean(accountEmail) && (passwordRecovery || change);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (
      Platform.OS === "web" &&
      accountEmail &&
      window.location.hash.includes("access_token=")
    )
      router.replace("/account");
  }, [accountEmail]);
  async function submit() {
    if (busy || demo) return;
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      password.length < (create ? 8 : 1)
    ) {
      setMessage(
        create
          ? "Inserisci una email valida e una password di almeno 8 caratteri."
          : "Inserisci email e password.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await signIn(email.trim(), password, create);
      setPassword("");
      setMessage(result);
      // The auth event reloads the account's own state. Keep this route open:
      // its signed-in panel offers personalization after hydration completes.
    } catch (error) {
      const detail = error instanceof Error ? error.message.toLowerCase() : "";
      setMessage(
        detail.includes("rate limit") || detail.includes("too many")
          ? "Troppe richieste. Attendi qualche minuto prima di riprovare. Il servizio email potrebbe aver raggiunto il limite di invio."
          : detail.includes("sending confirmation") || detail.includes("smtp")
            ? "Il servizio non riesce a inviare l’email di conferma. Occorre verificare la configurazione email in Supabase."
            : "Operazione non riuscita. Verifica i dati e la connessione. Se hai già un account, prova ad accedere.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function resetPassword() {
    if (busy || demo) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMessage("Inserisci una email valida.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await requestPasswordReset(email);
      setMessage(
        "Se esiste un account associato a questa email, riceverai un link per reimpostare la password. Controlla anche la posta indesiderata.",
      );
    } catch {
      setMessage(
        "Non è stato possibile richiedere il link. Controlla la connessione e riprova più tardi.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function savePassword() {
    if (busy || password.length < 8) {
      setMessage("Usa una password di almeno 8 caratteri.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await changePassword(password);
      setPassword("");
      setChange(false);
      setMessage("Password aggiornata. Usa la nuova password anche nell’app.");
    } catch {
      setMessage(
        "Aggiornamento non riuscito. Il link potrebbe essere scaduto: richiedine uno nuovo oppure accedi nuovamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen back>
      <View
        style={{ width: "100%", maxWidth: 480, alignSelf: "center", gap: 18 }}
      >
        <Text accessibilityRole="header" style={ui.heading}>
          {accountEmail
            ? "Il tuo account MAIA"
            : create
              ? "Il tuo spazio MAIA"
              : "Bentornata in MAIA"}
        </Text>
        <Text style={ui.body}>
          Un solo account, sul sito e nell’app. Ritrova il tuo percorso, le
          letture e le checklist.
        </Text>
        {editingPassword ? (
          <View style={[ui.card, { gap: 16 }]}>
            <Text style={ui.heading}>Scegli una nuova password</Text>
            <Text style={ui.body}>
              Almeno 8 caratteri. Non condividerla con nessuno.
            </Text>
            <TextInput
              accessibilityLabel="Nuova password"
              placeholder="Nuova password"
              style={ui.input}
              secureTextEntry
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
              editable={!busy}
            />
            <Button
              disabled={busy || password.length < 8}
              onPress={() => void savePassword()}
            >
              {busy ? "Salvataggio…" : "Salva nuova password"}
            </Button>
            {!passwordRecovery && (
              <Button
                variant="quiet"
                disabled={busy}
                onPress={() => {
                  setChange(false);
                  setPassword("");
                }}
              >
                Annulla
              </Button>
            )}
          </View>
        ) : accountEmail ? (
          <View style={[ui.card, { gap: 18 }]}>
            <Text style={ui.body}>{accountEmail}</Text>
            <Button onPress={() => router.push("/welcome?edit=1")}>
              Personalizza il tuo percorso
            </Button>
            <Button variant="secondary" onPress={() => router.push("/chat")}>
              Scrivi alla Dott.ssa Brunetti
            </Button>
            <Button
              variant="quiet"
              onPress={() => {
                setChange(true);
                setPassword("");
                setMessage("");
              }}
            >
              Cambia password
            </Button>
            <Notice>
              I dati dell’ospite non vengono importati automaticamente nel tuo
              account.
            </Notice>
            <Button
              disabled={busy}
              variant="quiet"
              onPress={() => {
                setBusy(true);
                void signOut()
                  .catch(() => setMessage("Uscita non riuscita."))
                  .finally(() => setBusy(false));
              }}
            >
              Esci dall’account
            </Button>
          </View>
        ) : (
          <View style={[ui.card, { gap: 14 }]}>
            {demo && (
              <Notice warm>
                DEMO MODE · Registrazione e accesso non sono ancora attivi. Per
                ora puoi esplorare come ospite. Non inserire credenziali reali.
              </Notice>
            )}
            {reset && (
              <Text accessibilityRole="header" style={ui.heading}>
                Recupera la password
              </Text>
            )}
            <Text style={ui.label}>Email</Text>
            <TextInput
              accessibilityLabel="Email account"
              style={ui.input}
              placeholder="La tua email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!demo && !busy}
            />
            {reset ? (
              <>
                <Button
                  disabled={busy || demo}
                  onPress={() => void resetPassword()}
                >
                  {busy ? "Attendi…" : "Invia link di recupero"}
                </Button>
                <Button
                  variant="quiet"
                  disabled={busy}
                  onPress={() => {
                    setReset(false);
                    setMessage("");
                  }}
                >
                  Torna all’accesso
                </Button>
              </>
            ) : (
              <>
                {" "}
                <Text style={ui.label}>Password</Text>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <TextInput
                    accessibilityLabel="Password account"
                    style={[ui.input, { flex: 1, minWidth: 0 }]}
                    placeholder={
                      create ? "Crea una password" : "La tua password"
                    }
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete={create ? "new-password" : "current-password"}
                    editable={!demo && !busy}
                    onSubmitEditing={() => void submit()}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? "Nascondi password" : "Mostra password"
                    }
                    accessibilityState={{ selected: showPassword }}
                    onPress={() => setShowPassword(!showPassword)}
                    style={{
                      minHeight: 48,
                      padding: 8,
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors.sageDark, fontSize: 13 }}>
                      {showPassword ? "Nascondi" : "Mostra"}
                    </Text>
                  </Pressable>
                </View>
                {create && (
                  <Text style={{ color: colors.muted, fontSize: 13 }}>
                    Almeno 8 caratteri. Nessuna data personale obbligatoria.
                  </Text>
                )}
                {message !== "" && (
                  <View accessibilityRole="alert" accessibilityLiveRegion="polite">
                    <Notice>{message}</Notice>
                  </View>
                )}
                <Button disabled={busy || demo} onPress={() => void submit()}>
                  {busy ? "Attendi…" : create ? "Crea account" : "Accedi"}
                </Button>
                <Button
                  disabled={busy}
                  variant="quiet"
                  onPress={() => {
                    setCreate(!create);
                    setMessage("");
                    setPassword("");
                  }}
                >
                  {create
                    ? "Hai già un account? Accedi"
                    : "Non hai un account? Registrati"}
                </Button>
                <Button
                  variant="quiet"
                  disabled={busy}
                  onPress={() => {
                    setReset(true);
                    setPassword("");
                    setMessage("");
                  }}
                >
                  Password dimenticata?
                </Button>
              </>
            )}
            <Button
              disabled={busy}
              variant="secondary"
              onPress={() => router.replace("/welcome")}
            >
              Continua come ospite
            </Button>
            <Button variant="quiet" onPress={() => router.push("/privacy")}>
              Come trattiamo i tuoi dati
            </Button>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
              L’email serve per accedere e confermare l’account. Leggere
              l’informativa non equivale a un consenso generale. Non inviamo
              comunicazioni promozionali.
            </Text>
          </View>
        )}
        {message !== "" && (Boolean(accountEmail) || reset) && (
          <View accessibilityRole="alert">
            <Notice>{message}</Notice>
          </View>
        )}
      </View>
    </Screen>
  );
}
