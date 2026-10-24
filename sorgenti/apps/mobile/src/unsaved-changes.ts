import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import { useIsFocused, usePreventRemove } from "expo-router";

const warning =
  "Hai modifiche non salvate. Vuoi lasciare questa pagina senza salvarle?";
const pending = new Map<symbol, () => boolean>();
let approvedUntil = 0;

function ask(message = warning) {
  return Platform.OS !== "web" || window.confirm(message);
}

/** Shared by links, tabs and programmatic navigation, only for the active page. */
export function confirmPendingNavigation(message = warning) {
  if (Date.now() < approvedUntil) return true;
  if (![...pending.values()].some((isDirty) => isDirty())) return true;
  if (!ask(message)) return false;
  // React Navigation can emit beforeRemove after a link/tab already confirmed.
  // This short allowance prevents asking twice for the same navigation.
  approvedUntil = Date.now() + 500;
  return true;
}

export function guardedNavigation(action: () => void, message = warning) {
  if (confirmPendingNavigation(message)) action();
}

export function useUnsavedChanges(dirty: boolean) {
  const focused = useIsFocused();
  const [discarded, setDiscarded] = useState(false);
  const current = useRef({ dirty, focused });
  current.current = { dirty, focused };
  const id = useRef(Symbol("unsaved-changes"));
  useEffect(() => {
    const key = id.current;
    pending.set(key, () => current.current.dirty && current.current.focused);
    return () => {
      pending.delete(key);
    };
  }, []);

  useEffect(() => {
    // Returning to a retained tab must protect the still-unsaved form again.
    approvedUntil = 0;
    if (!dirty || focused) setDiscarded(false);
  }, [dirty, focused]);
  usePreventRemove(dirty && focused && !discarded, ({ repeat }) => {
    if (Platform.OS === "web") {
      if (confirmPendingNavigation()) {
        setDiscarded(true);
        repeat();
      }
    } else {
      Alert.alert("Modifiche non salvate", warning, [
        { text: "Resta", style: "cancel" },
        {
          text: "Scarta ed esci",
          style: "destructive",
          onPress: () => {
            setDiscarded(true);
            repeat();
          },
        },
      ]);
    }
  });

  const confirmDiscard = useCallback((message = warning) => {
    if (!current.current.dirty) return true;
    return ask(message);
  }, []);
  const allowNavigation = useCallback(
    (action: () => void, message = warning) =>
      guardedNavigation(action, message),
    [],
  );
  return { confirmDiscard, allowNavigation };
}

export function UnsavedNavigationGuard() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unload = (event: BeforeUnloadEvent) => {
      if (Date.now() < approvedUntil) return;
      if (![...pending.values()].some((isDirty) => isDirty())) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const link = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        !(event.target instanceof Element)
      )
        return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        anchor.target === "_blank"
      )
        return;
      const destination = new URL(anchor.href, window.location.href);
      if (!["http:", "https:"].includes(destination.protocol)) return;
      if (destination.href === window.location.href) return;
      if (!confirmPendingNavigation()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", link, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", link, true);
    };
  }, []);
  return null;
}
