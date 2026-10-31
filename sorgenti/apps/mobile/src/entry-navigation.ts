import { hasCompletedProfileType, type Preferences } from "@nido/core";

type AccountReturnTarget = "project" | "documents";
type Entry = { email: string; returnTo: AccountReturnTarget };
const STORAGE_KEY = "maia:account-entry:v2";

// Accept a destination token, never a caller-supplied URL or document identity.
export function accountReturnTarget(value: unknown): AccountReturnTarget {
  return value === "documents" ? "documents" : "project";
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
        (value.returnTo === "project" || value.returnTo === "documents")
      )
        return { email: value.email, returnTo: value.returnTo };
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
  | "/gaia?start=1"
  | "/miei-documenti"
  | null {
  if (passwordRecovery) return null;
  const accountRoute = pathname === "/account" || pathname === "/";
  if (!hasEntry && !accountRoute) return null;
  const documents = accountReturnTarget(returnTo) === "documents";
  return hasCompletedProfileType(preferences)
    ? documents
      ? "/miei-documenti"
      : "/gaia?start=1"
    : documents
      ? "/welcome?onboarding=1&returnTo=documents"
      : "/welcome?onboarding=1&returnTo=project";
}
