import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import { browserResumeSubscription } from "./account-refresh";

/** A return/reconnect signal, not polling and not an offline write queue. */
export function useResumeRefresh(
  resume: () => void,
  {
    enabled = true,
    background,
  }: { enabled?: boolean; background?: () => void } = {},
) {
  const callbacks = useRef({ resume, background });
  callbacks.current = { resume, background };
  useEffect(() => {
    if (!enabled) return;
    if (
      Platform.OS === "web" &&
      typeof window !== "undefined" &&
      typeof document !== "undefined"
    )
      return browserResumeSubscription({
        windowTarget: window,
        documentTarget: document,
        resume: () => callbacks.current.resume(),
        background: () => callbacks.current.background?.(),
      });
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active" && previous !== "active")
        callbacks.current.resume();
      if (next !== "active") callbacks.current.background?.();
      previous = next;
    });
    return () => subscription.remove();
  }, [enabled]);
}
