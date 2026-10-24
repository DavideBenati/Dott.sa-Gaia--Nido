import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { View, Platform, Image, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import {
  type Article,
  type Checklist,
  type Stage,
  validateArticle,
} from "@nido/core";
import {
  loadEditorialContent,
  saveArticle,
  saveChecklist,
  uploadEditorialImage,
  type Content,
} from "@nido/data";
import { client, useApp } from "../../src/state";
import { useEditorAccess } from "../../src/editor-access";
import { Text, TextInput } from "../../src/typography";
import { Screen, StageHeading, Notice, Button, ui } from "../../src/ui";
import { useUnsavedChanges } from "../../src/unsaved-changes";

const Validation = createContext<Record<string, string>>({});
const BusyForm = createContext(false);
const fieldId = (label: string) =>
  "studio-field-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const today = () => new Date().toISOString().slice(0, 10);
const statusLabel = (value: string) =>
  ({
    draft: "Bozza",
    in_review: "Da revisionare",
    published: "Pubblicato",
    archived: "Archiviato",
  })[value] ?? value;
const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
function Field({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const error = useContext(Validation)[label];
  const busy = useContext(BusyForm);
  return (
    <View style={{ gap: 7 }}>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        nativeID={fieldId(label)}
        accessibilityHint={error}
        {...(Platform.OS === "web"
          ? {
              "aria-invalid": Boolean(error),
              "aria-describedby": error ? fieldId(label) + "-error" : undefined,
            }
          : {})}
        value={value}
        editable={!busy}
        onChangeText={onChange}
        multiline={multiline}
        style={[
          ui.input,
          multiline && { minHeight: 110, textAlignVertical: "top" },
          error && { borderColor: "#9B3C2F", borderWidth: 2 },
        ]}
      />
      {error && (
        <Text
          nativeID={fieldId(label) + "-error"}
          accessibilityRole="alert"
          style={[ui.body, { color: "#9B3C2F" }]}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
function StagePicker({
  value,
  onChange,
}: {
  value: Stage;
  onChange: (v: Stage) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={ui.label}>Percorso</Text>
      {(
        [
          ["all", "Tutti i percorsi"],
          ["pregnancy", "Gravidanza"],
          ["postpartum", "Dopo la nascita"],
        ] as const
      ).map(([stage, label]) => (
        <Button
          key={stage}
          variant={value === stage ? "secondary" : "quiet"}
          onPress={() => onChange(stage)}
        >{`${value === stage ? "✓ " : ""}${label}`}</Button>
      ))}
    </View>
  );
}
export default function Studio() {
  const { email } = useApp();
  const { allowed, checking } = useEditorAccess();
  const [stage, setStage] = useState("overview");
  return (
    <Screen
      professional
      title="Studio"
      subtitle="Contenuti, materiali riservati e attività di Gaia."
      stageKey={stage}
      focusTargetId="studio-workspace-heading"
      stageScroll="heading"
    >
      {!email ? (
        <>
          <Notice>Accedi con l’account professionale autorizzato.</Notice>
          <Button onPress={() => router.push("/account?mode=login")}>
            Accedi
          </Button>
        </>
      ) : checking ? (
        <Notice>Verifica dei permessi…</Notice>
      ) : !allowed ? (
        <Notice>
          Accesso riservato. Questo account non ha i permessi editoriali.
          L’abilitazione viene assegnata in Supabase dal titolare del progetto.
          Se hai attivato il secondo fattore, verifica il codice dalla pagina
          Sicurezza nel profilo.
        </Notice>
      ) : (
        <Workspace key={email} onStageChange={setStage} />
      )}
    </Screen>
  );
}
function Workspace({
  onStageChange,
}: {
  onStageChange: (value: string) => void;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [area, setArea] = useState<"overview" | "contents">("overview");
  const { refreshContent } = useApp();
  const [content, setContent] = useState<Content | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [baseline, setBaseline] = useState("");
  const currentDraft = JSON.stringify({ article, checklist });
  const dirty = Boolean((article || checklist) && currentDraft !== baseline);
  const { confirmDiscard } = useUnsavedChanges(dirty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  const [feedbackLocation, setFeedbackLocation] = useState<"top" | "bottom">(
    "bottom",
  );
  const [feedbackSequence, setFeedbackSequence] = useState(0);
  const validationTarget = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [listNavigation, setListNavigation] = useState(0);
  const [tab, setTab] = useState<"articles" | "checklists">("articles");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    if (client)
      void loadEditorialContent(client)
        .then((value) => {
          if (active) setContent(value);
        })
        .catch(() => {
          if (active)
            setLoadError(
              "Caricamento non riuscito. Controlla la connessione e riprova.",
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    else {
      setLoading(false);
      setLoadError("Servizio dei contenuti non disponibile.");
    }
    return () => {
      active = false;
    };
  }, [loadVersion]);
  useEffect(() => {
    setPage(0);
  }, [statusFilter, tab]);
  const editing = article || checklist;
  useEffect(() => {
    onStageChange(
      editing
        ? `edit:${editing.id}:${preview ? "preview" : "form"}`
        : `${area}:${tab}:${listNavigation}`,
    );
  }, [editing?.id, preview, area, tab, listNavigation, onStageChange]);
  useEffect(() => {
    if (!feedbackSequence || Platform.OS !== "web") return;
    let focusFrame = 0;
    const frame = requestAnimationFrame(() => {
      focusFrame = requestAnimationFrame(() => {
        const target = document.getElementById(
          validationTarget.current ?? `studio-feedback-${feedbackLocation}`,
        );
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ block: "nearest", behavior: "auto" });
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(focusFrame);
    };
  }, [feedbackSequence, feedbackLocation]);
  function result(text: string) {
    setMessage(text);
    setFeedbackSequence((value) => value + 1);
  }
  function failFields(fields: Record<string, string>, summary: string): never {
    setInvalid(fields);
    setPreview(false);
    validationTarget.current = Object.keys(fields).length
      ? fieldId(Object.keys(fields)[0])
      : null;
    throw new Error(summary);
  }
  function updateArticle(patch: Partial<Article>) {
    setArticle(
      (a) =>
        a && {
          ...a,
          ...patch,
          approved: false,
          reviewedAt: null,
          reviewerName: null,
          status: a.status === "published" ? "in_review" : a.status,
        },
    );
    setMessage("");
    setInvalid({});
  }
  function updateChecklist(patch: Partial<Checklist>) {
    setChecklist(
      (c) =>
        c && {
          ...c,
          ...patch,
          approved: false,
          status: c.status === "published" ? "in_review" : c.status,
        },
    );
    setMessage("");
    setInvalid({});
  }
  async function save(
    action: "draft" | "publish" | "archive",
    location: "top" | "bottom" = "bottom",
  ) {
    if (!client || busy) return;
    setBusy(true);
    setFeedbackLocation(location);
    setMessage("");
    setInvalid({});
    validationTarget.current = null;
    try {
      if (article) {
        const document: Article = {
          ...article,
          isDemo: false,
          status:
            action === "publish"
              ? "published"
              : action === "archive"
                ? "archived"
                : "draft",
          approved: action === "publish",
          reviewerName: action === "publish" ? article.authorName.trim() : null,
          reviewedAt: action === "publish" ? today() : null,
          publishedAt: action === "publish" ? today() : article.publishedAt,
        };
        const fields: Record<string, string> = {};
        if (document.title.trim().length < 3)
          fields.Titolo = "Inserisci un titolo di almeno 3 caratteri.";
        if (!document.slug)
          fields["Indirizzo articolo"] = "Inserisci l’indirizzo dell’articolo.";
        if (!document.categoryId)
          fields.Titolo ??= "Scegli una categoria prima di salvare.";
        if (Object.keys(fields).length)
          failFields(fields, "Completa titolo, indirizzo e categoria.");
        if (action === "publish") {
          const issues = validateArticle(document);
          if (issues.length) {
            const fields: Record<string, string> = {};
            if (document.title.trim().length < 5)
              fields.Titolo = "Per pubblicare inserisci almeno 5 caratteri.";
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(document.slug))
              fields["Indirizzo articolo"] =
                "Usa lettere minuscole, numeri e trattini.";
            if (!document.subtitle.trim())
              fields.Sottotitolo = "Inserisci un sottotitolo.";
            if (!document.authorName.trim())
              fields["Autore e revisore"] = "Indica l’autore verificato.";
            if (!document.authorRole.trim())
              fields["Ruolo professionale"] = "Indica il ruolo professionale.";
            document.sections.forEach((section, i) => {
              if (!section.heading.trim())
                fields[`Titolo sezione ${i + 1}`] =
                  "Completa il titolo della sezione.";
              if (
                !section.paragraphs.length ||
                section.paragraphs.some((paragraph) => !paragraph.trim())
              )
                fields[`Testo sezione ${i + 1}`] =
                  "Completa il testo della sezione.";
            });
            failFields(fields, issues.join(" "));
          }
        }
        const saved = await saveArticle(client, document);
        setArticle(saved);
        setBaseline(JSON.stringify({ article: saved, checklist: null }));
        setContent(
          (c) =>
            c && {
              ...c,
              articles: [saved, ...c.articles.filter((a) => a.id !== saved.id)],
            },
        );
        result(
          action === "publish" && saved.status !== "published"
            ? "Modifiche salvate, approvazione precedente revocata. Controlla l’anteprima e premi di nuovo Approva e pubblica per confermare la nuova revisione."
            : `Articolo salvato: ${statusLabel(saved.status).toLowerCase()}.`,
        );
      } else if (checklist) {
        const document: Checklist = {
          ...checklist,
          isDemo: false,
          approved: action === "publish",
          status:
            action === "publish"
              ? "published"
              : action === "archive"
                ? "archived"
                : "draft",
        };
        if (document.title.trim().length < 3)
          failFields(
            { Titolo: "Inserisci un titolo di almeno 3 caratteri." },
            "Inserisci un titolo di almeno 3 caratteri.",
          );
        if (
          action === "publish" &&
          (!document.items.length ||
            document.items.some((item) => !item.label.trim()))
        )
          failFields(
            Object.fromEntries(
              document.items.flatMap((item, i) =>
                !item.label.trim()
                  ? [[`Attività ${i + 1}`, "Completa questa attività."]]
                  : [],
              ),
            ),
            "Completa le voci prima di pubblicare.",
          );
        const saved = await saveChecklist(client, document);
        setChecklist(saved);
        setBaseline(JSON.stringify({ article: null, checklist: saved }));
        setContent(
          (c) =>
            c && {
              ...c,
              checklists: [
                saved,
                ...c.checklists.filter((v) => v.id !== saved.id),
              ],
            },
        );
        result(
          action === "publish" && saved.status !== "published"
            ? "Modifiche salvate. Controlla e premi nuovamente Approva e pubblica per confermare la nuova revisione."
            : `Checklist salvata: ${statusLabel(saved.status).toLowerCase()}.`,
        );
      }
      try {
        await refreshContent();
      } catch {
        result(
          "Contenuto salvato. L’aggiornamento della vista pubblica non è riuscito: ricarica la pagina per verificarlo.",
        );
      }
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Salvataggio non riuscito.";
      result(
        detail.includes("verified clinical reviewer")
          ? "Bozze abilitate. Per pubblicare, il titolare deve registrare in Supabase la verifica dell’abilitazione professionale."
          : detail.includes("reviewer identity")
            ? "Il nome dell’autore/revisore deve coincidere con il nome professionale verificato in Supabase."
            : detail,
      );
    } finally {
      setBusy(false);
    }
  }
  function backup() {
    if (Platform.OS !== "web" || !content) return;
    const blob = new Blob(
      [
        JSON.stringify(
          { version: 1, exportedAt: new Date().toISOString(), content },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      "metimaia-contenuti-" + new Date().toISOString().slice(0, 10) + ".json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage(
      "Copia dei contenuti scaricata. Conservala in luogo riservato: comprende anche bozze. Non comprende account, conversazioni, immagini o iscritti newsletter.",
    );
  }
  function chooseImage() {
    if (Platform.OS !== "web" || busy || !client) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file || !client) return;
      setBusy(true);
      void uploadEditorialImage(client, file, file.name)
        .then((imageUrl) => updateArticle({ imageUrl }))
        .catch(() => {
          validationTarget.current = null;
          setFeedbackLocation("top");
          result(
            "Caricamento non riuscito. Usa JPEG, PNG o WebP fino a 5 MB e verifica i permessi.",
          );
        })
        .finally(() => setBusy(false));
    };
    input.click();
  }
  function newDraft(kind: "articles" | "checklists") {
    if (!content || busy || !confirmDiscard()) return;
    setArea("contents");
    setTab(kind);
    setMessage("");
    setInvalid({});
    setPreview(false);
    if (kind === "articles") {
      const value: Article = {
        id: crypto.randomUUID(),
        slug: "",
        title: "",
        subtitle: "",
        categoryId: content.categories[0]?.id ?? "",
        stage: "all",
        weekFrom: null,
        weekTo: null,
        imageUrl: "",
        readingMinutes: 3,
        authorName: "Dott.sa Gaia",
        authorRole: "Ostetrica",
        publishedAt: null,
        reviewedAt: null,
        reviewerName: null,
        status: "draft",
        approved: false,
        isDemo: false,
        sections: [{ heading: "", paragraphs: [""] }],
        references: [],
        videoUrl: null,
      };
      setArticle(value);
      setChecklist(null);
      setBaseline(JSON.stringify({ article: value, checklist: null }));
    } else {
      const value: Checklist = {
        id: crypto.randomUUID(),
        title: "",
        description: "",
        stage: "all",
        status: "draft",
        approved: false,
        isDemo: false,
        items: [{ id: crypto.randomUUID(), label: "" }],
      };
      setArticle(null);
      setChecklist(value);
      setBaseline(JSON.stringify({ article: null, checklist: value }));
    }
  }
  const filtered = (
    tab === "articles" ? (content?.articles ?? []) : (content?.checklists ?? [])
  ).filter(
    (item) =>
      item.title
        .toLocaleLowerCase("it")
        .includes(query.trim().toLocaleLowerCase("it")) &&
      (statusFilter === "all" || item.status === statusFilter),
  );
  useEffect(() => {
    setPage((value) =>
      Math.min(value, Math.max(0, Math.ceil(filtered.length / 10) - 1)),
    );
  }, [filtered.length]);
  const pageItems = filtered.slice(page * 10, page * 10 + 10);
  const feedback = (location: "top" | "bottom") =>
    message && feedbackLocation === location ? (
      <View
        nativeID={`studio-feedback-${location}`}
        tabIndex={-1}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Notice>{message}</Notice>
      </View>
    ) : null;
  const actions = (location: "top" | "bottom") => (
    <View style={{ gap: 10 }}>
      {feedback(location)}
      <View style={{ flexDirection: wide ? "row" : "column", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button
            disabled={busy}
            accessibilityLabel={
              location === "top"
                ? "Salva bozza, comandi iniziali"
                : "Salva bozza"
            }
            onPress={() => void save("draft", location)}
          >
            {busy ? "Salvataggio…" : "Salva bozza"}
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            disabled={busy}
            variant="secondary"
            accessibilityLabel={
              location === "top"
                ? "Approva e pubblica, comandi iniziali"
                : "Approva e pubblica"
            }
            onPress={() => void save("publish", location)}
          >
            Approva e pubblica
          </Button>
        </View>
      </View>
    </View>
  );
  return (
    <View
      style={{
        width: "100%",
        maxWidth: editing ? 840 : 1040,
        alignSelf: "center",
        gap: 20,
      }}
    >
      <StageHeading id="studio-workspace-heading">
        {editing
          ? `${preview ? "Anteprima" : "Modifica"}: ${editing.title || (article ? "nuovo articolo" : "nuova checklist")}`
          : area === "overview"
            ? "Il tuo Studio"
            : "Articoli e checklist"}
      </StageHeading>
      {!editing && loading && <Notice>Caricamento dei contenuti…</Notice>}
      {!editing && loadError !== "" && (
        <View accessibilityRole="alert" style={{ gap: 10 }}>
          <Notice>{loadError}</Notice>
          <Button
            variant="secondary"
            onPress={() => setLoadVersion((value) => value + 1)}
          >
            Riprova caricamento contenuti
          </Button>
        </View>
      )}
      {dirty && (
        <Notice>
          Modifiche non salvate. Salva la bozza prima di lasciare questa pagina.
        </Notice>
      )}
      {!editing && area === "overview" ? (
        <>
          <View
            style={{
              flexDirection: wide ? "row" : "column",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <View style={[ui.card, { gap: 12, width: wide ? "48%" : "100%" }]}>
              <Text style={ui.heading}>Contenuti del sito</Text>
              <Text style={ui.body}>
                Scrivi, rivedi e pubblica articoli e checklist.
              </Text>
              <Button
                disabled={!content || loading}
                onPress={() => newDraft("articles")}
              >
                Nuovo articolo
              </Button>
              <Button variant="secondary" onPress={() => setArea("contents")}>
                Apri articoli e checklist
              </Button>
            </View>
            {(
              [
                [
                  "Documenti e allegati",
                  "Carica materiali e scegli chi può consultarli.",
                  "Documenti e allegati riservati",
                  "/documenti-studio",
                ],
                [
                  "Conversazioni",
                  "Apri le conversazioni riservate e prepara le risposte.",
                  "Conversazioni riservate",
                  "/messaggi",
                ],
                [
                  "Richieste d’incontro",
                  "Consulta e aggiorna le richieste ricevute.",
                  "Richieste d’incontro",
                  "/richieste",
                ],
                [
                  "Shop",
                  "Gestisci prodotti, selezione Amazon e impostazioni di vendita.",
                  "Gestisci shop e merchandise",
                  "/shop?manage=1",
                ],
                [
                  "Newsletter",
                  "Sincronizza iscritti e revoche ed esporta i confermati.",
                  "Gestisci newsletter e revoche",
                  "/newsletter-admin",
                ],
              ] as const
            ).map(([title, description, label, href]) => (
              <View
                key={href}
                style={[ui.card, { gap: 12, width: wide ? "48%" : "100%" }]}
              >
                <Text style={ui.heading}>{title}</Text>
                <Text style={ui.body}>{description}</Text>
                <Button variant="secondary" onPress={() => router.push(href)}>
                  {label}
                </Button>
              </View>
            ))}
          </View>
          <View style={[ui.card, { gap: 12 }]}>
            <Text style={ui.heading}>Impostazioni e controlli</Text>
            <Button
              variant="secondary"
              onPress={() => router.push("/impostazioni")}
            >
              Gaia, servizi e informazioni privacy
            </Button>
            <Button variant="quiet" onPress={() => router.push("/sicurezza")}>
              Sicurezza e verifica a due fattori
            </Button>
            <Button variant="quiet" onPress={() => router.push("/verifiche")}>
              Verifiche prima di promuovere il sito
            </Button>
            <Button
              variant="quiet"
              disabled={!content || busy}
              onPress={backup}
            >
              Scarica copia dei contenuti (JSON)
            </Button>
            {message !== "" && (
              <View accessibilityRole="alert">
                <Notice>{message}</Notice>
              </View>
            )}
          </View>
        </>
      ) : !editing ? (
        <>
          <Button variant="quiet" onPress={() => setArea("overview")}>
            Torna alla panoramica Studio
          </Button>
          {content && (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <View style={{ flex: 1, minWidth: 120 }}>
                  <Button
                    variant={tab === "articles" ? "secondary" : "quiet"}
                    onPress={() => setTab("articles")}
                  >{`Articoli (${content.articles.length})`}</Button>
                </View>
                <View style={{ flex: 1, minWidth: 120 }}>
                  <Button
                    variant={tab === "checklists" ? "secondary" : "quiet"}
                    onPress={() => setTab("checklists")}
                  >{`Checklist (${content.checklists.length})`}</Button>
                </View>
              </View>
              <Button onPress={() => newDraft(tab)}>
                {tab === "articles" ? "Nuovo articolo" : "Nuova checklist"}
              </Button>
              <TextInput
                accessibilityLabel="Cerca contenuti per titolo"
                placeholder="Cerca per titolo"
                value={query}
                onChangeText={(value) => {
                  setQuery(value);
                  setPage(0);
                }}
                style={ui.input}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(
                  [
                    ["all", "Tutti"],
                    ["draft", "Bozze"],
                    ["in_review", "Da revisionare"],
                    ["published", "Pubblicati"],
                    ["archived", "Archiviati"],
                  ] as const
                ).map(([value, label]) => (
                  <View key={value} style={{ minWidth: 110 }}>
                    <Button
                      variant={statusFilter === value ? "secondary" : "quiet"}
                      onPress={() => setStatusFilter(value)}
                    >{`${statusFilter === value ? "✓ " : ""}${label}`}</Button>
                  </View>
                ))}
              </View>
              <Text
                style={ui.body}
              >{`${filtered.length} contenuti · Pagina ${page + 1} di ${Math.max(1, Math.ceil(filtered.length / 10))}`}</Text>
              {pageItems.map((item) => (
                <View key={item.id} style={[ui.card, { gap: 10 }]}>
                  <Text style={ui.heading}>{item.title}</Text>
                  <Text style={ui.body}>{statusLabel(item.status)}</Text>
                  <Button
                    variant="secondary"
                    onPress={() => {
                      setMessage("");
                      setInvalid({});
                      setPreview(false);
                      if (tab === "articles") {
                        setArticle(structuredClone(item as Article));
                        setChecklist(null);
                        setBaseline(
                          JSON.stringify({ article: item, checklist: null }),
                        );
                      } else {
                        setArticle(null);
                        setChecklist(structuredClone(item as Checklist));
                        setBaseline(
                          JSON.stringify({ article: null, checklist: item }),
                        );
                      }
                    }}
                  >{`Modifica ${item.title}`}</Button>
                </View>
              ))}
              {filtered.length === 0 && (
                <Notice>
                  {query || statusFilter !== "all"
                    ? "Nessun contenuto corrisponde alla ricerca. Cambia ricerca o filtro."
                    : "Nessun contenuto. Inizia con una nuova bozza."}
                </Notice>
              )}
              <View style={{ gap: 8 }}>
                <Button
                  variant="quiet"
                  disabled={page === 0}
                  onPress={() => {
                    setPage((value) => value - 1);
                    setListNavigation((value) => value + 1);
                  }}
                >
                  Pagina precedente contenuti
                </Button>
                <Button
                  variant="quiet"
                  disabled={(page + 1) * 10 >= filtered.length}
                  onPress={() => {
                    setPage((value) => value + 1);
                    setListNavigation((value) => value + 1);
                  }}
                >
                  Pagina successiva contenuti
                </Button>
              </View>
            </>
          )}
        </>
      ) : null}
      {editing && content && (
        <>
          <Button
            disabled={busy}
            variant="quiet"
            onPress={() => {
              if (
                !confirmDiscard(
                  "Tornare all’elenco? Le modifiche non salvate saranno perse.",
                )
              )
                return;
              setArticle(null);
              setChecklist(null);
              setMessage("");
              setInvalid({});
              setArea("contents");
            }}
          >
            Torna all’elenco
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onPress={() => setPreview(!preview)}
          >
            {preview ? "Torna alla modifica" : "Anteprima"}
          </Button>
          <Text
            style={ui.label}
          >{`${statusLabel(editing.status)}${dirty ? " · Modifiche da salvare" : " · Nessuna modifica da salvare"}`}</Text>
          {actions("top")}
          <Notice>
            “Approva e pubblica” conferma la revisione professionale. Per gli
            articoli servono autore, copertina, testo e fonti HTTPS; il database
            verifica l’abilitazione del revisore.
          </Notice>
          <BusyForm.Provider value={busy}>
            <Validation.Provider value={invalid}>
              {preview ? (
                <View style={[ui.card, { gap: 18 }]}>
                  <Text style={ui.heading}>
                    {editing.title || "Titolo della bozza"}
                  </Text>
                  {article ? (
                    <>
                      {article.imageUrl !== "" && (
                        <Image
                          source={{ uri: article.imageUrl }}
                          style={{
                            width: "100%",
                            height: 220,
                            borderRadius: 16,
                          }}
                          resizeMode="cover"
                        />
                      )}
                      <Text style={ui.body}>{article.subtitle}</Text>
                      {article.sections.map((section, i) => (
                        <View key={i} style={{ gap: 10 }}>
                          <Text style={ui.heading}>{section.heading}</Text>
                          {section.paragraphs.map((p, j) => (
                            <Text key={j} style={ui.body}>
                              {p}
                            </Text>
                          ))}
                        </View>
                      ))}
                      <Text style={ui.label}>Fonti</Text>
                      {article.references.map((ref, i) => (
                        <Text key={i} style={ui.body}>
                          {ref.label} · {ref.url}
                        </Text>
                      ))}
                    </>
                  ) : (
                    checklist && (
                      <>
                        <Text style={ui.body}>{checklist.description}</Text>
                        {checklist.items.map((item) => (
                          <Text key={item.id} style={ui.body}>
                            ☐ {item.label}
                            {item.note ? ` — ${item.note}` : ""}
                          </Text>
                        ))}
                      </>
                    )
                  )}
                </View>
              ) : (
                <View
                  style={[ui.card, { gap: 20, opacity: busy ? 0.6 : 1 }]}
                  pointerEvents={busy ? "none" : "auto"}
                >
                  <Field
                    label="Titolo"
                    value={editing.title}
                    onChange={(title) =>
                      article
                        ? updateArticle({
                            title,
                            slug:
                              article.slug === slug(article.title)
                                ? slug(title)
                                : article.slug,
                          })
                        : updateChecklist({ title })
                    }
                  />
                  {article ? (
                    <>
                      <Field
                        label="Indirizzo articolo"
                        value={article.slug}
                        onChange={(value) =>
                          updateArticle({ slug: slug(value) })
                        }
                      />
                      <Field
                        label="Sottotitolo"
                        value={article.subtitle}
                        onChange={(subtitle) => updateArticle({ subtitle })}
                        multiline
                      />
                      <Text style={ui.label}>Categoria</Text>
                      {content.categories.map((c) => (
                        <Button
                          key={c.id}
                          variant={
                            article.categoryId === c.id ? "secondary" : "quiet"
                          }
                          onPress={() => updateArticle({ categoryId: c.id })}
                        >{`${article.categoryId === c.id ? "✓ " : ""}${c.name}`}</Button>
                      ))}
                      <Field
                        label="Autore e revisore"
                        value={article.authorName}
                        onChange={(authorName) => updateArticle({ authorName })}
                      />
                      <Field
                        label="Ruolo professionale"
                        value={article.authorRole}
                        onChange={(authorRole) => updateArticle({ authorRole })}
                      />
                      <Field
                        label="Minuti di lettura"
                        value={String(article.readingMinutes)}
                        onChange={(v) =>
                          updateArticle({
                            readingMinutes: Number(v.replace(/\D/g, "")) || 1,
                          })
                        }
                      />
                      <Field
                        label="Immagine di copertina (HTTPS)"
                        value={article.imageUrl}
                        onChange={(imageUrl) => updateArticle({ imageUrl })}
                      />
                      {Platform.OS === "web" && (
                        <Button variant="secondary" onPress={chooseImage}>
                          Carica immagine
                        </Button>
                      )}
                      <Text style={ui.body}>
                        JPEG, PNG o WebP, massimo 5 MB. Usa immagini editoriali
                        senza dati personali delle pazienti.
                      </Text>
                      {article.sections.map((section, i) => (
                        <View key={i} style={{ gap: 12 }}>
                          <Field
                            label={`Titolo sezione ${i + 1}`}
                            value={section.heading}
                            onChange={(heading) =>
                              updateArticle({
                                sections: article.sections.map((s, j) =>
                                  j === i ? { ...s, heading } : s,
                                ),
                              })
                            }
                          />
                          <Field
                            label={`Testo sezione ${i + 1}`}
                            value={section.paragraphs.join("\n\n")}
                            onChange={(text) =>
                              updateArticle({
                                sections: article.sections.map((s, j) =>
                                  j === i
                                    ? { ...s, paragraphs: text.split(/\n\n+/) }
                                    : s,
                                ),
                              })
                            }
                            multiline
                          />
                          <Button
                            variant="quiet"
                            disabled={i === 0}
                            onPress={() => {
                              const sections = [...article.sections];
                              [sections[i - 1], sections[i]] = [
                                sections[i],
                                sections[i - 1],
                              ];
                              updateArticle({ sections });
                            }}
                          >{`Sposta su sezione ${i + 1}`}</Button>
                          <Button
                            variant="quiet"
                            disabled={i === article.sections.length - 1}
                            onPress={() => {
                              const sections = [...article.sections];
                              [sections[i + 1], sections[i]] = [
                                sections[i],
                                sections[i + 1],
                              ];
                              updateArticle({ sections });
                            }}
                          >{`Sposta giù sezione ${i + 1}`}</Button>
                          <Text style={ui.body}>
                            Separa i paragrafi con una riga vuota. Per un elenco
                            usa una riga per voce preceduta da •.
                          </Text>
                          <Button
                            variant="quiet"
                            onPress={() =>
                              updateArticle({
                                sections: article.sections.filter(
                                  (_, j) => j !== i,
                                ),
                              })
                            }
                          >{`Rimuovi sezione ${i + 1}`}</Button>
                        </View>
                      ))}
                      <Button
                        variant="secondary"
                        onPress={() =>
                          updateArticle({
                            sections: [
                              ...article.sections,
                              { heading: "", paragraphs: [""] },
                            ],
                          })
                        }
                      >
                        Aggiungi sezione
                      </Button>
                      <Text style={ui.label}>Fonti e riferimenti</Text>
                      {article.references.map((ref, i) => (
                        <View key={i} style={{ gap: 10 }}>
                          <Field
                            label={`Nome fonte ${i + 1}`}
                            value={ref.label}
                            onChange={(label) =>
                              updateArticle({
                                references: article.references.map((r, j) =>
                                  j === i ? { ...r, label } : r,
                                ),
                              })
                            }
                          />
                          <Field
                            label={`Link fonte ${i + 1}`}
                            value={ref.url}
                            onChange={(url) =>
                              updateArticle({
                                references: article.references.map((r, j) =>
                                  j === i ? { ...r, url } : r,
                                ),
                              })
                            }
                          />
                          <Button
                            variant="quiet"
                            onPress={() =>
                              updateArticle({
                                references: article.references.filter(
                                  (_, j) => j !== i,
                                ),
                              })
                            }
                          >{`Rimuovi fonte ${i + 1}`}</Button>
                        </View>
                      ))}
                      <Button
                        variant="secondary"
                        onPress={() =>
                          updateArticle({
                            references: [
                              ...article.references,
                              { label: "", url: "" },
                            ],
                          })
                        }
                      >
                        Aggiungi fonte
                      </Button>
                    </>
                  ) : (
                    checklist && (
                      <>
                        <Field
                          label="Descrizione"
                          value={checklist.description}
                          onChange={(description) =>
                            updateChecklist({ description })
                          }
                          multiline
                        />
                        {checklist.items.map((item, i) => (
                          <View key={item.id} style={{ gap: 10 }}>
                            <Field
                              label={`Attività ${i + 1}`}
                              value={item.label}
                              onChange={(label) =>
                                updateChecklist({
                                  items: checklist.items.map((v, j) =>
                                    j === i ? { ...v, label } : v,
                                  ),
                                })
                              }
                            />
                            <Field
                              label={`Nota attività ${i + 1}`}
                              value={item.note ?? ""}
                              onChange={(note) =>
                                updateChecklist({
                                  items: checklist.items.map((v, j) =>
                                    j === i ? { ...v, note } : v,
                                  ),
                                })
                              }
                            />
                            <Button
                              variant="quiet"
                              onPress={() =>
                                updateChecklist({
                                  items: checklist.items.filter(
                                    (_, j) => j !== i,
                                  ),
                                })
                              }
                            >{`Rimuovi attività ${i + 1}`}</Button>
                          </View>
                        ))}
                        <Button
                          variant="secondary"
                          onPress={() =>
                            updateChecklist({
                              items: [
                                ...checklist.items,
                                { id: crypto.randomUUID(), label: "" },
                              ],
                            })
                          }
                        >
                          Aggiungi attività
                        </Button>
                      </>
                    )
                  )}
                  <StagePicker
                    value={editing.stage}
                    onChange={(stage) =>
                      article
                        ? updateArticle({ stage })
                        : updateChecklist({ stage })
                    }
                  />
                </View>
              )}
            </Validation.Provider>
          </BusyForm.Provider>
          {actions("bottom")}
          <Button
            disabled={busy}
            variant="quiet"
            onPress={() => {
              if (
                Platform.OS !== "web" ||
                window.confirm(
                  "Archiviare questo contenuto e rimuoverlo dal sito?",
                )
              )
                void save("archive");
            }}
          >
            Archivia
          </Button>
        </>
      )}
    </View>
  );
}
