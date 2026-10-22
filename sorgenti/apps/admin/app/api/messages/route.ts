import { loadCareMessages, sendCareMessage } from "@nido/data";
import { authorizedChat } from "../../../lib/chat";
import { ApiError, errorResponse, sameOrigin } from "../../../lib/server";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(request: Request) {
  try {
    const { client } = await authorizedChat();
    const id = new URL(request.url).searchParams.get("conversation");
    if (id) {
      if (!uuid.test(id)) throw new ApiError(400, "Conversazione non valida.");
      return Response.json(
        { messages: await loadCareMessages(client, id) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const offset = Number(new URL(request.url).searchParams.get("offset") ?? 0);
    if (!Number.isInteger(offset) || offset < 0)
      throw new ApiError(400, "Pagina non valida.");
    const { data, error } = await client
      .from("care_conversations")
      .select("user_id,created_at")
      .order("created_at", { ascending: false })
      .order("user_id")
      .range(offset, offset + 49);
    if (error) throw error;
    return Response.json(
      { conversations: data ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { client } = await authorizedChat();
    const body = await request.json();
    if (
      typeof body.conversation !== "string" ||
      !uuid.test(body.conversation) ||
      typeof body.body !== "string" ||
      !body.body.trim() ||
      body.body.trim().length > 4000
    )
      throw new ApiError(
        400,
        "Inserisci conversazione e messaggio validi (massimo 4000 caratteri).",
      );
    await sendCareMessage(client, body.body, body.conversation);
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
