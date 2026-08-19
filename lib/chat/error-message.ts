export const DEFAULT_CHAT_ERROR_MESSAGE =
  "Something went wrong. Please try again.";

export const TIMEOUT_CHAT_ERROR_MESSAGE =
  "That request timed out. Please try again.";

export const DATABASE_CHAT_ERROR_MESSAGE =
  "I couldn't reach the invoice database. Please try again.";

export const PROVIDER_CHAT_ERROR_MESSAGE =
  "The AI provider is unavailable. Please try again.";

function readErrorText(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return "";
}

function errorName(error: unknown) {
  return error instanceof Error ? error.name : "";
}

export function isTimeoutError(error: unknown) {
  const seen = new Set<unknown>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);

    const name = "name" in current ? String(current.name) : "";
    const message = "message" in current ? String(current.message) : "";

    if (name === "TimeoutError") {
      return true;
    }

    if (name === "AbortError" && /timeout/i.test(message)) {
      return true;
    }

    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}

export function isDatabaseError(error: unknown) {
  const raw = `${errorName(error)} ${readErrorText(error)}`;

  return /ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|connection terminated|the database system|connect ECONNREFUSED|timeout expired|Connection terminated|remaining connection slots|too many clients|57P01|08006|08001/i.test(
    raw,
  );
}

export function isProviderError(error: unknown) {
  const raw = `${errorName(error)} ${readErrorText(error)}`;

  return /APICallError|LoadAPIKeyError|RetryError|rate limit|overloaded|provider|anthropic|openai/i.test(
    raw,
  );
}

export function toPublicErrorMessage(
  error: unknown,
  fallback = DEFAULT_CHAT_ERROR_MESSAGE,
) {
  if (isTimeoutError(error)) {
    return TIMEOUT_CHAT_ERROR_MESSAGE;
  }

  if (isDatabaseError(error)) {
    return DATABASE_CHAT_ERROR_MESSAGE;
  }

  if (isProviderError(error)) {
    return PROVIDER_CHAT_ERROR_MESSAGE;
  }

  return fallback;
}

export function readToolError(output: unknown) {
  if (!output || typeof output !== "object") {
    return null;
  }

  if (!("error" in output) || typeof output.error !== "string") {
    return null;
  }

  const message = output.error.trim();

  if (!message) {
    return null;
  }

  if ("ok" in output && output.ok === true) {
    return null;
  }

  return message;
}

export function getChatErrorBannerMessage(error: unknown) {
  const raw = readErrorText(error);

  if (!raw) {
    return DEFAULT_CHAT_ERROR_MESSAGE;
  }

  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as { error?: unknown };

      if (typeof parsed.error === "string" && parsed.error.trim()) {
        return parsed.error.trim();
      }
    } catch {
      // The transport stores the response body as Error.message.
    }
  }

  return toPublicErrorMessage(error, raw);
}
