import { useEffect, useState } from "react";
import { usePathname } from "expo-router";
import { assertEditor } from "@nido/data";
import { client, useApp } from "./state";
// Membership controls discoverability only. Each screen, RPC and RLS policy
// independently enforces authorization and the required MFA assurance level.
export function useProfessionalNavigation() {
  const { email } = useApp();
  const pathname = usePathname();
  const [access, setAccess] = useState({ email: "", editor: false });
  useEffect(() => {
    let active = true;
    if (!email || !client) return;
    void (async () => {
      try {
        const { data: identity, error: identityError } =
          await client.auth.getUser();
        if (identityError || !identity.user) throw new Error();
        const { data, error } = await client.rpc("professional_access_status");
        let editor = false;
        if (!error && data && typeof data.editor === "boolean")
          editor = data.editor;
        else {
          await assertEditor(client);
          editor = true;
        }
        if (active) setAccess({ email, editor });
      } catch {
        if (active) setAccess({ email, editor: false });
      }
    })();
    return () => {
      active = false;
    };
  }, [email, pathname]);
  return Boolean(email && access.email === email && access.editor);
}
