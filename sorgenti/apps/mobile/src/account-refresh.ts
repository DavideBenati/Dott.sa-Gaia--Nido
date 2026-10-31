export interface RefreshQueue {
  current: Promise<void>;
}

export async function readOwnedSnapshot<T>(
  owner: string,
  identity: () => Promise<string | null>,
  load: () => Promise<T>,
): Promise<T> {
  if ((await identity()) !== owner)
    throw new Error("La sessione è cambiata. Accedi nuovamente.");
  const value = await load();
  if ((await identity()) !== owner)
    throw new Error("La sessione è cambiata. Accedi nuovamente.");
  return value;
}

/** A refresh occupies the same queue as writes, including the final apply. */
export function enqueueOwnedRefresh<T>({
  queue,
  current,
  load,
  apply,
  start,
  failed,
  finish,
}: {
  queue: RefreshQueue;
  current: () => boolean;
  load: () => Promise<T>;
  apply: (value: T) => void;
  start?: () => void;
  failed?: (error: unknown) => void;
  finish?: () => void;
}): Promise<void> {
  const job = queue.current.then(async () => {
    // A queued request belongs to the account that requested it, never to
    // whichever account happens to be signed in when the queue drains.
    if (!current()) return;
    start?.();
    try {
      const value = await load();
      if (current()) apply(value);
    } catch (error) {
      if (current()) failed?.(error);
      throw error;
    } finally {
      if (current()) finish?.();
    }
  });
  // Failed reads do not poison later writes or an explicit retry.
  queue.current = job.then(
    () => {},
    () => {},
  );
  return job;
}

export function browserResumeSubscription({
  windowTarget,
  documentTarget,
  resume,
  background,
  delay = 180,
}: {
  windowTarget: Pick<Window, "addEventListener" | "removeEventListener">;
  documentTarget: Pick<
    Document,
    "addEventListener" | "removeEventListener" | "visibilityState"
  >;
  resume: () => void;
  background?: () => void;
  delay?: number;
}) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let alive = true;
  const schedule = () => {
    if (documentTarget.visibilityState !== "visible") return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (alive && documentTarget.visibilityState === "visible") resume();
    }, delay);
  };
  const visibility = () => {
    if (documentTarget.visibilityState === "visible") schedule();
    else {
      clearTimeout(timer);
      background?.();
    }
  };
  windowTarget.addEventListener("focus", schedule);
  windowTarget.addEventListener("online", schedule);
  documentTarget.addEventListener("visibilitychange", visibility);
  return () => {
    alive = false;
    clearTimeout(timer);
    windowTarget.removeEventListener("focus", schedule);
    windowTarget.removeEventListener("online", schedule);
    documentTarget.removeEventListener("visibilitychange", visibility);
  };
}
