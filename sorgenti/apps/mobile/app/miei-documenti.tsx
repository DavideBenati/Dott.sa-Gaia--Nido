import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { useApp } from "../src/state";
import { Text } from "../src/typography";
import { Screen, StageHeading, Button, Notice, ui } from "../src/ui";
import {
  documentFormat,
  documentSize,
  listDocuments,
  type SessionDocument,
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
      <Button onPress={() => router.push("/account?mode=login")}>
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
  const { downloading, downloadMessage, downloadDocumentId, download } =
    useDocumentDownload();
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void listDocuments(page)
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
  }, [page, version]);
  return (
    <Screen
      back
      title="I miei documenti"
      subtitle="I materiali che la professionista ha condiviso con il tuo account."
      stageKey={page}
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
          <Notice>Nessun documento condiviso in questa pagina.</Notice>
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
