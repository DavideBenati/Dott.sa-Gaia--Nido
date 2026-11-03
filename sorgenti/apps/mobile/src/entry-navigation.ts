import { hasCompletedProfileType, type Preferences } from "@nido/core";

type AccountReturnTarget =
  "project" | "documents" | "video_calls" | `video_calls:${string}`;
type Entry = { email: string; returnTo: AccountReturnTarget };
const STORAGE_KEY = "maia:account-entry:v2";
const videoCallTarget =
  /^video_calls:([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;

// An invitation UUID carries navigation only: opening it still requires the
// recipient's authenticated account. Never accept a caller-supplied URL.
export function accountReturnTarget(value: unknown): AccountReturnTarget {
  if (typeof value === "string" && videoCallTarget.test(value))
    return value.toLowerCase() as `video_calls:${string}`;
  return value === "documents" || value === "video_calls" ? value : "project";
}

export function videoCallReturnPath(
  value: unknown,
): "/videochiamate" | `/videochiamate?invito=${string}` | null {
  const target = accountReturnTarget(value);
  return target === "video_calls"
    ? "/videochiamate"
    : target.startsWith("video_calls:")
      ? `/videochiamate?invito=${target.slice("video_calls:".length)}`
      : null;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function readEntry(): Entry | null {
  try {
    const stored = storage()?.getItem(STORAGE_KEY);
    if (stored) {
      const value: unknown = JSON.parse(stored);
      if (
        value &&
        typeof value === "object" &&
        "email" in value &&
        typeof value.email === "string" &&
        "returnTo" in value &&
        accountReturnTarget(value.returnTo) === value.returnTo
      )
        return {
          email: value.email,
          returnTo: accountReturnTarget(value.returnTo),
        };
    }
  } catch {
    // Navigation still works when browser storage is unavailable.
  }
  return null;
}

let pending = readEntry();

/** Only a navigation intention: no journey, dates, consent or clinical data. */
export function prepareAccountEntry(
  email: string,
  returnTo: unknown = "project",
) {
  pending = {
    email: email.trim().toLowerCase(),
    returnTo: accountReturnTarget(returnTo),
  };
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // The authenticated /account route also resumes onboarding without storage.
  }
}

export function cancelAccountEntry() {
  pending = null;
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Memory is already cleared.
  }
}

export function consumeAccountEntry(email: string): Entry | null {
  const entry = pending;
  cancelAccountEntry();
  return entry?.email === email.trim().toLowerCase() ? entry : null;
}

/** Called after this account's preferences have loaded; never changes them. */
export function accountEntryDestination({
  preferences,
  pathname,
  passwordRecovery,
  hasEntry,
  returnTo,
}: {
  preferences: Preferences;
  pathname: string;
  passwordRecovery: boolean;
  hasEntry: boolean;
  returnTo?: unknown;
}):
  | "/welcome?onboarding=1&returnTo=project"
  | "/welcome?onboarding=1&returnTo=documents"
  | "/welcome?onboarding=1&returnTo=video_calls"
  | `/welcome?onboarding=1&returnTo=video_calls:${string}`
  | "/gaia?start=1"
  | "/miei-documenti"
  | "/videochiamate"
  | `/videochiamate?invito=${string}`
  | null {
  if (passwordRecovery) return null;
  const accountRoute = pathname === "/account" || pathname === "/";
  if (!hasEntry && !accountRoute) return null;
  const target = accountReturnTarget(returnTo);
  if (!hasCompletedProfileType(preferences))
    return `/welcome?onboarding=1&returnTo=${target}`;
  return target === "documents"
    ? "/miei-documenti"
    : (videoCallReturnPath(target) ?? "/gaia?start=1");
}
