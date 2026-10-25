import React, { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { router, useIsFocused } from "expo-router";
import {
  memberInterestOptions,
  memberJourneyOptions,
  type MemberDirectoryEntry,
  type MemberDirectoryResult,
  type MemberJourney,
} from "@nido/core";
import { loadMemberDirectory } from "@nido/data";
import { client, useApp } from "../src/state";
import { useEditorAccess } from "../src/editor-access";
import { Text, TextInput } from "../src/typography";
import { Screen, Button, Notice, StageHeading, ui } from "../src/ui";
import { PregnancyReadOnly } from "../src/pregnancy-read-only";

const nickname = (member: MemberDirectoryEntry) =>
  member.nickname || "Nickname non impostato";
const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("it-IT");
const journeyLabel = (value: MemberJourney | null) =>
  memberJourneyOptions.find((option) => option.id === value)?.label ??
  "Percorso non indicato";
const interestLabel = (value: string) =>
  memberInterestOptions.find((option) => option.id === value)?.label ?? value;
const directoryAccess = (data: MemberDirectoryResult) => ({
  can_view_journeys: data.can_view_journeys,
  journey_membership: data.journey_membership,
  journey_mfa_required: data.journey_mfa_required,
  mfa_satisfied: data.mfa_satisfied,
});

export default function Members() {
  const { email } = useApp();
  const focused = useIsFocused();
  const [phase, setPhase] = useState("list");
  const [navigation, setNavigation] = useState(0);
  const [accessRetry, setAccessRetry] = useState(0);
  const navigate = useCallback((next: string) => {
    setPhase(next);
    setNavigation((value) => value + 1);
  }, []);
  useEffect(() => {
    if (focused) navigate("list");
  }, [email, focused, navigate]);
  return (
    <Screen
      professional
      back
      title="Iscritti e percorsi"
      subtitle="Riconosci gli account dal nickname e consulta i percorsi condivisi."
      stageKey={`${email ?? "guest"}:${navigation}`}
      focusTargetId={
        phase === "detail" ? "member-detail-heading" : "member-list-heading"
      }
      stageScroll="heading"
    >
      {!email ? (
        <>
          <Notice>Accedi con un account autorizzato a Studio.</Notice>
          <Button onPress={() => router.push("/account?mode=login")}>
            Accedi
          </Button>
        </>
      ) : focused ? (
        // Unmount on blur/account changes: shared details are never retained
        // behind another route and authorization is checked again on return.
        <MemberDirectory
          key={`${email}:${accessRetry}`}
          onNavigate={navigate}
          retryAccess={() => setAccessRetry((value) => value + 1)}
        />
      ) : null}
    </Screen>
  );
}

function MemberDirectory({
  onNavigate,
  retryAccess,
}: {
  onNavigate: (phase: string) => void;
  retryAccess: () => void;
}) {
  const { allowed, checking } = useEditorAccess();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [journey, setJourney] = useState<MemberJourney | "all">("all");
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<MemberDirectoryResult | null>(null);
  const [accessFlags, setAccessFlags] = useState<Pick<
    MemberDirectoryResult,
    | "can_view_journeys"
    | "journey_membership"
    | "journey_mfa_required"
    | "mfa_satisfied"
  > | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [opening, setOpening] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailNotice, setDetailNotice] = useState("");
  const mounted = useRef(true);
  const requestVersion = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestVersion.current++;
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    let active = true;
    const request = ++requestVersion.current;
    if (!allowed || !client) return;
    setLoading(true);
    setError("");
    setResult(null);
    setSelectedId("");
    setOpening("");
    void loadMemberDirectory(client, { term: search, journey, page })
      .then((data) => {
        if (!active || request !== requestVersion.current) return;
        if (page > 0 && page * 20 >= data.total) {
          setPage(Math.max(0, Math.ceil(data.total / 20) - 1));
          return;
        }
        setResult(data);
        setAccessFlags(directoryAccess(data));
      })
      .catch((cause: unknown) => {
        if (active && request === requestVersion.current) {
          setAccessFlags(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "Non è stato possibile caricare gli iscritti. Riprova.",
          );
        }
      })
      .finally(() => {
        if (active && request === requestVersion.current) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [allowed, search, journey, page, version]);

  async function openMember(id: string) {
    if (!client || opening || loading) return;
    const request = ++requestVersion.current;
    setOpening(id);
    setError("");
    setDetailNotice("");
    try {
      // Re-read the protected snapshot before opening. A removed consent or
      // expired MFA can never be replaced by the previously loaded details.
      const fresh = await loadMemberDirectory(client, {
        term: search,
        journey,
        page,
      });
      if (!mounted.current || request !== requestVersion.current) return;
      setResult(fresh);
      setAccessFlags(directoryAccess(fresh));
      if (!fresh.members.some((member) => member.user_id === id)) {
        setSelectedId("");
        setDetailNotice(
          "La scheda è cambiata e non compare più nei risultati attuali. Aggiorna l’elenco.",
        );
        onNavigate("list");
        return;
      }
      setSelectedId(id);
      onNavigate("detail");
    } catch (cause) {
      if (!mounted.current || request !== requestVersion.current) return;
      setResult(null);
      setAccessFlags(null);
      setSelectedId("");
      setError(
        cause instanceof Error
          ? cause.message
          : "Scheda non disponibile. Aggiorna l’elenco e riprova.",
      );
      onNavigate("list");
    } finally {
      if (mounted.current && request === requestVersion.current) setOpening("");
    }
  }
  const selected = result?.members.find(
    (member) => member.user_id === selectedId,
  );
  const pages = Math.max(1, Math.ceil((result?.total ?? 0) / 20));
  function refresh() {
    setSelectedId("");
    setDetailNotice("");
    setJourney("all");
    setPage(0);
    setVersion((value) => value + 1);
    onNavigate("list");
  }
  return (
    <View
      style={{ width: "100%", maxWidth: 900, alignSelf: "center", gap: 20 }}
    >
      {checking ? (
        <Notice>Verifica accesso a Studio…</Notice>
      ) : !allowed ? (
        <>
          <Notice>
            Questa area è riservata agli account autorizzati a Studio. Se
            richiesto, verifica prima il codice di sicurezza.
          </Notice>
          <Button
            variant="secondary"
            onPress={() => router.push("/sicurezza?returnTo=/iscritti")}
          >
            Verifica il codice di sicurezza
          </Button>
          <Button variant="quiet" onPress={retryAccess}>
            Riprova accesso agli iscritti
          </Button>
        </>
      ) : selected ? (
        <>
          <Button
            variant="quiet"
            disabled={Boolean(opening)}
            onPress={() => {
              setSelectedId("");
              onNavigate("list");
            }}
          >
            Torna agli iscritti
          </Button>
          <View style={[ui.card, { gap: 16 }]}>
            <StageHeading id="member-detail-heading">
              {nickname(selected)}
            </StageHeading>
            <Text selectable style={ui.body}>
              {selected.email}
            </Text>
            <Text style={ui.body}>
              {selected.email_confirmed
                ? "Email confermata"
                : "Email da confermare"}
            </Text>
            <Text style={ui.body}>
              Iscrizione: {dateLabel(selected.created_at)}
            </Text>
            <Text style={ui.body}>
              Il nickname può essere scelto anche da altri iscritti. Usa l’email
              per distinguere gli account.
            </Text>
          </View>
          <View style={[ui.card, { gap: 14 }]}>
            <Text accessibilityRole="header" style={ui.heading}>
              Percorso condiviso con Gaia
            </Text>
            {opening ? (
              <Notice>Verifica della scheda attuale…</Notice>
            ) : !result?.can_view_journeys ? (
              <JourneyAccessNotice result={result} />
            ) : !selected.journey_shared ? (
              <Text style={ui.body}>
                La persona non ha scelto di condividere il proprio percorso con
                Gaia.
              </Text>
            ) : (
              <>
                <Text style={ui.heading}>
                  {journeyLabel(selected.shared_journey)}
                </Text>
                <Text style={ui.label}>Argomenti scelti</Text>
                <Text style={ui.body}>
                  {selected.shared_interests.length
                    ? selected.shared_interests.map(interestLabel).join(" · ")
                    : "Nessun argomento indicato."}
                </Text>
                {selected.sharing_updated_at && (
                  <Text style={ui.body}>
                    Aggiornato il {dateLabel(selected.sharing_updated_at)}
                  </Text>
                )}
                <Text style={ui.body}>
                  Informazioni scelte dall’iscritto e modificabili dal suo
                  profilo.
                </Text>
              </>
            )}
          </View>
          {result?.can_view_journeys && !opening && (
            <PregnancyReadOnly
              key={selected.user_id}
              userId={selected.user_id}
            />
          )}
          <Button
            variant="secondary"
            disabled={Boolean(opening)}
            onPress={() => void openMember(selected.user_id)}
          >
            {opening ? "Aggiornamento…" : "Aggiorna scheda"}
          </Button>
        </>
      ) : (
        <>
          <Notice>
            Il nickname aiuta a riconoscere gli iscritti. I percorsi sono
            visibili soltanto quando la persona sceglie di condividerli e
            l’account professionale è abilitato.
          </Notice>
          <Text style={ui.label}>Cerca per nickname o email</Text>
          <TextInput
            accessibilityLabel="Cerca iscritti per nickname o email"
            placeholder="Nickname o email"
            value={query}
            onChangeText={setQuery}
            editable={!opening}
            maxLength={160}
            autoCapitalize="none"
            autoCorrect={false}
            style={ui.input}
          />
          {accessFlags?.can_view_journeys && (
            <View style={{ gap: 10 }}>
              <Text style={ui.label}>Percorso condiviso</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  { id: "all" as const, label: "Tutti gli iscritti" },
                  ...memberJourneyOptions,
                ].map((option) => (
                  <View key={option.id} style={{ minWidth: 150, flexGrow: 1 }}>
                    <Button
                      variant={journey === option.id ? "secondary" : "quiet"}
                      disabled={Boolean(opening)}
                      onPress={() => {
                        setJourney(option.id);
                        setPage(0);
                      }}
                    >{`${journey === option.id ? "✓ " : ""}${option.label}`}</Button>
                  </View>
                ))}
              </View>
            </View>
          )}
          {accessFlags && !accessFlags.can_view_journeys && (
            <JourneyAccessNotice result={accessFlags} />
          )}
          <Button
            variant="secondary"
            disabled={loading || Boolean(opening)}
            onPress={refresh}
          >
            Aggiorna iscritti
          </Button>
          <StageHeading id="member-list-heading">Elenco iscritti</StageHeading>
          {detailNotice !== "" && <Notice>{detailNotice}</Notice>}
          {loading ? (
            <Notice>Caricamento iscritti…</Notice>
          ) : error ? (
            <View accessibilityRole="alert" style={{ gap: 12 }}>
              <Notice warm>{error}</Notice>
              <Button onPress={refresh}>Riprova caricamento iscritti</Button>
            </View>
          ) : result?.members.length === 0 ? (
            <Notice>
              {search || journey !== "all"
                ? "Nessun iscritto corrisponde ai filtri scelti."
                : "Non ci sono iscritti da mostrare."}
            </Notice>
          ) : (
            result?.members.map((member) => (
              <View key={member.user_id} style={[ui.card, { gap: 12 }]}>
                <Text accessibilityRole="header" style={ui.heading}>
                  {nickname(member)}
                </Text>
                <Text selectable style={ui.body}>
                  {member.email}
                </Text>
                <Text style={ui.body}>
                  {member.email_confirmed
                    ? "Email confermata"
                    : "Email da confermare"}{" "}
                  · Iscrizione: {dateLabel(member.created_at)}
                </Text>
                {result.can_view_journeys && !opening && (
                  <Text style={ui.body}>
                    {member.journey_shared
                      ? journeyLabel(member.shared_journey)
                      : "Percorso non condiviso"}
                  </Text>
                )}
                <Button
                  variant="secondary"
                  disabled={Boolean(opening)}
                  accessibilityLabel={`Apri scheda di ${member.nickname || "iscritto"} · ${member.email}`}
                  onPress={() => void openMember(member.user_id)}
                >
                  {opening === member.user_id ? "Apertura…" : "Apri scheda"}
                </Button>
              </View>
            ))
          )}
          {result && !loading && (
            <>
              <Text
                style={ui.body}
              >{`${result.total} iscritti · Pagina ${page + 1} di ${pages}`}</Text>
              <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                <View style={{ flexGrow: 1, minWidth: 150 }}>
                  <Button
                    variant="quiet"
                    disabled={page === 0 || Boolean(opening)}
                    onPress={() => {
                      setPage((value) => value - 1);
                      onNavigate("list");
                    }}
                  >
                    Pagina precedente
                  </Button>
                </View>
                <View style={{ flexGrow: 1, minWidth: 150 }}>
                  <Button
                    variant="quiet"
                    disabled={page + 1 >= pages || Boolean(opening)}
                    onPress={() => {
                      setPage((value) => value + 1);
                      onNavigate("list");
                    }}
                  >
                    Pagina successiva
                  </Button>
                </View>
              </View>
            </>
          )}
        </>
      )}
    </View>
  );
}

function JourneyAccessNotice({
  result,
}: {
  result: Pick<MemberDirectoryResult, "journey_membership"> | null;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Notice>
        {result?.journey_membership
          ? "Per leggere i percorsi condivisi verifica il codice di sicurezza dell’account professionale."
          : "Nickname ed email sono disponibili per la gestione degli account. I percorsi condivisi richiedono un’abilitazione dedicata alla professionista."}
      </Notice>
      {result?.journey_membership && (
        <Button
          variant="secondary"
          onPress={() => router.push("/sicurezza?returnTo=/iscritti")}
        >
          Verifica il codice di sicurezza
        </Button>
      )}
    </View>
  );
}
