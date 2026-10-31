export const UPDATE_ACTIVATION_TIMEOUT_MS = 20_000;

/** A late worker activation must not reload a page after its request expired. */
export function createUpdateWatchdog(
  expired: () => void,
  delay = UPDATE_ACTIVATION_TIMEOUT_MS,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending = false;
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    pending = false;
  };
  return {
    start() {
      cancel();
      pending = true;
      timer = setTimeout(() => {
        cancel();
        expired();
      }, delay);
    },
    complete() {
      const requested = pending;
      cancel();
      return requested;
    },
    cancel,
  };
}
