import { useEffect, useState } from "react";
import { assertEditor } from "@nido/data";
import { client, useApp } from "./state";

// The database membership is authoritative; email addresses and user metadata
// never grant editorial permission. Data RPCs and RLS repeat this check.
export function useEditorAccess() {
  const { email } = useApp();
  const [access, setAccess] = useState<{
    email: string | null;
    allowed: boolean;
    checked: boolean;
  }>({ email: null, allowed: false, checked: false });
  useEffect(() => {
    let active = true;
    if (!email || !client) return;
    void assertEditor(client).then(
      () => active && setAccess({ email, allowed: true, checked: true }),
      () => active && setAccess({ email, allowed: false, checked: true }),
    );
    return () => {
      active = false;
    };
  }, [email]);
  return {
    allowed: Boolean(email && access.email === email && access.allowed),
    checking: Boolean(email && (access.email !== email || !access.checked)),
  };
}
