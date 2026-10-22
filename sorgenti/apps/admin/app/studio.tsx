"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  articles as fixtureArticles,
  categories as fixtureCategories,
  checklists as fixtureChecklists,
  disclaimer,
  validateArticle,
  type Article,
  type Category,
  type Checklist,
  type PublicationStatus,
  type Stage,
} from "@nido/core";
import {
  bodyToText,
  newArticle,
  newChecklist,
  refsToText,
  slugify,
  stageLabels,
  statusLabels,
  textToBody,
  textToRefs,
} from "../lib/editorial";

type Content = {
  articles: Article[];
  categories: Category[];
  checklists: Checklist[];
};
type View = "articles" | "checklists" | "categories" | "guide";
const STORAGE_KEY = "nido-editorial-demo-v1";
const isFixtureImage = (article: Article) =>
  article.isDemo && article.imageUrl.includes("images.unsplash.com");
const initial: Content = {
  articles: fixtureArticles,
  categories: fixtureCategories,
  checklists: fixtureChecklists,
};
function useDialog(onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const overlays = document.querySelectorAll<HTMLElement>(".overlay");
    const overlay = overlays[overlays.length - 1];
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        overlay?.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]",
        ) ?? [],
      );
    focusable()[0]?.focus();
    function keydown(event: KeyboardEvent) {
      const current = document.querySelectorAll(".overlay");
      if (current[current.length - 1] !== overlay) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const items = focusable();
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
}
function Icon({
  name,
  size = 20,
}: {
  name:
    | "leaf"
    | "book"
    | "list"
    | "grid"
    | "help"
    | "plus"
    | "search"
    | "arrow"
    | "close"
    | "check"
    | "eye";
  size?: number;
}) {
  const paths = {
    leaf: "M19 3C9 2 3 8 5 15c1 4 8 5 11 1 3-4 3-9 3-13ZM5 21 16 8M8 16l-1-5m5 1 4 1",
    book: "M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1m0-15c4-3 8-2 10-1v15c-4-2-7-1-10 1V5Z",
    list: "m3 6 1 1 2-2m-3 7 1 1 2-2m-3 7 1 1 2-2M10 6h11M10 12h11M10 18h11",
    grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
    help: "M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
    plus: "M12 5v14M5 12h14",
    search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
    arrow: "M5 12h14m-6-6 6 6-6 6",
    close: "m6 6 12 12M6 18 18 6",
    check: "m5 12 4 4L19 6",
    eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, { ...options, cache: "no-store" });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "Operazione non riuscita.");
  return value;
}
export default function Dashboard({ configured }: { configured: boolean }) {
  const [content, setContent] = useState<Content>(initial);
  const [view, setView] = useState<View>("articles");
  const [loaded, setLoaded] = useState(false);
  const [authorized, setAuthorized] = useState(!configured);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [article, setArticle] = useState<Article | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [preview, setPreview] = useState<Article | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const demo = !configured;
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (configured) {
          const data = await api("/api/editor");
          if (active) {
            setContent(data);
            setAuthorized(true);
            setEmail(data.email ?? "");
          }
        } else {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const value = JSON.parse(saved) as Content;
            if (
              !Array.isArray(value.articles) ||
              !Array.isArray(value.checklists) ||
              !Array.isArray(value.categories)
            )
              throw new Error(
                "Il salvataggio demo non è leggibile. Usa “Ripristina demo” per ricominciare.",
              );
            if (active) setContent(value);
          }
        }
      } catch (error) {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "Impossibile caricare i contenuti.",
          );
      } finally {
        if (active) setLoaded(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [configured]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const value = await api("/api/editor");
      setContent(value);
      setEmail(value.email ?? "");
      setAuthorized(true);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Accesso non riuscito.",
      );
    } finally {
      setPending(false);
    }
  }
  async function commit<T extends Article | Checklist | Category>(
    action: "article" | "checklist" | "category",
    value: T,
  ) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      const saved = demo
        ? value
        : ((
            await api("/api/editor", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action, value }),
            })
          ).value as T);
      const key =
        action === "article"
          ? "articles"
          : action === "checklist"
            ? "checklists"
            : "categories";
      const values = content[key] as T[];
      const next = {
        ...content,
        [key]: values.some((v) => v.id === saved.id)
          ? values.map((v) => (v.id === saved.id ? saved : v))
          : [saved, ...values],
      };
      if (demo) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setContent(next);
      setArticle(null);
      setChecklist(null);
      setMessage(
        demo
          ? "Salvato in questo browser. Nessun contenuto è stato pubblicato nell’app."
          : action === "article" &&
              "status" in saved &&
              saved.status === "in_review"
            ? "Contenuto salvato in revisione. Le modifiche richiedono una nuova approvazione clinica prima della pubblicazione."
            : "Contenuto salvato. Solo i contenuti pubblicati e approvati sono disponibili nell’app.",
      );
      return true;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Salvataggio non riuscito.",
      );
      return false;
    } finally {
      setPending(false);
    }
  }
  const matching = content.articles.filter(
    (item) =>
      (status === "all" || item.status === status) &&
      `${item.title} ${item.subtitle}`
        .toLocaleLowerCase("it")
        .includes(query.toLocaleLowerCase("it")),
  );
  const published = content.articles.filter(
    (item) => item.status === "published",
  ).length;
  const inReview = content.articles.filter(
    (item) => item.status === "in_review",
  ).length;
  if (!loaded)
    return (
      <main className="loading" aria-live="polite">
        <span className="brand">
          nido<span>✳</span>
        </span>
        <p>Prepariamo il tuo spazio editoriale…</p>
      </main>
    );
  if (!authorized)
    return (
      <main className="login-shell">
        <div className="login-art">
          <div className="brand">
            nido<span>✳</span>
          </div>
          <span className="eyebrow">LO STUDIO EDITORIALE</span>
          <h1>
            Le parole giuste,
            <br />
            al momento giusto.
          </h1>
          <p>
            Uno spazio curato per accompagnare ogni famiglia, insieme, passo
            dopo passo.
          </p>
          <div className="login-illustration">
            <Icon name="leaf" size={150} />
          </div>
        </div>
        <div className="login-form">
          <span className="eyebrow">BENTORNATA, BENTORNATO</span>
          <h2>Accedi al tuo studio</h2>
          <p>Riservato ai professionisti editoriali autorizzati da Nido.</p>
          {error && (
            <div role="alert" className="notice error">
              {error}
            </div>
          )}
          <form onSubmit={login}>
            <label>
              Email
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                minLength={8}
              />
            </label>
            <button className="button primary" disabled={pending}>
              {pending ? "Accesso in corso…" : "Accedi allo studio"}
              <Icon name="arrow" />
            </button>
          </form>
          <p className="small">
            L’accesso è verificato sul server. I permessi editoriali e le
            qualifiche del revisore devono essere assegnati da un amministratore
            del progetto.
          </p>
        </div>
      </main>
    );
  return (
    <div className="studio-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Nido, studio editoriale">
          nido<span>✳</span>
        </a>
        <p className="sidebar-caption">STUDIO EDITORIALE</p>
        <nav aria-label="Navigazione editoriale">
          {(
            [
              { id: "articles", icon: "book", label: "Articoli" },
              { id: "checklists", icon: "list", label: "Checklist" },
              { id: "categories", icon: "grid", label: "Categorie" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              className={`nav-link ${view === item.id ? "active" : ""}`}
              onClick={() => {
                setView(item.id);
                setMessage("");
              }}
            >
              <Icon name={item.icon} />
              {item.label}
              {item.id === "articles" && (
                <span className="nav-count">{content.articles.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Icon name="leaf" />
            <p>Ogni contenuto è un piccolo gesto di cura.</p>
          </div>
          <button
            className={`nav-link ${view === "guide" ? "active" : ""}`}
            onClick={() => setView("guide")}
          >
            <Icon name="help" />
            Guida editoriale
          </button>
          <div className="editor-profile">
            <div className="avatar">N</div>
            <div>
              <strong>
                {demo ? "Laboratorio Nido" : "Account editoriale"}
              </strong>
              <small>{demo ? "Ambiente dimostrativo" : email}</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span>
            Nido <span className="slash">/</span> Studio editoriale
          </span>
          <div className="topbar-actions">
            <span className={`mode-dot ${demo ? "demo" : ""}`}>
              {demo ? "Modalità demo" : "Account editoriale"}
            </span>
            {!demo && (
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await api("/api/session", { method: "DELETE" });
                    setAuthorized(false);
                    setContent({
                      articles: [],
                      categories: [],
                      checklists: [],
                    });
                  } catch {
                    setError("Uscita non riuscita. Riprova.");
                  }
                }}
              >
                Esci
              </button>
            )}
          </div>
        </header>
        <main className="workspace">
          {demo && (
            <div className="demo-banner">
              <span className="demo-badge">DEMO</span>
              <p>
                Uno spazio per provare. I contenuti sono esempi da revisionare,
                salvati solo in questo browser.
                <br />
                <strong>
                  Le pubblicazioni simulate non compaiono nell’app dei genitori.
                </strong>
              </p>
              <button
                className="text-button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Ripristinare tutti i contenuti dimostrativi? Le modifiche in questo browser saranno eliminate.",
                    )
                  ) {
                    localStorage.removeItem(STORAGE_KEY);
                    setContent(initial);
                    setMessage("Contenuti dimostrativi ripristinati.");
                  }
                }}
              >
                Ripristina demo
              </button>
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
              <button aria-label="Chiudi errore" onClick={() => setError("")}>
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          {message && (
            <div className="notice success" role="status">
              <Icon name="check" />
              {message}
            </div>
          )}
          <div className="page-heading">
            <div>
              <span className="eyebrow">UNO SPAZIO, TANTE STORIE</span>
              <h1>
                {view === "articles"
                  ? "Prendersi cura, con le parole."
                  : view === "checklists"
                    ? "Piccoli passi, insieme."
                    : view === "categories"
                      ? "Ogni storia ha il suo posto."
                      : "La cura prima della pubblicazione."}
              </h1>
              <p>
                {view === "articles"
                  ? "Crea contenuti utili, accoglienti e adatti a ogni fase del percorso."
                  : view === "checklists"
                    ? "Suggerimenti flessibili per alleggerire le giornate delle famiglie."
                    : view === "categories"
                      ? "Organizza la biblioteca per rendere più semplice trovare ciò che serve."
                      : "Un promemoria per scrivere con responsabilità, chiarezza e rispetto."}
              </p>
            </div>
            {view === "articles" && (
              <button
                className="button primary"
                onClick={() =>
                  setArticle(newArticle(content.categories[0], demo))
                }
              >
                <Icon name="plus" />
                Nuovo articolo
              </button>
            )}
            {view === "checklists" && (
              <button
                className="button primary"
                onClick={() => setChecklist(newChecklist(demo))}
              >
                <Icon name="plus" />
                Nuova checklist
              </button>
            )}
          </div>
          {view === "articles" && (
            <>
              <div className="metrics">
                <div>
                  <span className="metric-icon sage">
                    <Icon name="book" />
                  </span>
                  <div>
                    <strong>{content.articles.length}</strong>
                    <span>Articoli nella biblioteca</span>
                  </div>
                </div>
                <div>
                  <span className="metric-icon clay">
                    <Icon name="check" />
                  </span>
                  <div>
                    <strong>{published}</strong>
                    <span>
                      {demo
                        ? "Pubblicazioni dimostrative"
                        : "Articoli pubblicati"}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="metric-icon sand">
                    <Icon name="eye" />
                  </span>
                  <div>
                    <strong>{inReview}</strong>
                    <span>In attesa di revisione</span>
                  </div>
                </div>
              </div>
              <section className="content-panel">
                <div className="panel-heading">
                  <h2>
                    La tua biblioteca <span>{content.articles.length}</span>
                  </h2>
                  <div className="library-tools">
                    <label className="search">
                      <Icon name="search" />
                      <input
                        aria-label="Cerca articoli"
                        placeholder="Cerca un contenuto…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Filtra per stato"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="all">Tutti gli stati</option>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {matching.length === 0 ? (
                  <div className="empty">
                    <Icon name="book" size={38} />
                    <h3>Una pagina ancora da scrivere.</h3>
                    <p>
                      Nessun articolo corrisponde alla ricerca. Prova con altre
                      parole o crea un nuovo contenuto.
                    </p>
                    <button
                      className="button secondary"
                      onClick={() => {
                        setQuery("");
                        setStatus("all");
                      }}
                    >
                      Mostra tutti gli articoli
                    </button>
                  </div>
                ) : (
                  <div className="article-table">
                    <div className="table-labels">
                      <span>CONTENUTO</span>
                      <span>CATEGORIA</span>
                      <span>STATO</span>
                      <span>AZIONI</span>
                    </div>
                    {matching.map((item) => (
                      <div className="article-row" key={item.id}>
                        <button
                          className="article-title"
                          onClick={() => setArticle(item)}
                        >
                          <div
                            className="article-thumbnail"
                            style={
                              item.imageUrl && !isFixtureImage(item)
                                ? {
                                    backgroundImage: `url("${item.imageUrl.replaceAll('"', "")}")`,
                                  }
                                : undefined
                            }
                          >
                            {(!item.imageUrl || isFixtureImage(item)) && (
                              <Icon name="leaf" size={28} />
                            )}
                          </div>
                          <div>
                            <strong>{item.title}</strong>
                            <span>
                              {stageLabels[item.stage]}{" "}
                              <span className="middot">·</span>{" "}
                              {item.readingMinutes} min di lettura
                            </span>
                          </div>
                        </button>
                        <span className="category-cell">
                          {content.categories.find(
                            (c) => c.id === item.categoryId,
                          )?.name ?? "Da assegnare"}
                        </span>
                        <span className={`status-pill ${item.status}`}>
                          {statusLabels[item.status]}
                          {item.isDemo && item.status === "published"
                            ? " · demo"
                            : ""}
                        </span>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            aria-label={`Anteprima: ${item.title}`}
                            onClick={() => setPreview(item)}
                          >
                            <Icon name="eye" />
                          </button>
                          <button
                            className="edit-link"
                            onClick={() => setArticle(item)}
                          >
                            Modifica
                            <Icon name="arrow" size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="panel-footer">
                  <span>{matching.length} contenuti visualizzati</span>
                  <span>
                    Le parole contano. La revisione, anche.{" "}
                    <Icon name="leaf" size={15} />
                  </span>
                </div>
              </section>
              <div className="editorial-reminder">
                <div>
                  <span className="eyebrow">IL NOSTRO IMPEGNO</span>
                  <h2>
                    Informazioni che accompagnano.
                    <br />
                    Professionisti che si prendono cura.
                  </h2>
                  <p>
                    Prima di pubblicare, verifica fonti, linguaggio inclusivo e
                    revisione clinica. Una buona informazione lascia spazio alle
                    domande.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setView("guide")}
                  >
                    Leggi la guida editoriale
                    <Icon name="arrow" size={16} />
                  </button>
                </div>
                <div className="reminder-illustration">
                  <Icon name="leaf" size={100} />
                </div>
              </div>
            </>
          )}
          {view === "checklists" && (
            <section className="checklist-grid">
              {content.checklists.map((item) => (
                <button
                  className="checklist-card"
                  key={item.id}
                  onClick={() => setChecklist(item)}
                >
                  <div className="card-top">
                    <span className="metric-icon sage">
                      <Icon name="list" />
                    </span>
                    <span className={`status-pill ${item.status}`}>
                      {statusLabels[item.status]}
                    </span>
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.description}</p>
                  <div className="card-bottom">
                    <span>
                      {item.items.length} suggerimenti ·{" "}
                      {stageLabels[item.stage]}
                    </span>
                    <Icon name="arrow" />
                  </div>
                </button>
              ))}
              {content.checklists.length === 0 && (
                <div className="empty">
                  <h2>La prima checklist parte da qui.</h2>
                  <p>
                    Aggiungi suggerimenti adattabili alle esigenze delle
                    famiglie.
                  </p>
                </div>
              )}
            </section>
          )}
          {view === "categories" && (
            <section className="content-panel categories-panel">
              <h2>Gli argomenti della biblioteca</h2>
              <p className="muted">
                I nomi sono visibili nell’app. Le categorie già assegnate
                mantengono un identificatore stabile.
              </p>
              <div className="category-list">
                {content.categories.map((category) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    pending={pending}
                    onSave={(value) => commit("category", value)}
                  />
                ))}
              </div>
              <form
                className="new-category"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const id = slugify(newCategoryName);
                  if (id.length < 2) {
                    setError(
                      "Il nome della categoria deve contenere almeno due lettere.",
                    );
                    return;
                  }
                  if (
                    content.categories.some((category) => category.id === id)
                  ) {
                    setError(
                      "Questa categoria esiste già. Puoi modificarla nell’elenco.",
                    );
                    return;
                  }
                  const saved = await commit("category", {
                    id,
                    name: newCategoryName.trim(),
                    icon: "leaf",
                  });
                  if (saved) setNewCategoryName("");
                }}
              >
                <label>
                  Nuova categoria
                  <input
                    required
                    minLength={2}
                    maxLength={80}
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Il nome del nuovo argomento"
                  />
                </label>
                <button className="button primary" disabled={pending}>
                  <Icon name="plus" />
                  Aggiungi categoria
                </button>
              </form>
            </section>
          )}
          {view === "guide" && (
            <section className="guide-grid">
              <Guide title="Prima la revisione" number="01">
                I contenuti destinati alla pubblicazione devono essere approvati
                da un’ostetrica qualificata, con nome e data della revisione. Le
                qualifiche sono verificate fuori dall’app e assegnate nel
                sistema: un account editoriale non può attribuirsele da solo.
                Una modifica al contenuto richiede una nuova revisione.
              </Guide>
              <Guide title="Fonti chiare e verificabili" number="02">
                Collega fonti istituzionali pertinenti e controlla la data delle
                informazioni. Non inventare dati, citazioni, qualifiche o
                approvazioni. Gli esempi dimostrativi non sono materiale clinico
                approvato.
              </Guide>
              <Guide title="Un linguaggio che accoglie" number="03">
                Scrivi in modo comprensibile, inclusivo e rispettoso. Ogni
                famiglia segue un percorso diverso, anche nell’alimentazione del
                neonato. Non formulare diagnosi, terapie o rassicurazioni
                automatiche.
              </Guide>
              <Guide title="Privacy e limiti" number="04">
                Non inserire nomi di pazienti, fotografie identificabili o
                informazioni sanitarie personali. Le immagini editoriali devono
                avere diritti d’uso verificati. Le checklist sono suggerimenti
                adattabili, mai requisiti medici.
              </Guide>
              <div className="guide-disclaimer">
                <Icon name="help" />
                <div>
                  <strong>Quando chiedere aiuto</strong>
                  <p>
                    Per preoccupazioni urgenti sulla salute, invita a contattare
                    subito i servizi sanitari appropriati nel proprio Paese.
                    Nido non offre triage o assistenza medica.
                  </p>
                  <p>{disclaimer}</p>
                </div>
              </div>
            </section>
          )}
          <footer className="footer">
            <span>nido · Insieme, passo dopo passo.</span>
            <span>Studio editoriale · MVP 0.1</span>
          </footer>
        </main>
      </div>
      {article && (
        <ArticleEditor
          article={article}
          categories={content.categories}
          demo={demo}
          pending={pending}
          error={error}
          onClose={() => setArticle(null)}
          onPreview={setPreview}
          onSave={(value) => commit("article", value)}
        />
      )}
      {checklist && (
        <ChecklistEditor
          checklist={checklist}
          demo={demo}
          pending={pending}
          error={error}
          onClose={() => setChecklist(null)}
          onSave={(value) => commit("checklist", value)}
        />
      )}
      {preview && (
        <Preview
          article={preview}
          categories={content.categories}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
function Guide({
  title,
  number,
  children,
}: {
  title: string;
  number: string;
  children: React.ReactNode;
}) {
  return (
    <article className="guide-card">
      <span className="eyebrow">{number}</span>
      <h2>{title}</h2>
      <p>{children}</p>
    </article>
  );
}
function CategoryRow({
  category,
  pending,
  onSave,
}: {
  category: Category;
  pending: boolean;
  onSave: (category: Category) => Promise<boolean>;
}) {
  const [name, setName] = useState(category.name);
  return (
    <form
      className="category-row"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({ ...category, name: name.trim() });
      }}
    >
      <span className="metric-icon sage">
        <Icon name="leaf" />
      </span>
      <label className="sr-only" htmlFor={`category-${category.id}`}>
        Nome categoria {category.name}
      </label>
      <input
        id={`category-${category.id}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        minLength={2}
        maxLength={80}
      />
      <span className="category-id">{category.id}</span>
      <button
        className="button secondary"
        disabled={pending || name.trim() === category.name}
      >
        Salva
      </button>
    </form>
  );
}
function ArticleEditor({
  article,
  categories,
  demo,
  pending,
  error,
  onClose,
  onSave,
  onPreview,
}: {
  article: Article;
  categories: Category[];
  demo: boolean;
  pending: boolean;
  error: string;
  onClose: () => void;
  onSave: (article: Article) => Promise<boolean>;
  onPreview: (article: Article) => void;
}) {
  useDialog(onClose);
  const [value, setValue] = useState(article);
  const [body, setBody] = useState(bodyToText(article.sections));
  const [refs, setRefs] = useState(refsToText(article.references));
  const [issues, setIssues] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const update = <K extends keyof Article>(key: K, next: Article[K]) =>
    setValue((current) => ({
      ...current,
      [key]: next,
      ...(demo ||
      key === "approved" ||
      key === "reviewedAt" ||
      key === "reviewerName" ||
      key === "status"
        ? {}
        : {
            approved: false,
            status:
              current.status === "published" ? "in_review" : current.status,
            reviewerName: null,
            reviewedAt: null,
          }),
    }));
  const invalidateReview = () => {
    if (!demo)
      setValue((current) => ({
        ...current,
        approved: false,
        status: current.status === "published" ? "in_review" : current.status,
        reviewerName: null,
        reviewedAt: null,
      }));
  };
  const compose = (): Article => ({
    ...value,
    title: value.title.trim(),
    slug: value.slug || slugify(value.title),
    sections: textToBody(body),
    references: textToRefs(refs),
    publishedAt:
      value.status === "published"
        ? value.publishedAt || new Date().toISOString()
        : value.publishedAt,
    isDemo: demo ? true : value.isDemo,
    approved: demo ? false : value.approved,
  });
  async function submit(event: FormEvent) {
    event.preventDefault();
    const next = compose();
    const errors = [];
    if (next.title.length < 3)
      errors.push("Inserisci un titolo di almeno tre caratteri.");
    if (!next.categoryId) errors.push("Scegli una categoria.");
    if (
      next.weekFrom !== null &&
      next.weekTo !== null &&
      next.weekFrom > next.weekTo
    )
      errors.push("La settimana iniziale non può superare quella finale.");
    if (
      next.references.some((ref) => !/^https:\/\//.test(ref.url) || !ref.label)
    )
      errors.push("Ogni fonte richiede un nome e un collegamento HTTPS.");
    if (next.videoUrl && !/^https:\/\//.test(next.videoUrl))
      errors.push("Il video richiede un collegamento HTTPS.");
    if (!demo && next.status === "published")
      errors.push(...validateArticle(next));
    setIssues(errors);
    if (!errors.length) await onSave(next);
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > (demo ? 1024 * 1024 : 5 * 1024 * 1024)
    ) {
      setIssues([
        demo
          ? "Nella demo scegli JPG, PNG o WebP di massimo 1 MB."
          : "Scegli JPG, PNG o WebP di massimo 5 MB.",
      ]);
      return;
    }
    setUploading(true);
    setIssues([]);
    try {
      if (demo) {
        const url = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Immagine non leggibile."));
          reader.readAsDataURL(file);
        });
        update("imageUrl", url);
      } else {
        const form = new FormData();
        form.set("file", file);
        const result = await api("/api/upload", { method: "POST", body: form });
        update("imageUrl", result.url);
      }
    } catch (error) {
      setIssues([
        error instanceof Error ? error.message : "Caricamento non riuscito.",
      ]);
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="overlay">
      <section
        className="editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-heading"
      >
        <header className="dialog-header">
          <div>
            <span className="eyebrow">LA BIBLIOTECA NIDO</span>
            <h2 id="editor-heading">
              {article.title ? "Modifica articolo" : "Un nuovo contenuto"}
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Chiudi editor"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <form onSubmit={submit} className="editor-form">
          <div className="editor-fields">
            {demo && (
              <div className="notice demo-note">
                DEMO · La pubblicazione è una simulazione locale. Il contenuto
                rimane privo di approvazione clinica.
              </div>
            )}
            {(issues.length > 0 || error) && (
              <div className="notice error" role="alert">
                {error}
                <ul>
                  {issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            <label>
              Titolo
              <input
                value={value.title}
                onChange={(e) => update("title", e.target.value)}
                required
                minLength={3}
                maxLength={180}
                placeholder="Una domanda, un piccolo passo…"
              />
            </label>
            <label>
              Sottotitolo
              <textarea
                rows={2}
                value={value.subtitle}
                onChange={(e) => update("subtitle", e.target.value)}
                maxLength={400}
                placeholder="Introduci il tema con parole semplici e accoglienti."
              />
            </label>
            <div className="form-grid">
              <label>
                Categoria
                <select
                  value={value.categoryId}
                  onChange={(e) => update("categoryId", e.target.value)}
                  required
                >
                  <option value="">Scegli una categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fase del percorso
                <select
                  value={value.stage}
                  onChange={(e) => update("stage", e.target.value as Stage)}
                >
                  {Object.entries(stageLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-grid three">
              <label>
                Settimana iniziale (facoltativa)
                <input
                  type="number"
                  min={0}
                  max={value.stage === "pregnancy" ? 43 : undefined}
                  value={value.weekFrom ?? ""}
                  onChange={(e) =>
                    update(
                      "weekFrom",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </label>
              <label>
                Settimana finale (facoltativa)
                <input
                  type="number"
                  min={0}
                  max={value.stage === "pregnancy" ? 43 : undefined}
                  value={value.weekTo ?? ""}
                  onChange={(e) =>
                    update(
                      "weekTo",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </label>
              <label>
                Minuti di lettura
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={value.readingMinutes}
                  onChange={(e) =>
                    update("readingMinutes", Number(e.target.value))
                  }
                  required
                />
              </label>
            </div>
            <label>
              Corpo dell’articolo
              <textarea
                aria-label="Corpo dell’articolo"
                className="body-editor"
                rows={15}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  invalidateReview();
                }}
                placeholder={
                  "## Un titolo di sezione\n\nUn paragrafo chiaro e rispettoso.\n\nUn nuovo paragrafo."
                }
              />
              <small>
                Inizia ogni sezione con “## Titolo”. Separa i paragrafi con una
                riga vuota. Il testo è visualizzato come contenuto strutturato,
                senza HTML eseguibile.
              </small>
            </label>
            <fieldset>
              <legend>Immagine e video</legend>
              <label>
                URL immagine
                <input
                  value={
                    value.imageUrl.startsWith("data:") ? "" : value.imageUrl
                  }
                  onChange={(e) => update("imageUrl", e.target.value)}
                  placeholder="https://… oppure carica un’immagine"
                />
              </label>
              <label className="upload-label">
                {uploading ? "Caricamento in corso…" : "Carica immagine"}
                <input
                  aria-label="Carica immagine"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={(e) => {
                    void upload(e.target.files?.[0]);
                  }}
                />
                <small>
                  {demo
                    ? "Solo in questo browser · massimo 1 MB"
                    : "Archivio editoriale privato · massimo 5 MB"}
                  . Usa immagini con diritti verificati e senza dati di
                  pazienti.
                </small>
              </label>
              {value.imageUrl && (
                <div className="image-selected">
                  <Icon name="check" />
                  Immagine selezionata
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => update("imageUrl", "")}
                  >
                    Rimuovi
                  </button>
                </div>
              )}
              <label>
                Video (collegamento facoltativo)
                <input
                  type="url"
                  value={value.videoUrl ?? ""}
                  onChange={(e) => update("videoUrl", e.target.value || null)}
                  placeholder="https://…"
                />
              </label>
            </fieldset>
            <fieldset>
              <legend>Autore e fonti</legend>
              <div className="form-grid">
                <label>
                  Autore
                  <input
                    value={value.authorName}
                    onChange={(e) => update("authorName", e.target.value)}
                    maxLength={160}
                  />
                </label>
                <label>
                  Ruolo professionale
                  <input
                    value={value.authorRole}
                    onChange={(e) => update("authorRole", e.target.value)}
                    maxLength={160}
                  />
                </label>
              </div>
              <label>
                Fonti e riferimenti
                <textarea
                  aria-label="Fonti e riferimenti"
                  rows={4}
                  value={refs}
                  onChange={(e) => {
                    setRefs(e.target.value);
                    invalidateReview();
                  }}
                  placeholder={
                    "Nome della fonte | https://www.sito-istituzionale.it/pagina\nUna fonte per riga"
                  }
                />
                <small>
                  Una fonte per riga: nome | collegamento HTTPS. Verifica che
                  ogni fonte sia pertinente al testo.
                </small>
              </label>
            </fieldset>
            <fieldset>
              <legend>Revisione e pubblicazione</legend>
              <p className="small">
                In produzione l’approvazione richiede un revisore con qualifica
                verificata e abilitata nel database. Non basta selezionare
                questa casella.
              </p>
              <div className="form-grid">
                <label>
                  Nome del revisore clinico
                  <input
                    value={value.reviewerName ?? ""}
                    disabled={demo}
                    onChange={(e) =>
                      update("reviewerName", e.target.value || null)
                    }
                  />
                </label>
                <label>
                  Data dell’ultima revisione
                  <input
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={value.reviewedAt?.slice(0, 10) ?? ""}
                    disabled={demo}
                    onChange={(e) =>
                      update("reviewedAt", e.target.value || null)
                    }
                  />
                </label>
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={value.approved}
                  disabled={demo}
                  onChange={(e) => update("approved", e.target.checked)}
                />
                Confermo la revisione clinica e l’approvazione alla
                pubblicazione.
              </label>
              <label>
                Stato editoriale
                <select
                  value={value.status}
                  onChange={(e) =>
                    update("status", e.target.value as PublicationStatus)
                  }
                >
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                      {demo && key === "published" ? " · simulazione demo" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          </div>
          <footer className="dialog-footer">
            <button
              type="button"
              className="button secondary"
              onClick={() => onPreview(compose())}
            >
              <Icon name="eye" />
              Anteprima
            </button>
            <button className="button primary" disabled={pending || uploading}>
              {pending ? "Salvataggio…" : "Salva articolo"}
              <Icon name="check" />
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
function ChecklistEditor({
  checklist,
  demo,
  pending,
  error,
  onClose,
  onSave,
}: {
  checklist: Checklist;
  demo: boolean;
  pending: boolean;
  error: string;
  onClose: () => void;
  onSave: (checklist: Checklist) => Promise<boolean>;
}) {
  useDialog(onClose);
  const [value, setValue] = useState(checklist);
  const [items, setItems] = useState(
    checklist.items.map((item) => item.label).join("\n"),
  );
  const [issue, setIssue] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    const labels = items
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!labels.length) {
      setIssue("Aggiungi almeno un suggerimento.");
      return;
    }
    if (new Set(labels).size !== labels.length) {
      setIssue("Ogni suggerimento deve essere distinto.");
      return;
    }
    const next = {
      ...value,
      isDemo: demo ? true : value.isDemo,
      approved: demo ? false : value.approved,
      items: labels.map((label) => {
        const existing = checklist.items.find((item) => item.label === label);
        return existing
          ? { ...existing, label }
          : { id: crypto.randomUUID(), label };
      }),
    };
    await onSave(next);
  }
  return (
    <div className="overlay">
      <section
        className="editor-dialog compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checklist-heading"
      >
        <header className="dialog-header">
          <div>
            <span className="eyebrow">PICCOLI PASSI CONCRETI</span>
            <h2 id="checklist-heading">
              {checklist.title ? "Modifica checklist" : "Nuova checklist"}
            </h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Chiudi checklist"
          >
            <Icon name="close" />
          </button>
        </header>
        <form onSubmit={submit}>
          <div className="editor-fields">
            {demo && (
              <div className="notice demo-note">
                Esempio locale. Le checklist sono suggerimenti adattabili, non
                requisiti medici.
              </div>
            )}
            {(error || issue) && (
              <div className="notice error" role="alert">
                {error || issue}
              </div>
            )}
            <label>
              Titolo checklist
              <input
                value={value.title}
                onChange={(e) =>
                  setValue({ ...value, title: e.target.value, approved: false })
                }
                minLength={3}
                maxLength={160}
                required
              />
            </label>
            <label>
              Descrizione
              <textarea
                value={value.description}
                onChange={(e) =>
                  setValue({
                    ...value,
                    description: e.target.value,
                    approved: false,
                  })
                }
                rows={3}
                required
              />
            </label>
            <label>
              Fase della checklist
              <select
                value={value.stage}
                onChange={(e) =>
                  setValue({
                    ...value,
                    stage: e.target.value as Stage,
                    approved: false,
                  })
                }
              >
                {Object.entries(stageLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Suggerimenti
              <textarea
                aria-label="Suggerimenti"
                rows={9}
                value={items}
                onChange={(e) => {
                  setItems(e.target.value);
                  setValue({ ...value, approved: false });
                }}
                placeholder="Un suggerimento per riga"
                required
              />
              <small>
                Una voce per riga. Mantieni le indicazioni flessibili e non
                prescrittive.
              </small>
            </label>
            <label>
              Stato della checklist
              <select
                value={value.status}
                onChange={(e) =>
                  setValue({
                    ...value,
                    status: e.target.value as PublicationStatus,
                  })
                }
              >
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={value.approved}
                disabled={demo}
                onChange={(e) =>
                  setValue({ ...value, approved: e.target.checked })
                }
              />
              Confermo la revisione. In produzione è richiesta una qualifica
              verificata nel sistema.
            </label>
          </div>
          <footer className="dialog-footer">
            <button
              className="button secondary"
              type="button"
              onClick={onClose}
            >
              Annulla
            </button>
            <button className="button primary" disabled={pending}>
              {pending ? "Salvataggio…" : "Salva checklist"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
function Preview({
  article,
  categories,
  onClose,
}: {
  article: Article;
  categories: Category[];
  onClose: () => void;
}) {
  useDialog(onClose);
  return (
    <div className="overlay preview-overlay">
      <section
        className="preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-heading"
      >
        <header className="preview-header">
          <span className="eyebrow">
            ANTEPRIMA · {statusLabels[article.status].toUpperCase()}
          </span>
          <button
            className="icon-button"
            aria-label="Chiudi anteprima"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        {article.imageUrl && (
          <div
            className="preview-hero"
            style={
              isFixtureImage(article)
                ? undefined
                : {
                    backgroundImage: `url("${article.imageUrl.replaceAll('"', "")}")`,
                  }
            }
            role="img"
            aria-label={
              isFixtureImage(article)
                ? "Illustrazione dimostrativa: un germoglio"
                : "Immagine editoriale"
            }
          >
            {isFixtureImage(article) && <Icon name="leaf" size={110} />}
          </div>
        )}
        <article className="preview-body">
          <span className="category-tag">
            {categories.find((c) => c.id === article.categoryId)?.name ??
              "Categoria da assegnare"}
          </span>
          <h1 id="preview-heading">
            {article.title || "Il titolo del tuo articolo"}
          </h1>
          <p className="subtitle">{article.subtitle}</p>
          <div className="author-line">
            <span className="avatar">N</span>
            <div>
              <strong>{article.authorName || "Autore da indicare"}</strong>
              <small>
                {article.authorRole} · {article.readingMinutes} min di lettura
              </small>
            </div>
          </div>
          {(article.isDemo || !article.approved) && (
            <div className="notice demo-note">
              {article.isDemo
                ? "CONTENUTO DIMOSTRATIVO"
                : "CONTENUTO NON APPROVATO"}{" "}
              · Da sottoporre a revisione professionale. Questa anteprima non è
              una pubblicazione.
            </div>
          )}
          {article.sections.map((section, i) => (
            <section key={i}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((p, index) => (
                <p key={index}>{p}</p>
              ))}
            </section>
          ))}
          {article.reviewedAt && (
            <p className="small">
              Revisione: {article.reviewerName} ·{" "}
              {new Date(article.reviewedAt).toLocaleDateString("it-IT")}
            </p>
          )}
          {article.references.length > 0 && (
            <section>
              <h2>Fonti e approfondimenti</h2>
              <ul>
                {article.references.map((ref, i) => (
                  <li key={i}>
                    {/^https:\/\//.test(ref.url) ? (
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {ref.label || ref.url}
                      </a>
                    ) : (
                      <span>{ref.label} · collegamento da verificare</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {article.videoUrl && /^https:\/\//.test(article.videoUrl) && (
            <a
              href={article.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Guarda il video →
            </a>
          )}
          <div className="preview-disclaimer">{disclaimer}</div>
        </article>
      </section>
    </div>
  );
}
