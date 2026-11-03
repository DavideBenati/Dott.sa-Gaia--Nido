const uuid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export function invitationId(value: unknown): string | null {
  return typeof value === "string" && uuid.test(value)
    ? value.toLowerCase()
    : null;
}

/** The link identifies an invitation; it never grants access without sign-in. */
export function callInvitationLink(id: string): string {
  const clean = invitationId(id);
  if (!clean) throw new Error("Invito non valido.");
  return `https://metimaia.com/videochiamate?invito=${clean}`;
}

/** Preparing a random URL does not provision a room or start a meeting. */
export function prepareHostpointLink(
  random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer> = (
    bytes,
  ) => globalThis.crypto.getRandomValues(bytes),
): string {
  const bytes = random(new Uint8Array(16));
  if (bytes.length !== 16)
    throw new Error("Non è stato possibile preparare il link.");
  const token = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `https://meet.hostpoint.ch/maia-${token}`;
}
