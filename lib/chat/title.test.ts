import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("ai", () => ({ generateText: vi.fn() }));
vi.mock("@/lib/ai/models", () => ({ getModel: vi.fn() }));
vi.mock("@/lib/observability/log-failure", () => ({
  logFailureToLangfuse: vi.fn(),
}));

import { fallbackTitle } from "./title";

describe("fallbackTitle", () => {
  it("uses the user message when it is short", () => {
    expect(fallbackTitle("Extract the uploaded invoice.")).toBe(
      "Extract the uploaded invoice.",
    );
  });

  it("truncates long user messages", () => {
    const title = fallbackTitle(
      "Please extract this very long invoice and tell me the vendor, dates, and totals in detail.",
    );

    expect(title.endsWith("…")).toBe(true);
    expect(title.length).toBeLessThanOrEqual(48);
  });

  it("falls back to New chat when the user message is empty", () => {
    expect(fallbackTitle("   ")).toBe("New chat");
  });
});
