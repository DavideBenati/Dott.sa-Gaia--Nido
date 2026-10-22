import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new ApiError(
      503,
      "Supabase non configurato o incompleto. Imposta URL e chiave pubblica nelle variabili d’ambiente e riavvia il server.",
    );
  if (
    !url.startsWith("https://") &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(url)
  )
    throw new ApiError(503, "La connessione Supabase richiede HTTPS.");
  let privileged = key.startsWith("sb_secret_");
  if (key.split(".").length === 3) {
    try {
      privileged ||=
        JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
          .role === "service_role";
    } catch {
      /* Invalid public keys fail at the verified authentication operation. */
    }
  }
  if (privileged)
    throw new ApiError(
      503,
      "Usa soltanto la chiave Supabase pubblica publishable/anon, mai una chiave privilegiata.",
    );
  const jar = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(values) {
        values.forEach(({ name, value, options }) =>
          jar.set(name, value, {
            ...options,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/",
          }),
        );
      },
    },
  });
}
export async function authorizedEditor() {
  const client = await serverClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    throw new ApiError(401, "Accedi con un account editoriale autorizzato.");
  const membership = await client.rpc("is_editor");
  if (membership.error || membership.data !== true)
    throw new ApiError(403, "Questo account non ha i permessi editoriali.");
  return { client, user };
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new ApiError(403, "Origine della richiesta non consentita.");
}
export function errorResponse(error: unknown) {
  if (error instanceof Error && !(error instanceof ApiError)) {
    if (error.message.includes("verified clinical reviewer"))
      error = new ApiError(
        403,
        "Per approvare questo contenuto serve un revisore clinico con qualifica verificata nel sistema.",
      );
    else if (error.message.includes("reviewer identity must match"))
      error = new ApiError(
        400,
        "Il nome del revisore deve corrispondere al professionista verificato associato a questo account.",
      );
    else if (error.message.includes("Publication requires"))
      error = new ApiError(
        400,
        "La pubblicazione richiede un contenuto non dimostrativo e una revisione clinica approvata.",
      );
    else if (error.message.includes("duplicate key value"))
      error = new ApiError(
        409,
        "Esiste già un contenuto con questo identificatore. Verifica titolo e categoria.",
      );
  }
  const status = error instanceof ApiError ? error.status : 500;
  return Response.json(
    {
      error:
        error instanceof ApiError
          ? error.message
          : "Operazione non riuscita. Riprova senza condividere dati personali.",
    },
    { status },
  );
}
