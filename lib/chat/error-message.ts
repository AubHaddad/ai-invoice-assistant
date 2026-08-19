export const DEFAULT_CHAT_ERROR_MESSAGE =
  "Something went wrong. Please try again.";

function readErrorText(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return "";
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

  return raw;
}
