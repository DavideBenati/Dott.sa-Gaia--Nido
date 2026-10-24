import React, { useEffect, useId, useRef, useState } from "react";
import { View, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import { useApp } from "../src/state";
import { Screen, StageHeading, Button, Notice, ui } from "../src/ui";
import { Text, TextInput } from "../src/typography";
import {
  loadDocumentAccess,
  listDocuments,
  uploadDocument,
  documentRecipients,
  searchDocumentUsers,
  saveDocumentRecipients,
  setDocumentActive,
  saveDocumentDetails,
  type DocumentFilter,
  documentFormat,
  documentSize,
  type SessionDocument,
  type DocumentRecipient,
  type DocumentAccess,
} from "../src/session-documents";
import { useDocumentDownload } from "../src/document-download";
import { useUnsavedChanges } from "../src/unsaved-changes";
export default function DocumentStudio() {
  const { email } = useApp();
  return email ? (
    <Workspace key={email} />
  ) : (
    <Screen
      back
      professional
      title="Documenti e allegati"
      subtitle="Carica i materiali e scegli gli account autorizzati per ogni file."
    >
      <Notice>Accedi con l’account professionale autorizzato.</Notice>
      <Button onPress={() => router.push("/account?mode=login")}>Accedi</Button>
    </Screen>
  );
}

function Workspace() {
  const [access, setAccess] = useState<DocumentAccess | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [accessVersion, setAccessVersion] = useState(0);
  const [documents, setDocuments] = useState<SessionDocument[]>([]);
  const [page, setPage] = useState(0);
  const [phase, setPhase] = useState<"list" | "upload" | "detail">("list");
  const [filterTerm, setFilterTerm] = useState("");
  const [appliedTerm, setAppliedTerm] = useState("");
  const [stateFilter, setStateFilter] =
    useState<DocumentFilter["state"]>("all");
  const [detailTitle, setDetailTitle] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [accessMessage, setAccessMessage] = useState("");
  const feedbackId = useId();
  useEffect(() => {
    if (!accessMessage || Platform.OS !== "web") return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(feedbackId);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [accessMessage, feedbackId]);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<SessionDocument | null>(null);
  const [recipientsReady, setRecipientsReady] = useState(false);
  const [recipientError, setRecipientError] = useState("");
  const [recipientsVersion, setRecipientsVersion] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [baseline, setBaseline] = useState("");
  const [knownUsers, setKnownUsers] = useState<Record<string, string>>({});
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<DocumentRecipient[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const mounted = useRef(true);
  const searchSequence = useRef(0);
  const { downloading, downloadMessage, downloadDocumentId, download } =
    useDocumentDownload();
  const locked = busy || searching || Boolean(downloading);
  const recipientDirty = Boolean(
    selected &&
    recipientsReady &&
    baseline &&
    JSON.stringify([...selectedIds].sort()) !== baseline,
  );
  const detailDirty = Boolean(
    selected &&
    (detailTitle !== selected.title ||
      detailDescription !== selected.description),
  );
  const uploadDirty =
    phase === "upload" && Boolean(file || title || description);
  const dirty = recipientDirty || detailDirty || uploadDirty;
  const { confirmDiscard, allowNavigation } = useUnsavedChanges(dirty);
  const focusTargetId =
    phase === "detail"
      ? "document-detail-heading"
      : phase === "upload"
        ? "document-upload-heading"
        : "document-list-heading";
  function openDocument(doc: SessionDocument) {
    if (
      !confirmDiscard(
        "Aprire questo documento? Le modifiche non salvate saranno perse.",
      )
    )
      return;
    setSelected(doc);
    setDetailTitle(doc.title);
    setDetailDescription(doc.description);
    setRecipientsReady(false);
    setPhase("detail");
    setMessage("");
    setAccessMessage("");
    setFile(null);
    setTitle("");
    setDescription("");
  }
  function backToList() {
    if (
      !confirmDiscard(
        "Tornare all’elenco? Le modifiche non salvate saranno perse.",
      )
    )
      return;
    setPhase("list");
    setSelected(null);
    setFile(null);
    setTitle("");
    setDescription("");
    setMessage("");
    setAccessMessage("");
  }
  function newMaterial() {
    if (!confirmDiscard()) return;
    setSelected(null);
    setFile(null);
    setTitle("");
    setDescription("");
    setMessage("");
    setAccessMessage("");
    setPhase("upload");
  }
  async function saveDetails() {
    if (!selected || locked || !detailDirty) return;
    setBusy(true);
    setAccessMessage("");
    try {
      const doc = await saveDocumentDetails(
        selected,
        detailTitle,
        detailDescription,
      );
      if (!mounted.current) return;
      setSelected(doc);
      setDetailTitle(doc.title);
      setDetailDescription(doc.description);
      setVersion((v) => v + 1);
      setAccessMessage(
        "Titolo e descrizione salvati. Il file e i destinatari non sono stati modificati.",
      );
    } catch (e) {
      if (mounted.current)
        setAccessMessage(
          e instanceof Error ? e.message : "Dettagli non salvati.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setAccessLoading(true);
    setAccessError("");
    void loadDocumentAccess()
      .then(
        (data) => {
          if (active) setAccess(data);
        },
        (e) => {
          if (active) {
            setAccess(null);
            setAccessError(
              e instanceof Error ? e.message : "Accesso non disponibile.",
            );
          }
        },
      )
      .finally(() => {
        if (active) setAccessLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessVersion]);
  useEffect(() => {
    let active = true;
    if (!access?.can_manage) return;
    setLoading(true);
    setError("");
    void listDocuments(page, true, { term: appliedTerm, state: stateFilter })
      .then(
        (rows) => {
          if (active) setDocuments(rows);
        },
        (e) => {
          if (active) {
            setDocuments([]);
            setError(
              e instanceof Error ? e.message : "Elenco non disponibile.",
            );
          }
        },
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [access?.can_manage, page, version, appliedTerm, stateFilter]);
  useEffect(() => {
    let active = true;
    searchSequence.current++;
    setRecipientsReady(false);
    setRecipientError("");
    setSelectedIds([]);
    setKnownUsers({});
    setBaseline("");
    setTerm("");
    setResults([]);
    setSearchMessage("");
    setArchiveConfirm(false);
    setShowAllRecipients(false);
    if (!selected || selected.state !== "ready") return;
    void documentRecipients(selected.id).then(
      (rows) => {
        if (active) {
          setSelectedIds(rows.map((r) => r.user_id));
          setKnownUsers(
            Object.fromEntries(rows.map((r) => [r.user_id, r.email])),
          );
          setBaseline(JSON.stringify(rows.map((r) => r.user_id).sort()));
          setRecipientsReady(true);
        }
      },
      (e) => {
        if (active)
          setRecipientError(
            e instanceof Error ? e.message : "Destinatari non disponibili.",
          );
      },
    );
    return () => {
      active = false;
    };
  }, [selected?.id, recipientsVersion]);
  function chooseFile() {
    if (Platform.OS !== "web" || locked) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.docx,.pptx";
    input.onchange = () => {
      if (mounted.current) {
        setFile(input.files?.[0] ?? null);
        setMessage("");
      }
    };
    input.click();
  }
  async function upload() {
    if (!file || locked) return;
    setBusy(true);
    setMessage("");
    try {
      const doc = await uploadDocument(file, title, description);
      if (!mounted.current) return;
      setRecipientsReady(false);
      setAccessMessage("");
      setSelected(doc);
      setDetailTitle(doc.title);
      setDetailDescription(doc.description);
      setPhase("detail");
      setVersion((v) => v + 1);
      setFile(null);
      setTitle("");
      setDescription("");
      setMessage(
        "File caricato in area privata. Seleziona i destinatari e salva per condividerlo.",
      );
    } catch (e) {
      if (mounted.current)
        setMessage(
          e instanceof Error ? e.message : "Caricamento non riuscito.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function search() {
    if (locked || term.trim().length < 3) return;
    const sequence = ++searchSequence.current;
    setSearching(true);
    setSearchMessage("");
    try {
      const rows = await searchDocumentUsers(term);
      if (mounted.current && sequence === searchSequence.current) {
        setResults(rows);
        setKnownUsers((previous) => ({
          ...previous,
          ...Object.fromEntries(rows.map((row) => [row.user_id, row.email])),
        }));
        setSearchMessage(
          rows.length === 0
            ? "Nessun account confermato trovato. Controlla l’email o attendi la conferma dell’account."
            : rows.length === 20
              ? "Mostrati al massimo 20 risultati: completa l’email per restringere la ricerca."
              : `${rows.length} account trovati.`,
        );
      }
    } catch (e) {
      if (mounted.current && sequence === searchSequence.current)
        setSearchMessage(
          e instanceof Error ? e.message : "Ricerca non riuscita.",
        );
    } finally {
      if (mounted.current) setSearching(false);
    }
  }
  function toggle(id: string) {
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id],
    );
    setMessage("");
  }
  async function saveRecipients() {
    if (!selected || locked || !recipientsReady) return;
    setBusy(true);
    setAccessMessage("");
    try {
      const latest = await saveDocumentRecipients(
        selected.id,
        selectedIds,
        JSON.parse(baseline) as string[],
      );
      if (!mounted.current) return;
      if (
        latest &&
        latest.title === selected.title &&
        latest.description === selected.description &&
        latest.active === selected.active
      )
        setSelected(latest);
      setBaseline(JSON.stringify([...selectedIds].sort()));
      setAccessMessage(
        `Accessi salvati per ${selectedIds.length} account. Solo questi utenti possono scaricare il file.`,
      );
      setRecipientsVersion((v) => v + 1);
    } catch (e) {
      if (mounted.current)
        setAccessMessage(
          e instanceof Error ? e.message : "Salvataggio non riuscito.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function active(value: boolean) {
    if (!selected || locked) return;
    setBusy(true);
    setAccessMessage("");
    try {
      const doc = await setDocumentActive(selected, value);
      if (!mounted.current) return;
      setSelected(doc);
      setVersion((v) => v + 1);
      setRecipientsVersion((v) => v + 1);
      setArchiveConfirm(false);
      setAccessMessage(
        value
          ? "Documento riattivato. Scegli e salva nuovamente i destinatari prima di condividerlo."
          : "Documento archiviato e accessi revocati. Le copie già scaricate restano sui dispositivi dei destinatari.",
      );
    } catch (e) {
      if (mounted.current)
        setAccessMessage(
          e instanceof Error ? e.message : "Aggiornamento non riuscito.",
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <Screen
      professional
      back={phase === "list"}
      title="Documenti e allegati"
      subtitle="Carica i materiali e scegli gli account autorizzati per ogni file."
      stageKey={`${phase}:${phase === "detail" ? selected?.id : page}:${appliedTerm}:${stateFilter}`}
      focusTargetId={focusTargetId}
      stageScroll="heading"
    >
      <View
        style={{ maxWidth: 900, width: "100%", alignSelf: "center", gap: 20 }}
      >
        {accessLoading ? (
          <Notice>Verifica accesso documenti…</Notice>
        ) : accessError ? (
          <View accessibilityRole="alert">
            <Notice>{accessError}</Notice>
          </View>
        ) : !access?.membership ? (
          <Notice>
            Questo account non è abilitato alla gestione dei documenti
            riservati. Il solo ruolo editoriale non concede questo permesso.
          </Notice>
        ) : !access.can_manage ? (
          <>
            <Notice>
              Per gestire i documenti devi verificare il secondo fattore con
              l’account professionale autorizzato.
            </Notice>
            <Button
              onPress={() =>
                allowNavigation(() =>
                  router.push("/sicurezza?returnTo=/documenti-studio"),
                )
              }
            >
              Verifica il codice a due fattori
            </Button>
          </>
        ) : (
          <>
            {phase === "list" && (
              <>
                <Notice>
                  Ogni file resta privato finché non scegli i destinatari e
                  salvi gli accessi. Gli utenti devono avere un account
                  confermato. La revoca blocca i nuovi download, ma non cancella
                  le copie già scaricate.
                </Notice>
                <StageHeading id="document-list-heading">
                  Documenti caricati
                </StageHeading>
                <Button onPress={newMaterial}>Carica un nuovo materiale</Button>
                <Text style={ui.label}>Cerca per titolo o nome file</Text>
                <TextInput
                  accessibilityLabel="Cerca documenti per titolo o nome file"
                  value={filterTerm}
                  onChangeText={setFilterTerm}
                  maxLength={180}
                  style={ui.input}
                  onSubmitEditing={() => {
                    setAppliedTerm(filterTerm.trim());
                    setPage(0);
                  }}
                />
                <Button
                  variant="secondary"
                  disabled={locked || loading}
                  onPress={() => {
                    setAppliedTerm(filterTerm.trim());
                    setPage(0);
                  }}
                >
                  Cerca documenti
                </Button>
                <View
                  style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  {(
                    [
                      ["all", "Tutti"],
                      ["active", "Attivi"],
                      ["archived", "Archiviati"],
                      ["incomplete", "Da completare"],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      variant={stateFilter === value ? "secondary" : "quiet"}
                      disabled={locked || loading}
                      onPress={() => {
                        setStateFilter(value);
                        setPage(0);
                      }}
                    >
                      {`${stateFilter === value ? "✓ " : ""}${label}`}
                    </Button>
                  ))}
                </View>
                {appliedTerm !== "" && (
                  <Text style={ui.body}>{`Ricerca: ${appliedTerm}`}</Text>
                )}
                <Button
                  variant="quiet"
                  disabled={locked || loading}
                  onPress={() => setVersion((v) => v + 1)}
                >
                  Aggiorna elenco documenti
                </Button>
                {loading ? (
                  <Notice>Caricamento elenco…</Notice>
                ) : error ? (
                  <View accessibilityRole="alert">
                    <Notice>{error}</Notice>
                  </View>
                ) : documents.length === 0 ? (
                  <Notice>Nessun documento in questa pagina.</Notice>
                ) : (
                  documents.map((doc) => (
                    <View style={[ui.card, { gap: 8 }]} key={doc.id}>
                      <Text style={ui.heading}>{doc.title}</Text>
                      <Text style={ui.body}>
                        {documentFormat(doc.mime_type)} ·{" "}
                        {documentSize(doc.size_bytes)} ·{" "}
                        {doc.state !== "ready"
                          ? "Caricamento non completato"
                          : doc.active
                            ? "Attivo"
                            : "Archiviato"}
                      </Text>
                      <Button
                        variant="secondary"
                        disabled={locked}
                        onPress={() => openDocument(doc)}
                      >{`Gestisci accessi: ${doc.title}`}</Button>
                    </View>
                  ))
                )}
                <Text
                  accessibilityLiveRegion="polite"
                  style={ui.label}
                >{`Pagina ${page + 1} · ${documents.length} documenti mostrati`}</Text>
                <View style={{ gap: 8 }}>
                  <Button
                    variant="quiet"
                    disabled={locked || loading || page === 0}
                    onPress={() => setPage((v) => v - 1)}
                  >
                    Pagina precedente
                  </Button>
                  <Button
                    variant="quiet"
                    disabled={locked || loading || documents.length < 20}
                    onPress={() => setPage((v) => v + 1)}
                  >
                    Altri documenti caricati
                  </Button>
                </View>
              </>
            )}
            {phase === "upload" && (
              <>
                <Button variant="quiet" disabled={locked} onPress={backToList}>
                  Torna all’elenco documenti
                </Button>
                <View style={[ui.card, { gap: 12 }]}>
                  <StageHeading id="document-upload-heading">
                    Carica un nuovo materiale
                  </StageHeading>
                  <Text style={ui.label}>Titolo del documento</Text>
                  <TextInput
                    accessibilityLabel="Titolo del documento"
                    value={title}
                    onChangeText={setTitle}
                    maxLength={180}
                    editable={!locked}
                    style={ui.input}
                  />
                  <Text style={ui.label}>
                    Descrizione per i destinatari (facoltativa)
                  </Text>
                  <TextInput
                    accessibilityLabel="Descrizione del documento"
                    value={description}
                    onChangeText={setDescription}
                    maxLength={2000}
                    multiline
                    editable={!locked}
                    style={ui.input}
                  />
                  <Button
                    variant="secondary"
                    disabled={locked}
                    onPress={chooseFile}
                  >
                    Scegli PDF, Word o PowerPoint
                  </Button>
                  <Text style={ui.body}>
                    {file
                      ? `${file.name} · ${documentSize(file.size)}`
                      : "Nessun file selezionato."}
                  </Text>
                  <Text style={ui.body}>
                    PDF, Word .docx e PowerPoint .pptx, fino a 20 MB. I formati
                    .docm e .pptm non sono accettati.
                  </Text>
                  <Button
                    disabled={locked || !file || !title.trim()}
                    onPress={() => void upload()}
                  >
                    {busy ? "Attendi…" : "Carica in area privata"}
                  </Button>
                </View>
                {message !== "" && (
                  <View
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
                    <Notice>{message}</Notice>
                  </View>
                )}
              </>
            )}
            {phase === "detail" && message !== "" && (
              <View accessibilityRole="alert" accessibilityLiveRegion="polite">
                <Notice>{message}</Notice>
              </View>
            )}
            {phase === "detail" && selected && (
              <View style={[ui.card, { gap: 16 }]}>
                <Button variant="quiet" disabled={locked} onPress={backToList}>
                  Torna all’elenco documenti
                </Button>
                <StageHeading id="document-detail-heading">{`Accessi a: ${selected.title}`}</StageHeading>
                <Text selectable style={ui.body}>
                  {selected.file_name}
                </Text>
                {selected.state === "ready" && (
                  <View style={{ gap: 12 }}>
                    <Text style={ui.label}>Titolo e descrizione</Text>
                    <TextInput
                      accessibilityLabel="Modifica titolo del documento"
                      value={detailTitle}
                      onChangeText={setDetailTitle}
                      maxLength={180}
                      editable={!locked}
                      style={ui.input}
                    />
                    <TextInput
                      accessibilityLabel="Modifica descrizione del documento"
                      value={detailDescription}
                      onChangeText={setDetailDescription}
                      maxLength={2000}
                      multiline
                      editable={!locked}
                      style={ui.input}
                    />
                    <Button
                      variant="secondary"
                      disabled={locked || !detailDirty || !detailTitle.trim()}
                      onPress={() => void saveDetails()}
                    >
                      Salva titolo e descrizione
                    </Button>
                  </View>
                )}
                {detailDirty && (
                  <Notice>
                    Titolo o descrizione modificati: salva per aggiornare il
                    documento.
                  </Notice>
                )}
                {recipientDirty && (
                  <Notice>
                    Destinatari modificati: gli accessi cambieranno soltanto
                    dopo il salvataggio.
                  </Notice>
                )}
                {recipientsReady && selected.active && (
                  <Button
                    disabled={
                      locked || !recipientDirty || selectedIds.length > 200
                    }
                    onPress={() => void saveRecipients()}
                  >
                    Salva destinatari selezionati
                  </Button>
                )}
                {selected.state !== "ready" ? (
                  <Notice>
                    Il caricamento non è completo: nessun paziente può accedere
                    a questo materiale. Riprova caricando un nuovo file.
                  </Notice>
                ) : (
                  <>
                    <Button
                      variant="quiet"
                      disabled={locked}
                      onPress={() => void download(selected)}
                    >
                      {downloading === selected.id
                        ? "Download in corso…"
                        : "Scarica per verificare il file"}
                    </Button>
                    {downloadDocumentId === selected.id &&
                      downloadMessage !== "" && (
                        <View
                          accessibilityRole="alert"
                          accessibilityLiveRegion="polite"
                        >
                          <Notice>{downloadMessage}</Notice>
                        </View>
                      )}
                    {!selected.active ? (
                      <>
                        <Notice>
                          Documento archiviato: non è visibile ai destinatari.
                          Riattivarlo non ripristina gli accessi precedenti.
                        </Notice>
                        <Button
                          variant="secondary"
                          disabled={locked}
                          onPress={() => void active(true)}
                        >
                          Riattiva documento
                        </Button>
                      </>
                    ) : (
                      <>
                        {recipientError ? (
                          <View accessibilityRole="alert">
                            <Notice>{recipientError}</Notice>
                            <Button
                              variant="quiet"
                              disabled={locked}
                              onPress={() => setRecipientsVersion((v) => v + 1)}
                            >
                              Ricarica destinatari
                            </Button>
                          </View>
                        ) : !recipientsReady ? (
                          <Notice>Caricamento destinatari…</Notice>
                        ) : (
                          <>
                            <Button
                              variant="quiet"
                              disabled={locked}
                              onPress={() => {
                                if (
                                  recipientDirty &&
                                  !confirmDiscard(
                                    "Ricaricare i destinatari attuali? Le modifiche ai destinatari non salvate saranno perse.",
                                  )
                                )
                                  return;
                                setAccessMessage("");
                                setRecipientsVersion((v) => v + 1);
                              }}
                            >
                              Ricarica destinatari attuali
                            </Button>
                            <Text style={ui.label}>
                              Cerca utenti registrati per email
                            </Text>
                            <TextInput
                              accessibilityLabel="Cerca destinatari per email"
                              placeholder="Almeno 3 caratteri dell’email"
                              value={term}
                              onChangeText={(value) => {
                                searchSequence.current++;
                                setTerm(value);
                                setResults([]);
                                setSearchMessage("");
                              }}
                              editable={!locked}
                              maxLength={254}
                              autoCapitalize="none"
                              keyboardType="email-address"
                              style={ui.input}
                            />
                            <Button
                              variant="secondary"
                              disabled={locked || term.trim().length < 3}
                              onPress={() => void search()}
                            >
                              {searching
                                ? "Ricerca…"
                                : "Cerca account confermati"}
                            </Button>
                            {searchMessage !== "" && (
                              <Text
                                accessibilityLiveRegion="polite"
                                style={ui.body}
                              >
                                {searchMessage}
                              </Text>
                            )}
                            {results.map((user) => (
                              <Pressable
                                key={user.user_id}
                                accessibilityRole="checkbox"
                                accessibilityLabel={`Condividi con ${user.email}`}
                                accessibilityState={{
                                  checked: selectedIds.includes(user.user_id),
                                  disabled: locked,
                                }}
                                aria-checked={selectedIds.includes(
                                  user.user_id,
                                )}
                                disabled={locked}
                                onPress={() => toggle(user.user_id)}
                                style={[ui.card, { padding: 16 }]}
                              >
                                <Text
                                  style={ui.body}
                                >{`${selectedIds.includes(user.user_id) ? "☑" : "☐"} ${user.email}`}</Text>
                              </Pressable>
                            ))}
                            <Text
                              style={ui.label}
                            >{`Destinatari selezionati: ${selectedIds.length}`}</Text>
                            {selectedIds.length === 0 ? (
                              <Text style={ui.body}>
                                Nessun destinatario selezionato.
                              </Text>
                            ) : (
                              selectedIds
                                .slice(
                                  0,
                                  showAllRecipients ? selectedIds.length : 10,
                                )
                                .map((id) => (
                                  <View key={id} style={{ gap: 4 }}>
                                    <Text selectable style={ui.body}>
                                      {knownUsers[id] ?? "Account selezionato"}
                                    </Text>
                                    <Button
                                      variant="quiet"
                                      disabled={locked}
                                      onPress={() => toggle(id)}
                                    >{`Rimuovi ${knownUsers[id] ?? "destinatario"}`}</Button>
                                  </View>
                                ))
                            )}
                            {selectedIds.length > 10 && (
                              <Button
                                variant="quiet"
                                disabled={locked}
                                onPress={() => setShowAllRecipients((v) => !v)}
                              >
                                {showAllRecipients
                                  ? "Mostra meno destinatari"
                                  : `Mostra tutti i ${selectedIds.length} destinatari`}
                              </Button>
                            )}
                            <Button
                              variant="quiet"
                              disabled={locked || selectedIds.length === 0}
                              onPress={() => setSelectedIds([])}
                            >
                              Deseleziona tutti
                            </Button>
                            <Notice>
                              Le modifiche sono applicate soltanto quando premi
                              Salva destinatari. Salvare senza destinatari
                              revoca tutti gli accessi a questo file.
                            </Notice>
                            <Button
                              disabled={
                                locked ||
                                !recipientDirty ||
                                selectedIds.length > 200
                              }
                              onPress={() => void saveRecipients()}
                            >
                              {busy ? "Salvataggio…" : "Salva destinatari"}
                            </Button>
                          </>
                        )}
                        {archiveConfirm ? (
                          <>
                            <Notice>
                              Archiviare rimuove tutti i destinatari. Il file
                              resta nell’archivio privato; eventuali copie già
                              scaricate non possono essere richiamate.
                            </Notice>
                            <Button
                              disabled={locked}
                              onPress={() => void active(false)}
                            >
                              Conferma archiviazione e revoca
                            </Button>
                            <Button
                              variant="quiet"
                              disabled={locked}
                              onPress={() => setArchiveConfirm(false)}
                            >
                              Annulla archiviazione
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="quiet"
                            disabled={locked}
                            onPress={() => {
                              if (
                                !confirmDiscard(
                                  "Archiviare questo documento? Le modifiche non salvate saranno scartate.",
                                )
                              )
                                return;
                              setDetailTitle(selected.title);
                              setDetailDescription(selected.description);
                              setSelectedIds(
                                JSON.parse(baseline || "[]") as string[],
                              );
                              setArchiveConfirm(true);
                            }}
                          >
                            Archivia e revoca tutti gli accessi
                          </Button>
                        )}
                      </>
                    )}
                  </>
                )}
                {accessMessage !== "" && (
                  <View
                    nativeID={feedbackId}
                    tabIndex={-1}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
                    <Notice>{accessMessage}</Notice>
                  </View>
                )}
              </View>
            )}
          </>
        )}
        <Button
          variant="quiet"
          disabled={locked || accessLoading}
          onPress={() => setAccessVersion((v) => v + 1)}
        >
          Aggiorna autorizzazioni documenti
        </Button>
        <Button
          variant="quiet"
          onPress={() =>
            allowNavigation(() =>
              router.push("/sicurezza?returnTo=/documenti-studio"),
            )
          }
        >
          Sicurezza dell’account
        </Button>
      </View>
    </Screen>
  );
}
