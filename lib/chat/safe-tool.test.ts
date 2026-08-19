import { describe, expect, it, vi } from "vitest";
import { DATABASE_CHAT_ERROR_MESSAGE } from "@/lib/chat/error-message";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/log-failure", () => ({
  logFailureToLangfuse: vi.fn(),
}));

import { executeTool } from "./safe-tool";

describe("executeTool", () => {
  it("returns the tool result on success", async () => {
    await expect(
      executeTool("queryInvoices", async () => ({ invoices: [] })),
    ).resolves.toEqual({ invoices: [] });
  });

  it("returns { error } instead of throwing", async () => {
    const { logFailureToLangfuse } = await import(
      "@/lib/observability/log-failure"
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      executeTool("queryInvoices", async () => {
        throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
      }),
    ).resolves.toEqual({ error: DATABASE_CHAT_ERROR_MESSAGE });

    expect(logFailureToLangfuse).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "tool",
        extra: { tool: "queryInvoices" },
      }),
    );
    errorSpy.mockRestore();
  });
});
