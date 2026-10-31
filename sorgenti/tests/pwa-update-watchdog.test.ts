import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createUpdateWatchdog,
  UPDATE_ACTIVATION_TIMEOUT_MS,
} from "../apps/mobile/src/pwa-update-watchdog";

afterEach(() => vi.useRealTimers());

describe("bounded service worker activation", () => {
  it("expires an unacknowledged request and rejects a late activation", () => {
    vi.useFakeTimers();
    const expired = vi.fn();
    const request = createUpdateWatchdog(expired);
    request.start();
    vi.advanceTimersByTime(UPDATE_ACTIVATION_TIMEOUT_MS - 1);
    expect(expired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expired).toHaveBeenCalledOnce();
    expect(request.complete()).toBe(false);
    vi.advanceTimersByTime(UPDATE_ACTIVATION_TIMEOUT_MS);
    expect(expired).toHaveBeenCalledOnce();
  });

  it("accepts an activation only once and removes its timeout", () => {
    vi.useFakeTimers();
    const expired = vi.fn();
    const request = createUpdateWatchdog(expired);
    request.start();
    vi.advanceTimersByTime(1000);
    expect(request.complete()).toBe(true);
    expect(request.complete()).toBe(false);
    vi.advanceTimersByTime(UPDATE_ACTIVATION_TIMEOUT_MS);
    expect(expired).not.toHaveBeenCalled();
  });

  it("cancels a request on unmount or worker failure", () => {
    vi.useFakeTimers();
    const expired = vi.fn();
    const request = createUpdateWatchdog(expired);
    request.start();
    request.cancel();
    vi.advanceTimersByTime(UPDATE_ACTIVATION_TIMEOUT_MS);
    expect(expired).not.toHaveBeenCalled();
    expect(request.complete()).toBe(false);
  });

  it("replaces an earlier deadline when a request restarts", () => {
    vi.useFakeTimers();
    const expired = vi.fn();
    const request = createUpdateWatchdog(expired);
    request.start();
    vi.advanceTimersByTime(15_000);
    request.start();
    vi.advanceTimersByTime(15_000);
    expect(expired).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(expired).toHaveBeenCalledOnce();
  });

  it("allows a fresh explicit request after a timeout", () => {
    vi.useFakeTimers();
    const expired = vi.fn();
    const request = createUpdateWatchdog(expired);
    request.start();
    vi.advanceTimersByTime(UPDATE_ACTIVATION_TIMEOUT_MS);
    request.start();
    expect(request.complete()).toBe(true);
    vi.advanceTimersByTime(UPDATE_ACTIVATION_TIMEOUT_MS);
    expect(expired).toHaveBeenCalledOnce();
  });
});
