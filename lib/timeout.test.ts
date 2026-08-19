import { afterEach, describe, expect, it, vi } from "vitest";
import { TimeoutError, abortAfter, withTimeout } from "./timeout";

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves when the promise finishes in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50)).resolves.toBe("ok");
  });

  it("rejects with TimeoutError when the deadline passes", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise(() => undefined), 25, "too slow");

    const assertion = expect(pending).rejects.toMatchObject({
      name: "TimeoutError",
      message: "too slow",
      timeoutMs: 25,
    } satisfies Partial<TimeoutError>);

    await vi.advanceTimersByTimeAsync(25);
    await assertion;
  });

  it("aborts after the timeout", () => {
    const signal = abortAfter(5);
    expect(signal.aborted).toBe(false);
  });
});
