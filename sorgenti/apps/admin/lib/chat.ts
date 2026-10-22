import { ApiError, serverClient } from "./server";
export async function authorizedChat() {
  const client = await serverClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user)
    throw new ApiError(401, "Accedi con l’account della professionista.");
  const membership = await client.rpc("is_chat_staff");
  if (membership.error || membership.data !== true)
    throw new ApiError(
      403,
      "Questo account non è autorizzato alle conversazioni private.",
    );
  return { client, user: data.user };
}
