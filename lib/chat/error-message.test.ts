import { describe, expect, it } from "vitest";
import {
  DEFAULT_CHAT_ERROR_MESSAGE,
  getChatErrorBannerMessage,
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
});
