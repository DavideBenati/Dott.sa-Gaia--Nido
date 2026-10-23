import { useEffect, useRef } from "react";
import { Platform } from "react-native";
// RN Modal handles native accessibility. The web version additionally traps
// keyboard focus, supports Escape and returns focus to the triggering control.
export function useDialogFocus(open: boolean, id: string, onClose: () => void) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const previous = document.activeElement;
    let frame = 0;
    let active = true;
    const controls = () =>
      Array.from(
        document
          .getElementById(id)
          ?.querySelectorAll<HTMLElement>(
            'button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
          ) ?? [],
      ).filter(
        (el) =>
          el.getClientRects().length > 0 &&
          !el.hasAttribute("disabled") &&
          el.getAttribute("aria-disabled") !== "true",
      );
    function initial() {
      if (!active) return;
      const items = controls();
      if (items.length) items[0].focus();
      else frame = requestAnimationFrame(initial);
    }
    frame = requestAnimationFrame(initial);
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = controls();
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0],
        last = items[items.length - 1];
      if (
        e.shiftKey &&
        (!items.includes(document.activeElement as HTMLElement) ||
          document.activeElement === first)
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (!items.includes(document.activeElement as HTMLElement) ||
          document.activeElement === last)
      ) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", key, true);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", key, true);
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, [open, id]);
}
