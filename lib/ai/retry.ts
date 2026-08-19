import { APICallError, LoadAPIKeyError, RetryError } from "ai";
import { isTimeoutError } from "@/lib/chat/error-message";

export const PROVIDER_RETRY = {
  maxAttempts: 3,
  baseDelayMs: 400,
  maxDelayMs: 2_000,
} as const;

export type ProviderRetryOptions = {
  sleep?: (ms: number) => Promise<void>;
  onFailure?: (error: unknown, stage: "retry" | "fallback") => void;
};

function unwrapRetryError(error: unknown) {
  return RetryError.isInstance(error) ? error.lastError : error;
}

function getErrorStatusCode(error: unknown) {
  const cause = unwrapRetryError(error);
  return APICallError.isInstance(cause) ? cause.statusCode : undefined;
}

export function isTransientProviderError(error: unknown) {
  if (isTimeoutError(error)) {
    return true;
  }

  const status = getErrorStatusCode(error);
  return status === 429 || (status != null && status >= 500);
}

export function isProviderUnavailableError(error: unknown) {
  const cause = unwrapRetryError(error);

  if (LoadAPIKeyError.isInstance(cause)) {
    return true;
  }

  const status = getErrorStatusCode(error);
  return status === 401 || status === 403 || isTransientProviderError(error);
}

export function providerRetryDelayMs(attempt: number) {
  const delay = PROVIDER_RETRY.baseDelayMs * 2 ** attempt;
  return Math.min(delay, PROVIDER_RETRY.maxDelayMs);
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Retry the primary provider with exponential backoff on 429/5xx/timeout,
 * then switch provider. Auth/missing-key failures skip the retry and switch
 * immediately.
 */
export async function withFallback<T>(
  runPrimary: () => PromiseLike<T>,
  runFallback: () => PromiseLike<T>,
  options: ProviderRetryOptions = {},
): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  let lastError: unknown;

  for (let attempt = 0; attempt < PROVIDER_RETRY.maxAttempts; attempt += 1) {
    try {
      return await runPrimary();
    } catch (error) {
      lastError = error;

      if (!isTransientProviderError(error)) {
        break;
      }

      if (attempt < PROVIDER_RETRY.maxAttempts - 1) {
        options.onFailure?.(error, "retry");
        await sleep(providerRetryDelayMs(attempt));
      }
    }
  }

  if (!isProviderUnavailableError(lastError)) {
    throw lastError;
  }

  options.onFailure?.(lastError, "fallback");
  console.warn("Primary AI provider unavailable; switching provider", lastError);
  return runFallback();
}
