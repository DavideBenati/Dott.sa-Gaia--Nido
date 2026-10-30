import { Text, TextInput } from "../src/typography";
import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, Platform } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { client, initialAuthLinkError, useApp } from "../src/state";
import { Screen, Notice, Button, ui } from "../src/ui";
import { useEditorAccess } from "../src/editor-access";
import { requestNewsletterSubscription } from "../src/newsletter";
import { colors } from "../src/theme";
import {
  prepareAccountEntry,
  cancelAccountEntry,
} from "../src/entry-navigation";
import {
  hasCompletedProfileType,
  nicknameIssue,
  normalizeNickname,
} from "@nido/core";
export default function Account() {
  const {
    demo,
    state,
    email: accountEmail,
    memberProfile,
    memberProfileLoading,
    memberProfileError,
    refreshMemberProfile,
    signIn,
    signOut,
    passwordRecovery,
    requestPasswordReset,
    changePassword,
  } = useApp();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { allowed: editorAllowed } = useEditorAccess();
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendUntil, setResendUntil] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [newsletter, setNewsletter] = useState(false);
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState("");
  const nicknameInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [password, setPassword] = useState("");
  const [create, setCreate] = useState(params.mode !== "login");
  const [showPassword, setShowPassword] = useState(false);
  const [reset, setReset] = useState(false);
  const [change, setChange] = useState(false);
  const editingPassword = Boolean(accountEmail) && (passwordRecovery || change);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    initialAuthLinkError === "otp_expired"
      ? "Il collegamento email è scaduto o è già stato usato. Se hai già confermato, accedi; altrimenti richiedi una nuova conferma."
      : initialAuthLinkError
        ? "Il collegamento email non è valido. Accedi o richiedi una nuova conferma."
        : "",
  );
  useEffect(() => () => cancelAccountEntry(), []);
  useEffect(() => {
    if (!resendUntil) return;
    const update = () =>
      setRemaining(Math.max(0, Math.ceil((resendUntil - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [resendUntil]);
  async function resendConfirmation() {
    const destination = pendingEmail || email.trim();
    if (busy || demo || remaining > 0 || !client) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
      setMessage("Inserisci l’email usata per la registrazione.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await client.auth.resend({
        type: "signup",
        email: destination,
        options: { emailRedirectTo: "https://metimaia.com/account" },
      });
      if (error) throw error;
      setPendingEmail(destination);
      setResendUntil(Date.now() + 60000);
      setRemaining(60);
      setMessage(
        "Se l’indirizzo richiede una conferma, riceverai una nuova email. Usa soltanto il link più recente e controlla anche lo spam.",
      );
    } catch {
      setMessage(
        "Non è stato possibile richiedere la conferma. Attendi qualche minuto e riprova: il servizio email potrebbe aver raggiunto il limite di invio.",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (
      Platform.OS === "web" &&
      accountEmail &&
      (passwordRecovery || window.location.hash.includes("access_token="))
    ) {
      const search = new URLSearchParams(window.location.search);
      if (passwordRecovery) search.set("mode", "recovery");
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + (search.size ? `?${search.toString()}` : ""),
      );
    }
  }, [accountEmail, passwordRecovery]);
  async function submit() {
    if (busy || demo) return;
    if (create) {
      const issue = nicknameIssue(nickname);
      if (issue) {
        setNicknameError(issue);
        setMessage("");
        nicknameInput.current?.focus();
        return;
      }
    }
    setNicknameError("");
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
      prepareAccountEntry(email);
      const result = await signIn(
        email.trim(),
        password,
        create,
        create ? normalizeNickname(nickname) : undefined,
      );
      setPassword("");
      if (create && result.startsWith("Controlla"))
        setPendingEmail(email.trim());
      if (create && newsletter) {
        try {
          await requestNewsletterSubscription(email.trim());
          setMessage(
            result +
              " Newsletter: se la richiesta è valida, riceverai una seconda email per confermare l’iscrizione.",
          );
        } catch {
          setMessage(
            result +
              " La richiesta newsletter non è riuscita: puoi riprovare dalla pagina Newsletter, senza creare un altro account.",
          );
        }
      } else setMessage(result);
      // Navigation resumes the profile choice after this account is hydrated.
    } catch (error) {
      cancelAccountEntry();
      const detail = error instanceof Error ? error.message.toLowerCase() : "";
      if (detail.includes("email not confirmed")) setPendingEmail(email.trim());
      setMessage(
        detail.includes("email not confirmed")
          ? "L’email non è ancora confermata. Controlla la posta o richiedi un nuovo collegamento."
          : detail.includes("rate limit") || detail.includes("too many")
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
    cancelAccountEntry();
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
      router.setParams({ mode: "login" });
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
        ) : !accountEmail && pendingEmail && !reset ? (
          <View style={[ui.card, { gap: 18 }]}>
            <Text accessibilityRole="header" style={ui.heading}>
              Controlla la tua email
            </Text>
            <Text style={ui.body}>
              Indirizzo usato: {pendingEmail}. Per attivare l’account, apri
              l’email di metiMaia e conferma dal link più recente. Poi torna qui
              per accedere. Se l’indirizzo è già registrato, puoi accedere senza
              creare un altro account.
            </Text>
            {message !== "" && (
              <View accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Notice>{message}</Notice>
              </View>
            )}
            <Button
              disabled={busy || remaining > 0}
              onPress={() => void resendConfirmation()}
            >
              {busy
                ? "Attendi…"
                : remaining > 0
                  ? `Nuovo link tra ${remaining} s`
                  : "Invia nuovamente la conferma"}
            </Button>
            <Button
              variant="secondary"
              disabled={busy}
              onPress={() => {
                cancelAccountEntry();
                setPendingEmail("");
                setCreate(false);
                setMessage("");
              }}
            >
              Ho confermato, accedi
            </Button>
            <Button
              variant="quiet"
              disabled={busy}
              onPress={() => {
                cancelAccountEntry();
                setPendingEmail("");
                setCreate(true);
                setMessage("");
              }}
            >
              Correggi indirizzo email
            </Button>
            <Button
              variant="quiet"
              disabled={busy}
              onPress={() => {
                cancelAccountEntry();
                setPendingEmail("");
                setReset(true);
                setMessage("");
              }}
            >
              Password dimenticata?
            </Button>
            <Text style={ui.body}>
              Non trovi l’email? Controlla spam e posta indesiderata. Questa
              pagina non conferma la consegna o l’apertura dell’email.
            </Text>
          </View>
        ) : accountEmail ? (
          <View style={[ui.card, { gap: 18 }]}>
            {memberProfile?.nickname ? (
              <Text style={ui.heading}>{memberProfile.nickname}</Text>
            ) : null}
            <Text style={ui.body}>{accountEmail}</Text>
            {memberProfileLoading ? (
              <Notice>Caricamento del tuo nickname e profilo…</Notice>
            ) : memberProfileError ? (
              <View style={{ gap: 12 }} accessibilityRole="alert">
                <Notice>
                  Non riusciamo a caricare il tuo nickname e la scheda. Riprova
                  prima di modificarli.
                </Notice>
                <Button
                  disabled={busy}
                  variant="secondary"
                  onPress={() => {
                    void refreshMemberProfile().catch(() => {});
                  }}
                >
                  Riprova caricamento profilo
                </Button>
              </View>
            ) : memberProfile ? (
              <Button
                disabled={busy}
                variant="secondary"
                onPress={() => router.push("/profile")}
              >
                {memberProfile.nickname
                  ? "Modifica nickname e scheda"
                  : "Scegli il tuo nickname"}
              </Button>
            ) : null}
            <Button onPress={() => router.push("/welcome?edit=1")}>
              {hasCompletedProfileType(state.preferences)
                ? "Personalizza il tuo percorso"
                : "Completa il tuo profilo"}
            </Button>
            <Button variant="secondary" onPress={() => router.push("/chat")}>
              Scrivi alla Dott.sa Gaia
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
              variant="secondary"
              onPress={() => router.push("/miei-documenti")}
            >
              I miei documenti
            </Button>
            {editorAllowed && (
              <Button
                variant="secondary"
                onPress={() => router.push("/studio")}
              >
                Area professionista
              </Button>
            )}
            <Button variant="quiet" onPress={() => router.push("/newsletter")}>
              Newsletter metiMaia
            </Button>
            <Button
              disabled={busy}
              variant="quiet"
              onPress={() => {
                cancelAccountEntry();
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
            {create && !reset && (
              <View style={{ gap: 8 }}>
                <Text style={ui.label}>Nickname</Text>
                <TextInput
                  ref={nicknameInput}
                  accessibilityLabel="Nickname"
                  accessibilityHint="Da 2 a 40 caratteri. Non serve il nome completo."
                  aria-invalid={Boolean(nicknameError)}
                  aria-required
                  style={[
                    ui.input,
                    nicknameError ? { borderColor: colors.error } : undefined,
                  ]}
                  placeholder="Come vuoi farti chiamare"
                  value={nickname}
                  onChangeText={(value) => {
                    setNickname(value);
                    setNicknameError("");
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="username-new"
                  maxLength={80}
                  editable={!demo && !busy}
                />
                <Text
                  style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}
                >
                  Da 2 a 40 caratteri, senza email. È il nome scelto per
                  riconoscerti nell’area riservata; non serve il nome completo.
                </Text>
                {nicknameError !== "" && (
                  <View
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
                    <Text style={{ color: colors.error }}>{nicknameError}</Text>
                  </View>
                )}
              </View>
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
                    setCreate(false);
                    setNicknameError("");
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
                    accessibilityState={{
                      selected: showPassword,
                      disabled: busy,
                    }}
                    disabled={busy}
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
                {create && (
                  <View style={{ gap: 8 }}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityLabel="Desidero ricevere la newsletter metiMaia"
                      accessibilityState={{
                        checked: newsletter,
                        disabled: busy,
                      }}
                      disabled={busy}
                      onPress={() => setNewsletter(!newsletter)}
                      style={{ paddingVertical: 12 }}
                    >
                      <Text style={ui.body}>
                        {newsletter ? "☑" : "☐"} Desidero ricevere via email la
                        newsletter metiMaia con aggiornamenti, contenuti e
                        novità sui servizi. Facoltativo; posso disiscrivermi in
                        ogni momento.
                      </Text>
                    </Pressable>
                    <Button
                      variant="quiet"
                      disabled={busy}
                      onPress={() => router.push("/newsletter")}
                    >
                      Informazioni sulla newsletter e privacy
                    </Button>
                  </View>
                )}
                {message !== "" && (
                  <View
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
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
                    cancelAccountEntry();
                    setCreate(!create);
                    setNicknameError("");
                    setMessage("");
                    setPassword("");
                  }}
                >
                  {create
                    ? "Hai già un account? Accedi"
                    : "Non hai un account? Registrati"}
                </Button>
                {create && initialAuthLinkError && (
                  <Button
                    variant="quiet"
                    disabled={busy || demo || remaining > 0}
                    onPress={() => void resendConfirmation()}
                  >
                    Richiedi una nuova conferma email
                  </Button>
                )}
                {!create && (
                  <Button
                    variant="quiet"
                    disabled={busy || remaining > 0 || demo}
                    onPress={() => void resendConfirmation()}
                  >
                    {remaining > 0
                      ? `Nuovo link tra ${remaining} s`
                      : "Non ho ricevuto la conferma"}
                  </Button>
                )}
                <Button
                  variant="quiet"
                  disabled={busy}
                  onPress={() => {
                    cancelAccountEntry();
                    setReset(true);
                    setNicknameError("");
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
              onPress={() => {
                cancelAccountEntry();
                router.replace("/welcome");
              }}
            >
              Continua come ospite
            </Button>
            <Button
              disabled={busy}
              variant="quiet"
              onPress={() => router.push("/privacy")}
            >
              Come trattiamo i tuoi dati
            </Button>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
              Il nickname serve per riconoscerti nell’area riservata. L’email
              serve per accedere e confermare l’account. Leggere l’informativa
              non equivale a un consenso generale. La newsletter è facoltativa e
              richiede un consenso separato.
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
