import { describe, expect, it } from "vitest";
import {
  DATABASE_CHAT_ERROR_MESSAGE,
  DEFAULT_CHAT_ERROR_MESSAGE,
  getChatErrorBannerMessage,
  PROVIDER_CHAT_ERROR_MESSAGE,
  readToolError,
  TIMEOUT_CHAT_ERROR_MESSAGE,
  toPublicErrorMessage,
} from "./error-message";

describe("getChatErrorBannerMessage", () => {
  it("reads the friendly message from a JSON 429 body", () => {
    expect(
      getChatErrorBannerMessage(
        new Error(
          JSON.stringify({
            error: "You're sending messages too quickly. Please wait a minute and try again.",
            code: "rate_limit",
          }),
        ),
      ),
    ).toBe("You're sending messages too quickly. Please wait a minute and try again.");
  });

  it("falls back to a generic message when the error is empty", () => {
    expect(getChatErrorBannerMessage(new Error("   "))).toBe(
      DEFAULT_CHAT_ERROR_MESSAGE,
    );
  });

  it("maps a database connection failure to a public message", () => {
    expect(
      getChatErrorBannerMessage(new Error("connect ECONNREFUSED 127.0.0.1:5432")),
    ).toBe(DATABASE_CHAT_ERROR_MESSAGE);
  });
});

describe("toPublicErrorMessage", () => {
  it("maps timeouts, database, and provider failures", () => {
    const timeout = new Error("The operation was aborted due to timeout");
    timeout.name = "TimeoutError";
    expect(toPublicErrorMessage(timeout)).toBe(TIMEOUT_CHAT_ERROR_MESSAGE);
    expect(toPublicErrorMessage(new Error("ECONNRESET"))).toBe(
      DATABASE_CHAT_ERROR_MESSAGE,
    );
    expect(toPublicErrorMessage(new Error("Anthropic APICallError: overloaded"))).toBe(
      PROVIDER_CHAT_ERROR_MESSAGE,
    );
  });
});

describe("readToolError", () => {
  it("reads { error } payloads and ok:false results", () => {
    expect(readToolError({ error: "Database is down." })).toBe("Database is down.");
    expect(readToolError({ ok: false, error: "Could not extract invoice fields." })).toBe(
      "Could not extract invoice fields.",
    );
  });

  it("ignores successful payloads", () => {
    expect(readToolError({ ok: true, error: "" })).toBeNull();
    expect(readToolError({ invoices: [], summary: {} })).toBeNull();
    expect(readToolError(null)).toBeNull();
  });
});
