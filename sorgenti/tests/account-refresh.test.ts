import { afterEach, describe, expect, test, vi } from "vitest";
import {
  browserResumeSubscription,
  enqueueOwnedRefresh,
  readOwnedSnapshot,
} from "../apps/mobile/src/account-refresh";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("account refresh shares the server-first mutation queue", () => {
  test("refresh waits for a pending write and a later write uses the refreshed snapshot", async () => {
    const writeDone = deferred<void>();
    let stored = { first: false, second: false };
    let shown = { ...stored };
    const queue = {
      current: writeDone.promise.then(() => {
        stored = { ...stored, first: true };
        shown = { ...stored };
      }),
    };
    const read = vi.fn(async () => ({ ...stored }));
    const refreshed = enqueueOwnedRefresh({
      queue,
      current: () => true,
      load: read,
      apply: (value) => {
        shown = value;
      },
    });
    const laterWrite = queue.current.then(() => {
      stored = { ...stored, second: !shown.second };
      shown = { ...shown, second: stored.second };
    });
    expect(read).not.toHaveBeenCalled();
    writeDone.resolve();
    await Promise.all([refreshed, laterWrite]);
    expect(shown).toEqual({ first: true, second: true });
    expect(stored).toEqual(shown);
  });

  test("the read and apply both finish before a newly queued write", async () => {
    const snapshot = deferred<{ completed: boolean }>();
    const order: string[] = [];
    let shown = { completed: false };
    const queue = { current: Promise.resolve() };
    const refreshed = enqueueOwnedRefresh({
      queue,
      current: () => true,
      load: () => {
        order.push("read");
        return snapshot.promise;
      },
      apply: (value) => {
        shown = value;
        order.push("apply");
      },
    });
    const write = queue.current.then(() => {
      shown = { completed: !shown.completed };
      order.push("write");
    });
    await Promise.resolve();
    expect(order).toEqual(["read"]);
    snapshot.resolve({ completed: true });
    await Promise.all([refreshed, write]);
    expect(order).toEqual(["read", "apply", "write"]);
    expect(shown.completed).toBe(false);
  });

  test("a switch of account or session epoch discards an in-flight response", async () => {
    for (const change of ["owner", "epoch"] as const) {
      let owner = "first";
      let epoch = 1;
      const response = deferred<{ favorite: string }>();
      const apply = vi.fn();
      const failed = vi.fn();
      const refreshed = enqueueOwnedRefresh({
        queue: { current: Promise.resolve() },
        current: () => owner === "first" && epoch === 1,
        load: () => response.promise,
        apply,
        failed,
      });
      await Promise.resolve();
      if (change === "owner") owner = "second";
      else epoch++;
      response.resolve({ favorite: "private-first-account" });
      await refreshed;
      expect(apply).not.toHaveBeenCalled();
      expect(failed).not.toHaveBeenCalled();
    }
  });

  test("a refresh queued for the previous account does not perform a read", async () => {
    const blocked = deferred<void>();
    let owner = "first";
    const load = vi.fn(async () => "first-account-value");
    const refreshed = enqueueOwnedRefresh({
      queue: { current: blocked.promise },
      current: () => owner === "first",
      load,
      apply: vi.fn(),
    });
    owner = "second";
    blocked.resolve();
    await refreshed;
    expect(load).not.toHaveBeenCalled();
  });

  test("a network failure preserves the shown data, reports failure and allows retry", async () => {
    const queue = { current: Promise.resolve() };
    let shown = { completed: true };
    const failed = vi.fn();
    const finish = vi.fn();
    await expect(
      enqueueOwnedRefresh({
        queue,
        current: () => true,
        load: async () => {
          throw new Error("network unavailable");
        },
        apply: (value: typeof shown) => {
          shown = value;
        },
        failed,
        finish,
      }),
    ).rejects.toThrow("network unavailable");
    expect(shown).toEqual({ completed: true });
    expect(failed).toHaveBeenCalledTimes(1);
    expect(finish).toHaveBeenCalledTimes(1);
    await enqueueOwnedRefresh({
      queue,
      current: () => true,
      load: async () => ({ completed: false }),
      apply: (value) => {
        shown = value;
      },
    });
    expect(shown).toEqual({ completed: false });
  });

  test("actual auth identity is verified before and after reading the snapshot", async () => {
    const load = vi.fn(async () => ({ private: "value" }));
    await expect(
      readOwnedSnapshot("first", async () => "second", load),
    ).rejects.toThrow(/sessione è cambiata/);
    expect(load).not.toHaveBeenCalled();
    const identity = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");
    await expect(readOwnedSnapshot("first", identity, load)).rejects.toThrow(
      /sessione è cambiata/,
    );
    expect(load).toHaveBeenCalledTimes(1);
    await expect(
      readOwnedSnapshot("first", async () => "first", load),
    ).resolves.toEqual({ private: "value" });
  });
});

describe("browser return and reconnect signals", () => {
  afterEach(() => vi.useRealTimers());

  function targets() {
    const windowTarget = new EventTarget();
    const documentTarget = Object.assign(new EventTarget(), {
      visibilityState: "visible",
    });
    return { windowTarget, documentTarget };
  }

  test("focus, visible and reconnect are coalesced without polling", () => {
    vi.useFakeTimers();
    const { windowTarget, documentTarget } = targets();
    const resume = vi.fn();
    const stop = browserResumeSubscription({
      windowTarget: windowTarget as unknown as Window,
      documentTarget: documentTarget as unknown as Document,
      resume,
    });
    windowTarget.dispatchEvent(new Event("focus"));
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    windowTarget.dispatchEvent(new Event("online"));
    vi.advanceTimersByTime(180);
    expect(resume).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(600_000);
    expect(resume).toHaveBeenCalledTimes(1);
    stop();
  });

  test("background cancels pending refreshes and cleanup removes all listeners", () => {
    vi.useFakeTimers();
    const { windowTarget, documentTarget } = targets();
    const resume = vi.fn();
    const background = vi.fn();
    const stop = browserResumeSubscription({
      windowTarget: windowTarget as unknown as Window,
      documentTarget: documentTarget as unknown as Document,
      resume,
      background,
    });
    windowTarget.dispatchEvent(new Event("focus"));
    documentTarget.visibilityState = "hidden";
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    windowTarget.dispatchEvent(new Event("online"));
    vi.advanceTimersByTime(1_000);
    expect(background).toHaveBeenCalledTimes(1);
    expect(resume).not.toHaveBeenCalled();
    documentTarget.visibilityState = "visible";
    windowTarget.dispatchEvent(new Event("focus"));
    stop();
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    windowTarget.dispatchEvent(new Event("online"));
    vi.advanceTimersByTime(1_000);
    expect(resume).not.toHaveBeenCalled();
  });
});
