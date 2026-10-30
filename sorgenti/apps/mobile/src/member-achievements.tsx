import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { memberAchievements, type Achievement } from "@nido/core";
import { useApp } from "./state";
import { Text } from "./typography";
import { Button, Notice, ui } from "./ui";
import { colors } from "./theme";
import { achievementShare } from "./achievement-share";
import { ShareContentButton } from "./share-content-button";

export function MemberAchievements({ compact = false }: { compact?: boolean }) {
  const {
    email,
    state,
    checklists,
    contentLoading,
    contentError,
    firstRecommendationSelected,
    milestoneLoading,
    milestoneError,
    refreshMilestones,
  } = useApp();
  const badges = memberAchievements({
    authenticated: Boolean(email),
    firstRecommendationSelected,
    preferences: state.preferences,
    favorites: state.favorites,
    progress: state.progress,
    checklists,
  }).filter(
    (badge) =>
      badge.kind !== "selection" ||
      firstRecommendationSelected ||
      (!milestoneLoading && !milestoneError),
  );
  const earned = badges.filter((badge) => badge.earned);
  const visible = compact ? earned.slice(0, 3) : badges;
  return (
    <View style={{ gap: 16 }}>
      <Text style={ui.body}>
        {earned.length}{" "}
        {earned.length === 1 ? "traguardo raggiunto" : "traguardi raggiunti"}.
        Piccoli passi da celebrare, senza confronti o scadenze.
      </Text>
      {!email && (
        <Notice>
          Come ospite, letture e checklist restano su questo dispositivo. Con un
          account puoi ritrovarle dal tuo spazio personale.
        </Notice>
      )}
      {!compact && email && milestoneLoading && (
        <Notice>Verifica del traguardo Prima selezione…</Notice>
      )}
      {!compact && email && milestoneError && (
        <View style={{ gap: 10 }}>
          <Notice>{milestoneError}</Notice>
          <Button variant="secondary" onPress={() => void refreshMilestones()}>
            Riprova verifica traguardo
          </Button>
        </View>
      )}
      {visible.map((badge) => (
        <Badge key={badge.id} badge={badge} />
      ))}
      {compact ? (
        <Button variant="secondary" onPress={() => router.push("/traguardi")}>
          Vedi tutti i miei traguardi
        </Button>
      ) : (
        <>
          {contentLoading && (
            <Notice>Caricamento dei traguardi delle checklist…</Notice>
          )}
          {contentError && (
            <Notice>
              Le checklist non sono disponibili in questo momento. I relativi
              traguardi non possono essere verificati: riprova dalla pagina
              Checklist.
            </Notice>
          )}
          <Text style={ui.body}>
            I traguardi delle letture e delle checklist seguono i tuoi
            salvataggi: se togli tutti i preferiti o riapri un’attività, il
            relativo badge torna da completare.
          </Text>
        </>
      )}
    </View>
  );
}
function Badge({ badge }: { badge: Achievement }) {
  return (
    <View
      style={[
        ui.card,
        {
          gap: 10,
          backgroundColor: badge.earned ? colors.sagePale : colors.paper,
        },
      ]}
    >
      <Text style={ui.label}>
        {badge.earned ? "🌷 TRAGUARDO RAGGIUNTO" : "IL TUO PROSSIMO PASSO"}
      </Text>
      <Text accessibilityRole="header" style={ui.heading}>
        {badge.title}
      </Text>
      <Text style={ui.body}>
        {badge.earned ? badge.description : nextStep(badge)}
      </Text>
      {badge.kind === "checklist" && (
        <Text style={ui.body}>
          {badge.completed} di {badge.total} attività completate.
        </Text>
      )}
      {badge.earned ? (
        <ShareContentButton
          content={achievementShare(badge)}
          label={`Condividi il badge: ${badge.title}`}
        />
      ) : (
        <Button
          variant="secondary"
          onPress={() => {
            if (badge.checklistId)
              router.push({
                pathname: "/checklist",
                params: { id: badge.checklistId },
              });
            else if (badge.kind === "account") router.push("/account");
            else if (badge.kind === "selection") router.navigate("/shop");
            else if (badge.kind === "profile")
              router.push("/welcome?onboarding=1");
            else router.navigate("/discover");
          }}
        >
          {badge.kind === "checklist"
            ? "Apri la checklist"
            : badge.kind === "selection"
              ? "Scegli un consiglio d’acquisto"
              : badge.kind === "saved"
                ? "Esplora gli Argomenti"
                : badge.kind === "account"
                  ? "Crea il tuo account"
                  : "Completa il tuo profilo"}
        </Button>
      )}
    </View>
  );
}
function nextStep(badge: Achievement): string {
  if (badge.kind === "account")
    return "Crea un account e accedi per ricevere il badge di benvenuto.";
  if (badge.kind === "profile")
    return "Scegli il tipo di profilo e completa le tue preferenze iniziali. I dati personali restano facoltativi.";
  if (badge.kind === "selection")
    return "Con il tuo account, scegli un prodotto tramite Vedi su Amazon nei Consigli d’acquisto. Il badge celebra la selezione, indipendentemente dall’acquisto.";
  if (badge.kind === "saved")
    return "Salva una lettura tra i preferiti per ritrovarla quando vuoi.";
  return "Spunta ogni attività quando l’hai completata o hai deciso che non ti serve.";
}
