import { describe, expect, it, vi } from "vitest";
import { APICallError } from "ai";
import {
  PROVIDER_RETRY,
  isTransientProviderError,
  providerRetryDelayMs,
  withFallback,
} from "./retry";

function apiError(statusCode: number) {
  return new APICallError({
    message: `status ${statusCode}`,
    url: "https://example.test",
    requestBodyValues: {},
    statusCode,
    responseHeaders: {},
    responseBody: "",
  });
}

describe("providerRetryDelayMs", () => {
  it("uses exponential backoff capped at the max delay", () => {
    expect(providerRetryDelayMs(0)).toBe(PROVIDER_RETRY.baseDelayMs);
    expect(providerRetryDelayMs(1)).toBe(PROVIDER_RETRY.baseDelayMs * 2);
    expect(providerRetryDelayMs(10)).toBe(PROVIDER_RETRY.maxDelayMs);
  });
});

describe("isTransientProviderError", () => {
  it("retries 429, 5xx, and timeouts", () => {
    expect(isTransientProviderError(apiError(429))).toBe(true);
    expect(isTransientProviderError(apiError(503))).toBe(true);
    const timeout = new Error("aborted due to timeout");
    timeout.name = "TimeoutError";
    expect(isTransientProviderError(timeout)).toBe(true);
    expect(isTransientProviderError(apiError(400))).toBe(false);
  });
});

describe("withFallback", () => {
  it("retries the primary with backoff then switches provider", async () => {
    const sleep = vi.fn(async () => undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const primary = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(apiError(503))
      .mockRejectedValueOnce(apiError(503))
      .mockRejectedValueOnce(apiError(503));
    const fallback = vi.fn(async () => "ok");
    const onFailure = vi.fn();

    await expect(
      withFallback(primary, fallback, { sleep, onFailure }),
    ).resolves.toBe("ok");

    expect(primary).toHaveBeenCalledTimes(PROVIDER_RETRY.maxAttempts);
    expect(sleep).toHaveBeenCalledTimes(PROVIDER_RETRY.maxAttempts - 1);
    expect(sleep).toHaveBeenNthCalledWith(1, providerRetryDelayMs(0));
    expect(sleep).toHaveBeenNthCalledWith(2, providerRetryDelayMs(1));
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("returns the primary result after a successful retry", async () => {
    const sleep = vi.fn(async () => undefined);
    const primary = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(apiError(429))
      .mockResolvedValueOnce("recovered");

    await expect(
      withFallback(primary, async () => "fallback", { sleep }),
    ).resolves.toBe("recovered");
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("does not retry non-transient client errors", async () => {
    const primary = vi.fn(async () => {
      throw apiError(400);
    });
    const fallback = vi.fn(async () => "fallback");

    await expect(withFallback(primary, fallback)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(primary).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();
  });
});
