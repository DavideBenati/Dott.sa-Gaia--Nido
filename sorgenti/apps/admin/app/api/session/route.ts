import {
  ApiError,
  authorizedEditor,
  errorResponse,
  sameOrigin,
  serverClient,
} from "../../../lib/server";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = await request.json();
    if (typeof body.email !== "string" || typeof body.password !== "string")
      throw new ApiError(400, "Inserisci email e password.");
    const client = await serverClient();
    const { error } = await client.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });
    if (error)
      throw new ApiError(401, "Accesso non riuscito. Verifica le credenziali.");
    try {
      await authorizedEditor();
    } catch (error) {
      await client.auth.signOut();
      throw error;
    }
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request) {
  try {
    sameOrigin(request);
    const client = await serverClient();
    await client.auth.signOut();
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
