import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { useApp } from "../src/state";
import { Text, TextInput } from "../src/typography";
import { Screen, StageHeading, Button, Notice, ui } from "../src/ui";
import {
  documentFormat,
  documentSize,
  listDocuments,
  type SessionDocument,
  type DocumentFilter,
} from "../src/session-documents";
import { useDocumentDownload } from "../src/document-download";
export default function MyDocuments() {
  const { email } = useApp();
  return email ? (
    <DocumentList key={email} />
  ) : (
    <Screen
      back
      title="I miei documenti"
      subtitle="I materiali che la professionista ha condiviso con il tuo account."
    >
      <Notice>
        Accedi con l’email a cui sono stati assegnati i materiali.
      </Notice>
      <Button
        onPress={() => router.push("/account?mode=login&returnTo=documents")}
      >
        Accedi ai miei documenti
      </Button>
    </Screen>
  );
}

function DocumentList() {
  const [documents, setDocuments] = useState<SessionDocument[]>([]);
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [format, setFormat] =
    useState<NonNullable<DocumentFilter["format"]>>("all");
  const filtered = term !== "" || format !== "all";
  function resetSearch() {
    setQuery("");
    setTerm("");
    setFormat("all");
    setPage(0);
    setVersion((value) => value + 1);
  }
  const { downloading, downloadMessage, downloadDocumentId, download } =
    useDocumentDownload();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void listDocuments(page, false, { term, format })
      .then(
        (rows) => {
          if (active) setDocuments(rows);
        },
        (e) => {
          if (active) {
            setDocuments([]);
            setError(
              e instanceof Error ? e.message : "Documenti non disponibili.",
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
  }, [page, version, term, format]);
  return (
    <Screen
      back
      title="I miei documenti"
      subtitle="I materiali che la professionista ha condiviso con il tuo account."
      stageKey={`${page}:${term}:${format}`}
      focusTargetId="my-documents-heading"
      stageScroll="heading"
    >
      <View
        style={{ maxWidth: 800, width: "100%", alignSelf: "center", gap: 20 }}
      >
        <StageHeading id="my-documents-heading">
          Materiali condivisi
        </StageHeading>
        <Notice>
          Qui trovi solo i file assegnati al tuo account. Se un materiale non
          compare, chiedi alla professionista di verificare l’email
          destinataria. Conserva i file scaricati con attenzione.
        </Notice>
        <View style={[ui.card, { gap: 12, padding: 16 }]}>
          <Text style={ui.label}>Trova un materiale</Text>
          <TextInput
            accessibilityLabel="Cerca nei miei documenti"
            placeholder="Titolo o nome del file"
            value={query}
            onChangeText={setQuery}
            maxLength={180}
            returnKeyType="search"
            style={ui.input}
            onSubmitEditing={() => {
              setPage(0);
              setTerm(query.trim());
              setVersion((value) => value + 1);
            }}
          />
          <Button
            variant="secondary"
            disabled={loading || Boolean(downloading)}
            onPress={() => {
              setPage(0);
              setTerm(query.trim());
              setVersion((value) => value + 1);
            }}
          >
            Cerca documenti
          </Button>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(
              [
                ["all", "Tutti"],
                ["pdf", "PDF"],
                ["docx", "Word"],
                ["pptx", "PowerPoint"],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                aria-pressed={format === value}
                disabled={Boolean(downloading)}
                onPress={() => {
                  setPage(0);
                  setFormat(value);
                }}
                style={[ui.pill, format === value && ui.pillActive]}
              >
                <Text
                  style={[ui.pillText, format === value && ui.pillTextActive]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {filtered && (
            <Button
              variant="quiet"
              disabled={Boolean(downloading)}
              onPress={resetSearch}
            >
              Mostra tutti i materiali
            </Button>
          )}
        </View>
        <Button
          variant="quiet"
          disabled={loading || Boolean(downloading)}
          onPress={() => setVersion((v) => v + 1)}
        >
          Aggiorna documenti
        </Button>
        {loading ? (
          <Notice>Caricamento documenti…</Notice>
        ) : error ? (
          <View accessibilityRole="alert">
            <Notice>{error}</Notice>
          </View>
        ) : documents.length === 0 ? (
          <View style={{ gap: 12 }}>
            <Notice>
              {filtered
                ? "Nessun materiale corrisponde alla ricerca. Prova un’altra parola o mostra tutti i materiali."
                : page > 0
                  ? "Hai raggiunto la fine dei materiali. Puoi tornare alla pagina precedente."
                  : "Gaia non ha ancora condiviso materiali con questo account. Quando lo farà, li ritroverai qui."}
            </Notice>
          </View>
        ) : (
          documents.map((doc) => (
            <View style={[ui.card, { gap: 12 }]} key={doc.id}>
              <Text accessibilityRole="header" style={ui.heading}>
                {doc.title}
              </Text>
              {doc.description !== "" && (
                <Text style={ui.body}>{doc.description}</Text>
              )}
              <Text style={ui.body}>
                {documentFormat(doc.mime_type)} · {documentSize(doc.size_bytes)}
                {doc.ready_at
                  ? ` · ${new Date(doc.ready_at).toLocaleDateString("it-IT")}`
                  : ""}
              </Text>
              <Text selectable style={ui.body}>
                {doc.file_name}
              </Text>
              <Button
                disabled={Boolean(downloading)}
                onPress={() => void download(doc)}
              >
                {downloading === doc.id
                  ? "Download in corso…"
                  : `Scarica ${documentFormat(doc.mime_type)}`}
              </Button>
              {downloadDocumentId === doc.id && downloadMessage !== "" && (
                <View
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                >
                  <Notice>{downloadMessage}</Notice>
                </View>
              )}
            </View>
          ))
        )}
        <Text
          accessibilityLiveRegion="polite"
          style={ui.label}
        >{`Pagina ${page + 1} · ${documents.length} documenti mostrati`}</Text>
        <Button
          variant="quiet"
          disabled={loading || page === 0 || Boolean(downloading)}
          onPress={() => setPage((v) => v - 1)}
        >
          Pagina precedente
        </Button>
        <Button
          variant="quiet"
          disabled={loading || documents.length < 20 || Boolean(downloading)}
          onPress={() => setPage((v) => v + 1)}
        >
          Altri documenti
        </Button>
      </View>
    </Screen>
  );
}
