"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { CareMessage } from "@nido/data";
type Conversation = { user_id: string; created_at: string };
async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Operazione non riuscita.");
  return data;
}
function Thread({ id }: { id: string }) {
  const [messages, setMessages] = useState<CareMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const data = await api(
          `/api/messages?conversation=${encodeURIComponent(id)}`,
        );
        if (alive) {
          setMessages(data.messages);
          setError("");
        }
      } catch {
        if (alive)
          setError(
            "Conversazione non disponibile. Verifica la sessione o ricarica la pagina.",
          );
      } finally {
        pending = false;
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id]);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/messages", {
        method: "POST",
        body: JSON.stringify({ conversation: id, body: text }),
      });
      setText("");
      try {
        const data = await api(
          `/api/messages?conversation=${encodeURIComponent(id)}`,
        );
        setMessages(data.messages);
      } catch {
        setError("Risposta inviata. Ricarica per aggiornare la conversazione.");
      }
    } catch {
      setError(
        "Invio non riuscito: il testo è ancora qui. Verifica la connessione prima di riprovare.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="care-thread">
      <h2>Conversazione privata</h2>
      <p className="care-reference">Riferimento: {id}</p>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {messages.length === 100 && <p>Ultimi 100 messaggi.</p>}
      <div className="care-history">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`care-bubble ${message.sender_id === id ? "patient" : "staff"}`}
          >
            <strong>
              {message.sender_id === id ? "Utente" : "Professionista"}
            </strong>
            <p>{message.body}</p>
            <time dateTime={message.created_at}>
              {new Date(message.created_at).toLocaleString("it-IT")}
            </time>
          </article>
        ))}
      </div>
      <form onSubmit={send}>
        <label htmlFor="care-reply">Rispondi</label>
        <textarea
          id="care-reply"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={4000}
          required
          disabled={busy}
          rows={4}
        />
        <button className="button" disabled={busy || !text.trim()}>
          {busy ? "Invio…" : "Invia risposta"}
        </button>
      </form>
    </section>
  );
}
export default function Inbox({ configured }: { configured: boolean }) {
  const [authorized, setAuthorized] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (!configured) return;
    let alive = true;
    async function refresh() {
      try {
        const data = await api(`/api/messages?offset=${offset}`);
        if (alive) {
          setConversations(data.conversations);
          setAuthorized(true);
        }
      } catch {
        if (alive) {
          setAuthorized(false);
          setConversations([]);
          setSelected(null);
        }
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [configured, offset]);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await api("/api/messages/session", {
        method: "POST",
        body: JSON.stringify({
          email: values.get("email"),
          password: values.get("password"),
        }),
      });
      form.reset();
      const data = await api("/api/messages");
      setConversations(data.conversations);
      setAuthorized(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Accesso non riuscito.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="care-shell">
      <a href="/">MAIA / Studio</a>
      <h1>Messaggi privati</h1>
      <p>
        Casella riservata alla professionista abilitata. L’accesso editoriale
        non concede accesso alle chat.
      </p>
      {!configured ? (
        <div className="notice">
          DEMO MODE · Casella non attiva. Occorre configurare Supabase,
          applicare la migrazione chat e abilitare l’account della Dott.ssa
          Brunetti. Nessun messaggio reale viene ricevuto.
        </div>
      ) : !authorized ? (
        <form className="care-login" onSubmit={login}>
          <h2>Accedi alla casella</h2>
          {error && <p role="alert">{error}</p>}
          <label>
            Email
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="button" disabled={busy}>
            {busy ? "Accesso…" : "Accedi"}
          </button>
        </form>
      ) : (
        <>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void api("/api/messages/session", { method: "DELETE" })
                .then(() => {
                  setAuthorized(false);
                  setSelected(null);
                  setConversations([]);
                })
                .catch(() => setError("Uscita non riuscita. Riprova."))
                .finally(() => setBusy(false));
            }}
          >
            Esci dalla casella
          </button>
          {error && <p role="alert">{error}</p>}
          <div className="care-columns">
            <nav aria-label="Conversazioni private">
              {conversations.length === 0 && (
                <p>Nessuna conversazione in questa pagina.</p>
              )}
              {conversations.map((c) => (
                <button
                  key={c.user_id}
                  className="care-conversation"
                  aria-pressed={selected === c.user_id}
                  onClick={() => setSelected(c.user_id)}
                >
                  Conversazione {c.user_id.slice(0, 8)}
                  <small>
                    {new Date(c.created_at).toLocaleDateString("it-IT")}
                  </small>
                </button>
              ))}
              <div className="care-pages">
                <button
                  disabled={offset === 0}
                  onClick={() => {
                    setSelected(null);
                    setOffset(Math.max(0, offset - 50));
                  }}
                >
                  Precedenti
                </button>
                <button
                  disabled={conversations.length < 50}
                  onClick={() => {
                    setSelected(null);
                    setOffset(offset + 50);
                  }}
                >
                  Successive
                </button>
              </div>
            </nav>
            {selected ? (
              <Thread key={selected} id={selected} />
            ) : (
              <p>Seleziona una conversazione per leggere e rispondere.</p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
