import React, { useEffect, useId, useRef, useState } from "react";
import { View, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import { useApp } from "../src/state";
import { Screen, Button, Notice, ui } from "../src/ui";
import { Text, TextInput } from "../src/typography";
import {
  loadDocumentAccess,
  listDocuments,
  uploadDocument,
  documentRecipients,
  searchDocumentUsers,
  saveDocumentRecipients,
  setDocumentActive,
  documentFormat,
  documentSize,
  type SessionDocument,
  type DocumentRecipient,
  type DocumentAccess,
} from "../src/session-documents";
import { useDocumentDownload } from "../src/document-download";
export default function DocumentStudio() {
  const { email } = useApp();
  return (
    <Screen
      back
      title="Documenti e allegati"
      subtitle="Carica i materiali e scegli gli account autorizzati per ogni file."
    >
      {email ? (
        <Workspace key={email} />
      ) : (
        <>
          <Notice>Accedi con l’account professionale autorizzato.</Notice>
          <Button onPress={() => router.push("/account?mode=login")}>
            Accedi
          </Button>
        </>
      )}
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
    void listDocuments(page, true)
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
  }, [access?.can_manage, page, version]);
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
      await saveDocumentRecipients(
        selected.id,
        selectedIds,
        JSON.parse(baseline) as string[],
      );
      if (!mounted.current) return;
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
  const dirty = JSON.stringify([...selectedIds].sort()) !== baseline;
  return (
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
          Questo account non è abilitato alla gestione dei documenti riservati.
          Il solo ruolo editoriale non concede questo permesso.
        </Notice>
      ) : !access.can_manage ? (
        <>
          <Notice>
            Per gestire i documenti devi verificare il secondo fattore con
            l’account professionale autorizzato.
          </Notice>
          <Button onPress={() => router.push("/sicurezza")}>
            Verifica il codice a due fattori
          </Button>
        </>
      ) : (
        <>
          <Notice>
            Ogni file resta privato finché non scegli i destinatari e salvi gli
            accessi. Gli utenti devono avere un account confermato. La revoca
            blocca i nuovi download, ma non cancella le copie già scaricate.
          </Notice>
          <View style={[ui.card, { gap: 12 }]}>
            <Text accessibilityRole="header" style={ui.heading}>
              Carica un nuovo materiale
            </Text>
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
            <Button variant="secondary" disabled={locked} onPress={chooseFile}>
              Scegli PDF, Word o PowerPoint
            </Button>
            <Text style={ui.body}>
              {file
                ? `${file.name} · ${documentSize(file.size)}`
                : "Nessun file selezionato."}
            </Text>
            <Text style={ui.body}>
              PDF, Word .docx e PowerPoint .pptx, fino a 20 MB. I formati .docm
              e .pptm non sono accettati.
            </Text>
            <Button
              disabled={locked || !file || !title.trim()}
              onPress={() => void upload()}
            >
              {busy ? "Attendi…" : "Carica in area privata"}
            </Button>
          </View>
          {message !== "" && (
            <View accessibilityRole="alert" accessibilityLiveRegion="polite">
              <Notice>{message}</Notice>
            </View>
          )}
          <Text accessibilityRole="header" style={ui.heading}>
            Documenti caricati
          </Text>
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
                  onPress={() => {
                    if (
                      dirty &&
                      Platform.OS === "web" &&
                      !window.confirm(
                        "Cambiare documento? Le modifiche ai destinatari non salvate saranno perse.",
                      )
                    )
                      return;
                    setRecipientsReady(false);
                    setSelected(doc);
                    setMessage("");
                    setAccessMessage("");
                  }}
                >{`Gestisci accessi: ${doc.title}`}</Button>
              </View>
            ))
          )}
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
          {selected && (
            <View style={[ui.card, { gap: 16 }]}>
              <Text
                accessibilityRole="header"
                style={ui.heading}
              >{`Accessi a: ${selected.title}`}</Text>
              <Text selectable style={ui.body}>
                {selected.file_name}
              </Text>
              {selected.state !== "ready" ? (
                <Notice>
                  Il caricamento non è completo: nessun paziente può accedere a
                  questo materiale. Riprova caricando un nuovo file.
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
                                dirty &&
                                Platform.OS === "web" &&
                                !window.confirm(
                                  "Ricaricare i destinatari attuali? Le modifiche non salvate saranno perse.",
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
                              aria-checked={selectedIds.includes(user.user_id)}
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
                            selectedIds.map((id) => (
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
                          <Button
                            variant="quiet"
                            disabled={locked || selectedIds.length === 0}
                            onPress={() => setSelectedIds([])}
                          >
                            Deseleziona tutti
                          </Button>
                          <Notice>
                            Le modifiche sono applicate soltanto quando premi
                            Salva destinatari. Salvare senza destinatari revoca
                            tutti gli accessi a questo file.
                          </Notice>
                          <Button
                            disabled={
                              locked || !dirty || selectedIds.length > 200
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
                          onPress={() => setArchiveConfirm(true)}
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
      <Button variant="quiet" onPress={() => router.push("/sicurezza")}>
        Sicurezza dell’account
      </Button>
    </View>
  );
}
