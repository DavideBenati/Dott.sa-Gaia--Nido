import React, { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import {
  memberInterestOptions,
  memberJourneyOptions,
  nicknameIssue,
  normalizeNickname,
  type MemberInterest,
  type MemberJourney,
  type MemberProfile,
} from "@nido/core";
import { useApp } from "./state";
import { Text, TextInput } from "./typography";
import { Button, Notice, ui } from "./ui";
import { colors } from "./theme";
import { useUnsavedChanges } from "./unsaved-changes";

type SharingDraft = {
  share: boolean;
  journey: MemberJourney;
  interests: MemberInterest[];
};
const sharingKey = (draft: SharingDraft) =>
  JSON.stringify({
    ...draft,
    interests: [...draft.interests].sort(),
  });
function draftFrom(
  profile: MemberProfile | null,
  journey: MemberJourney,
): SharingDraft {
  return {
    share: profile?.journey_shared ?? false,
    journey: profile?.shared_journey ?? journey,
    interests: [...(profile?.shared_interests ?? [])],
  };
}

export function MemberProfileEditor() {
  const {
    state,
    memberProfile,
    memberProfileLoading,
    memberProfileError,
    refreshMemberProfile,
    updateNickname,
    updateSharedJourney,
  } = useApp();
  const personalJourney: MemberJourney =
    !state.preferences.onboarded || state.preferences.exploreOnly
      ? "exploring"
      : state.preferences.journey;
  const [nickname, setNickname] = useState(memberProfile?.nickname ?? "");
  const [baseNickname, setBaseNickname] = useState(nickname);
  const [draft, setDraft] = useState(() =>
    draftFrom(memberProfile, personalJourney),
  );
  const [baseSharing, setBaseSharing] = useState(() => sharingKey(draft));
  const [version, setVersion] = useState(
    memberProfile?.sharing_updated_at ?? null,
  );
  const [saving, setSaving] = useState<"nickname" | "sharing" | null>(null);
  const [nickMessage, setNickMessage] = useState("");
  const [sharingMessage, setSharingMessage] = useState("");
  const nicknameInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const nickDirty = nickname !== baseNickname;
  const shareDirty = sharingKey(draft) !== baseSharing;
  const dirty = useRef({ nickDirty, shareDirty });
  dirty.current = { nickDirty, shareDirty };
  const { confirmDiscard } = useUnsavedChanges(nickDirty || shareDirty);
  const locked = memberProfileLoading || saving !== null;
  async function reloadSaved() {
    if (
      locked ||
      !confirmDiscard(
        "Ricaricare il profilo sostituirà le modifiche non salvate con la scheda attuale. Vuoi continuare?",
      )
    )
      return;
    try {
      const saved = await refreshMemberProfile();
      dirty.current = { nickDirty: false, shareDirty: false };
      setNickname(saved.nickname);
      setBaseNickname(saved.nickname);
      const next = draftFrom(saved, personalJourney);
      setDraft(next);
      setBaseSharing(sharingKey(next));
      setVersion(saved.sharing_updated_at);
      setNickMessage("");
      setSharingMessage("");
    } catch {
      /* Read errors stay visible and keep writes closed. */
    }
  }

  useEffect(() => {
    if (!memberProfile) return;
    if (!dirty.current.nickDirty) {
      setNickname(memberProfile.nickname);
      setBaseNickname(memberProfile.nickname);
    }
    if (!dirty.current.shareDirty) {
      const next = draftFrom(memberProfile, personalJourney);
      setDraft(next);
      setBaseSharing(sharingKey(next));
      setVersion(memberProfile.sharing_updated_at);
    }
  }, [memberProfile, personalJourney]);

  async function saveNickname() {
    if (locked || !memberProfile || memberProfileError) return;
    const issue = nicknameIssue(nickname);
    if (issue) {
      setNickMessage(issue);
      nicknameInput.current?.focus();
      return;
    }
    setSaving("nickname");
    setNickMessage("");
    try {
      const saved = await updateNickname(normalizeNickname(nickname));
      dirty.current.nickDirty = false;
      setNickname(saved.nickname);
      setBaseNickname(saved.nickname);
      setNickMessage("Nickname aggiornato.");
    } catch (error) {
      setNickMessage(
        error instanceof Error
          ? error.message
          : "Nickname non salvato. Riprova.",
      );
    } finally {
      setSaving(null);
    }
  }
  async function saveSharing(revoke = false) {
    if (locked || !memberProfile || memberProfileError) return;
    setSaving("sharing");
    setSharingMessage("");
    try {
      const saved = await updateSharedJourney({
        share: !revoke && draft.share,
        journey: !revoke && draft.share ? draft.journey : null,
        interests: !revoke && draft.share ? draft.interests : [],
        expectedUpdatedAt: version,
      });
      dirty.current.shareDirty = false;
      const next = draftFrom(saved, personalJourney);
      setDraft(next);
      setBaseSharing(sharingKey(next));
      setVersion(saved.sharing_updated_at);
      setSharingMessage(
        saved.journey_shared
          ? "Percorso condiviso aggiornato."
          : "Condivisione ritirata. Il tuo percorso personale resta disponibile per te.",
      );
    } catch (error) {
      setSharingMessage(
        error instanceof Error ? error.message : "Scelta non salvata. Riprova.",
      );
    } finally {
      setSaving(null);
    }
  }

  if (memberProfileError)
    return (
      <View style={[ui.card, { gap: 12 }]}>
        <Notice warm>{memberProfileError}</Notice>
        <Button disabled={locked} onPress={() => void reloadSaved()}>
          Riprova caricamento profilo
        </Button>
      </View>
    );
  if (!memberProfile) return <Notice>Caricamento del tuo profilo…</Notice>;
  return (
    <View style={{ gap: 22 }}>
      <View style={[ui.card, { gap: 14 }]}>
        <Text accessibilityRole="header" style={ui.heading}>
          Come ti riconosce Gaia
        </Text>
        <Text style={ui.body}>
          Puoi usare un nome di fantasia. Il nickname viene usato nel tuo
          account e negli strumenti riservati dello studio; l’email resta il
          riferimento per accedere e distinguere eventuali omonimi.
        </Text>
        <Text style={ui.label}>Nickname</Text>
        <TextInput
          ref={nicknameInput}
          accessibilityLabel="Nickname del profilo"
          value={nickname}
          editable={!locked}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={80}
          style={ui.input}
          onChangeText={(value) => {
            setNickname(value);
            setNickMessage("");
          }}
        />
        <Text style={ui.body}>
          Da 2 a 40 caratteri. Evita di usare l’indirizzo email.
        </Text>
        <Button
          disabled={locked || !nickDirty}
          onPress={() => void saveNickname()}
        >
          {saving === "nickname" ? "Salvataggio…" : "Salva nickname"}
        </Button>
        {nickMessage !== "" && (
          <View accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Notice>{nickMessage}</Notice>
          </View>
        )}
      </View>
      <View style={[ui.card, { gap: 16 }]}>
        <Text accessibilityRole="header" style={ui.heading}>
          La scheda che condivido con Gaia
        </Text>
        <Text style={ui.body}>
          Scegli se far conoscere a Gaia la fase del tuo percorso e i temi che
          desideri approfondire. È facoltativo: le tue preferenze per leggere i
          contenuti rimangono separate. Non vengono condivise date, letture
          salvate o progressi e questa scelta non riguarda la newsletter.
        </Text>
        <Button variant="quiet" onPress={() => router.push("/privacy")}>
          Leggi l’informativa privacy
        </Button>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="Condividi il mio percorso con Gaia"
          accessibilityState={{ checked: draft.share, disabled: locked }}
          aria-checked={draft.share}
          disabled={locked}
          style={{ paddingVertical: 12 }}
          onPress={() => {
            setDraft({ ...draft, share: !draft.share });
            setSharingMessage("");
          }}
        >
          <Text style={ui.body}>
            {draft.share ? "☑" : "☐"} Acconsento a condividere con Gaia la fase
            e i temi scelti, che possono riguardare la salute, per preparare
            l’accompagnamento. Posso ritirare la scelta da questa pagina.
          </Text>
        </Pressable>
        {draft.share && (
          <>
            <Text style={ui.label}>Quale percorso vuoi condividere?</Text>
            {memberJourneyOptions.map((choice) => (
              <Pressable
                key={choice.id}
                accessibilityRole="radio"
                accessibilityLabel={`Scheda: ${choice.label}`}
                accessibilityState={{
                  checked: draft.journey === choice.id,
                  disabled: locked,
                }}
                aria-checked={draft.journey === choice.id}
                disabled={locked}
                onPress={() => {
                  setDraft({ ...draft, journey: choice.id });
                  setSharingMessage("");
                }}
                style={[
                  ui.card,
                  {
                    gap: 7,
                    backgroundColor:
                      draft.journey === choice.id
                        ? colors.sagePale
                        : colors.paper,
                  },
                ]}
              >
                <Text style={ui.label}>{choice.label}</Text>
                <Text style={ui.body}>{choice.description}</Text>
              </Pressable>
            ))}
            <Text style={ui.label}>Temi da approfondire (facoltativi)</Text>
            {memberInterestOptions.map((interest) => {
              const checked = draft.interests.includes(interest.id);
              return (
                <Pressable
                  key={interest.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Interesse condiviso: ${interest.label}`}
                  accessibilityState={{ checked, disabled: locked }}
                  aria-checked={checked}
                  disabled={locked}
                  style={{ paddingVertical: 10 }}
                  onPress={() => {
                    setDraft({
                      ...draft,
                      interests: checked
                        ? draft.interests.filter((id) => id !== interest.id)
                        : [...draft.interests, interest.id],
                    });
                    setSharingMessage("");
                  }}
                >
                  <Text style={ui.body}>
                    {checked ? "☑" : "☐"} {interest.label}
                  </Text>
                </Pressable>
              );
            })}
          </>
        )}
        {shareDirty && (
          <Text style={ui.body}>La scelta è in attesa di salvataggio.</Text>
        )}
        <Button
          disabled={locked || !shareDirty}
          onPress={() => void saveSharing()}
        >
          {saving === "sharing"
            ? "Salvataggio…"
            : draft.share
              ? "Salva il percorso condiviso"
              : "Salva senza condividere"}
        </Button>
        {memberProfile.journey_shared && (
          <Button
            variant="quiet"
            disabled={locked}
            onPress={() => void saveSharing(true)}
          >
            Ritira subito la condivisione
          </Button>
        )}
        <Text style={ui.body}>
          {memberProfile.journey_shared
            ? "Hai una scheda condivisa con Gaia."
            : "Il tuo percorso non è condiviso con Gaia."}
        </Text>
        {sharingMessage !== "" && (
          <View accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Notice>{sharingMessage}</Notice>
          </View>
        )}
        {sharingMessage !== "" && (
          <Button
            variant="quiet"
            disabled={locked}
            onPress={() => void reloadSaved()}
          >
            Ricarica la scheda salvata
          </Button>
        )}
      </View>
    </View>
  );
}
