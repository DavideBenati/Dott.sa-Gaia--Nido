export type EntryJourney = "pregnancy" | "partner" | "postpartum" | "exploring";
type Entry = { email: string | null; journey?: EntryJourney };
const signupCallback =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.hash.slice(1)).get("type") === "signup";
let pending: Entry | null = signupCallback ? { email: null } : null;
export function prepareAccountEntry(email: string, journey?: string) {
  pending = {
    email: email.trim().toLowerCase(),
    journey: ["pregnancy", "partner", "postpartum", "exploring"].includes(
      journey ?? "",
    )
      ? (journey as EntryJourney)
      : undefined,
  };
}
export function cancelAccountEntry() {
  pending = null;
}
export function consumeAccountEntry(email: string): Entry | null {
  if (!pending || (pending.email && pending.email !== email.toLowerCase()))
    return null;
  const result = pending;
  pending = null;
  return result;
}
