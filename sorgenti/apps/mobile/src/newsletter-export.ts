import { Platform } from "react-native";
import { client } from "./state";

// The RPC exposes confirmed subscribers only to an authorized editor.
export async function exportConfirmedSubscribers(): Promise<number> {
  if (!client || Platform.OS !== "web")
    throw new Error("L’esportazione CSV è disponibile dal sito web.");
  const { data: identity, error: identityError } = await client.auth.getUser();
  if (identityError || !identity.user)
    throw new Error(
      "Accedi con l’account professionale per esportare gli iscritti.",
    );
  const rows: {
    email: string;
    confirmed_at: string;
    consent_version: string;
  }[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await client
      .rpc("newsletter_editor_list")
      .range(start, start + 499);
    if (error || !Array.isArray(data))
      throw new Error(
        "Elenco non disponibile. Verifica accesso e secondo fattore, completa la sincronizzazione e riprova.",
      );
    rows.push(...data);
    if (data.length < 500) break;
  }
  if (!rows.length) return 0;
  const { data: current } = await client.auth.getUser();
  if (current.user?.id !== identity.user.id)
    throw new Error(
      "La sessione è cambiata. Accedi di nuovo prima di esportare.",
    );
  const cell = (value: string) =>
    '"' +
    String(value)
      .replace(/^[\s=+@-]/, "'$&")
      .replace(/"/g, '""') +
    '"';
  const csv = [
    "email,confirmed_at,consent_version",
    ...rows.map((row) =>
      [row.email, row.confirmed_at, row.consent_version].map(cell).join(","),
    ),
  ].join("\r\n");
  const href = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = href;
  link.download = "metimaia-newsletter-confermati.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  return rows.length;
}
