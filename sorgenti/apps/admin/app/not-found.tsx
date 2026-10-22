import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Pagina non trovata — Nido",
  description:
    "Questa pagina non è disponibile. Torna allo studio editoriale di Nido.",
};
export default function NotFound() {
  return (
    <main className="loading">
      <Link className="brand" href="/" aria-label="Nido, torna allo studio">
        nido<span>✳</span>
      </Link>
      <span className="eyebrow">UN PICCOLO CAMBIO DI PERCORSO</span>
      <h1>Pagina non trovata</h1>
      <p>
        Questa pagina non è disponibile. Ripartiamo dal tuo spazio editoriale.
      </p>
      <Link className="button primary" href="/">
        Torna allo studio
      </Link>
    </main>
  );
}
