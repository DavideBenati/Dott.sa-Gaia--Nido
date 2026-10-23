import React, { useEffect, useState } from "react";
import { View, Platform, Image } from "react-native";
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
import { client, useApp } from "../src/state";
import { useEditorAccess } from "../src/editor-access";
import { Text, TextInput } from "../src/typography";
import { Screen, Notice, Button, ui } from "../src/ui";

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
  return (
    <View style={{ gap: 7 }}>
      <Text style={ui.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        style={[
          ui.input,
          multiline && { minHeight: 110, textAlignVertical: "top" },
        ]}
      />
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
  return (
    <Screen
      back
      title="Area professionista"
      subtitle="Articoli e checklist di metiMaia"
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
        <Workspace key={email} />
      )}
    </Screen>
  );
}
function Workspace() {
  const { refreshContent } = useApp();
  const [content, setContent] = useState<Content | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [baseline, setBaseline] = useState("");
  const currentDraft = JSON.stringify({ article, checklist });
  const dirty = Boolean((article || checklist) && currentDraft !== baseline);
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const [tab, setTab] = useState<"articles" | "checklists">("articles");
  useEffect(() => {
    let active = true;
    if (client)
      void loadEditorialContent(client)
        .then((value) => {
          if (active) setContent(value);
        })
        .catch(() => {
          if (active)
            setMessage(
              "Caricamento non riuscito. Verifica la connessione e riapri l’area professionista.",
            );
        });
    return () => {
      active = false;
    };
  }, []);
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
  }
  async function save(action: "draft" | "publish" | "archive") {
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
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
        if (
          document.title.trim().length < 3 ||
          !document.slug ||
          !document.categoryId
        )
          throw new Error("Completa titolo, indirizzo e categoria.");
        if (action === "publish") {
          const issues = validateArticle(document);
          if (issues.length) throw new Error(issues.join(" "));
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
        setMessage(
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
          throw new Error("Inserisci un titolo di almeno 3 caratteri.");
        if (
          action === "publish" &&
          (!document.items.length ||
            document.items.some((item) => !item.label.trim()))
        )
          throw new Error("Completa le voci prima di pubblicare.");
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
        setMessage(
          action === "publish" && saved.status !== "published"
            ? "Modifiche salvate. Controlla e premi nuovamente Approva e pubblica per confermare la nuova revisione."
            : `Checklist salvata: ${statusLabel(saved.status).toLowerCase()}.`,
        );
      }
      await refreshContent();
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Salvataggio non riuscito.";
      setMessage(
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
  async function exportSubscribers() {
    if (!client || busy || Platform.OS !== "web") return;
    setBusy(true);
    setMessage("");
    try {
      const rows: {
        email: string;
        confirmed_at: string;
        consent_version: string;
      }[] = [];
      for (let start = 0; ; start += 500) {
        const { data, error } = await client
          .rpc("newsletter_editor_list")
          .range(start, start + 499);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 500) break;
      }
      if (!rows.length) {
        setMessage(
          "Nessuna iscrizione confermata. Gli indirizzi in attesa o disiscritti non vengono esportati.",
        );
        return;
      }
      const cell = (text: string) =>
        '"' + text.replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"';
      const csv = [
        "email,confirmed_at,consent_version",
        ...rows.map((row) =>
          [row.email, row.confirmed_at, row.consent_version]
            .map(cell)
            .join(","),
        ),
      ].join("\r\n");
      const href = URL.createObjectURL(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = href;
      link.download = "metimaia-newsletter-confermati.csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      setMessage(
        `Esportati ${rows.length} indirizzi confermati. Il file contiene dati personali: conservalo con accesso riservato. Prima di ogni invio usa un elenco aggiornato e includi la disiscrizione del servizio di invio.`,
      );
    } catch {
      setMessage(
        "Elenco newsletter non disponibile. Applica prima la configurazione newsletter in Supabase.",
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
        .catch(() =>
          setMessage(
            "Caricamento non riuscito. Usa JPEG, PNG o WebP fino a 5 MB e verifica i permessi.",
          ),
        )
        .finally(() => setBusy(false));
    };
    input.click();
  }
  const editing = article || checklist;
  return (
    <View
      style={{ width: "100%", maxWidth: 840, alignSelf: "center", gap: 20 }}
    >
      <Text style={ui.heading}>Il pannello di Gaia</Text>
      <Button variant="quiet" disabled={!content || busy} onPress={backup}>
        Scarica copia dei contenuti (JSON)
      </Button>
      {dirty && (
        <Notice>
          Modifiche non salvate. Salva la bozza prima di lasciare questa pagina.
        </Notice>
      )}
      <Button variant="secondary" onPress={() => router.push("/impostazioni")}>
        Gaia, servizi e informazioni privacy
      </Button>
      <Button variant="secondary" onPress={() => router.push("/messaggi")}>
        Conversazioni riservate
      </Button>
      <Button variant="secondary" onPress={() => router.push("/richieste")}>
        Richieste d’incontro
      </Button>
      <Button variant="quiet" onPress={() => router.push("/sicurezza")}>
        Sicurezza e verifica a due fattori
      </Button>
      <Button variant="secondary" onPress={() => router.push("/shop")}>
        Gestisci shop e merchandise
      </Button>
      <Notice>
        Solo contenuti pubblicati e approvati saranno visibili alle famiglie. Le
        modifiche a contenuti già pubblicati richiedono una nuova approvazione.
      </Notice>
      <View style={{ gap: 8 }}>
        <Button variant="secondary" onPress={() => router.push("/newsletter")}>
          Newsletter: iscrizione e informazioni
        </Button>
        <Button
          variant="quiet"
          disabled={busy}
          onPress={() => void exportSubscribers()}
        >
          Esporta iscritti confermati (CSV)
        </Button>
        <Text style={ui.body}>
          Le campagne si compongono e inviano da Resend. Questa area gestisce
          iscrizioni e relativo elenco; non invia newsletter a tutti
          automaticamente.
        </Text>
      </View>
      {message !== "" && (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Notice>{message}</Notice>
        </View>
      )}
      {!content ? (
        <Text style={ui.body}>Caricamento dei contenuti…</Text>
      ) : !editing ? (
        <>
          <Button
            variant={tab === "articles" ? "secondary" : "quiet"}
            onPress={() => setTab("articles")}
          >{`Articoli (${content.articles.length})`}</Button>
          <Button
            variant={tab === "checklists" ? "secondary" : "quiet"}
            onPress={() => setTab("checklists")}
          >{`Checklist (${content.checklists.length})`}</Button>
          <Button
            onPress={() => {
              setMessage("");
              setPreview(false);
              if (tab === "articles")
                setArticle({
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
                  authorName: "Gaia Brunetti",
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
                });
              else
                setChecklist({
                  id: crypto.randomUUID(),
                  title: "",
                  description: "",
                  stage: "all",
                  status: "draft",
                  approved: false,
                  isDemo: false,
                  items: [{ id: crypto.randomUUID(), label: "" }],
                });
            }}
          >
            {tab === "articles" ? "Nuovo articolo" : "Nuova checklist"}
          </Button>
          {(tab === "articles" ? content.articles : content.checklists).map(
            (item) => (
              <View key={item.id} style={[ui.card, { gap: 10 }]}>
                <Text style={ui.heading}>{item.title}</Text>
                <Text style={ui.body}>{statusLabel(item.status)}</Text>
                <Button
                  variant="secondary"
                  onPress={() => {
                    setMessage("");
                    setPreview(false);
                    if (tab === "articles") {
                      setArticle(structuredClone(item as Article));
                      setBaseline(
                        JSON.stringify({ article: item, checklist: null }),
                      );
                    } else {
                      setChecklist(structuredClone(item as Checklist));
                      setBaseline(
                        JSON.stringify({ article: null, checklist: item }),
                      );
                    }
                  }}
                >{`Modifica ${item.title}`}</Button>
              </View>
            ),
          )}
          {(tab === "articles" ? content.articles : content.checklists)
            .length === 0 && (
            <Text style={ui.body}>
              Nessun contenuto. Inizia con una nuova bozza.
            </Text>
          )}
        </>
      ) : (
        <>
          <Button
            disabled={busy}
            variant="quiet"
            onPress={() => {
              if (
                Platform.OS === "web" &&
                !window.confirm(
                  "Tornare all’elenco? Le modifiche non salvate saranno perse.",
                )
              )
                return;
              setArticle(null);
              setChecklist(null);
              setMessage("");
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
                      style={{ width: "100%", height: 220, borderRadius: 16 }}
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
                    onChange={(value) => updateArticle({ slug: slug(value) })}
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
                        Separa i paragrafi con una riga vuota. Per un elenco usa
                        una riga per voce preceduta da •.
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
                              items: checklist.items.filter((_, j) => j !== i),
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
          <Notice>
            “Approva e pubblica” conferma la revisione professionale del
            contenuto. Per gli articoli servono autore, copertina, testo e fonti
            HTTPS. Il database verifica l’abilitazione del revisore.
          </Notice>
          <Button disabled={busy} onPress={() => void save("draft")}>
            {busy ? "Salvataggio…" : "Salva bozza"}
          </Button>
          <Button
            disabled={busy}
            variant="secondary"
            onPress={() => void save("publish")}
          >
            Approva e pubblica
          </Button>
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
