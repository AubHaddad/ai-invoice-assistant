import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/log-failure", () => ({
  logFailureToLangfuse: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  extractInvoiceFromDocument: vi.fn(),
}));

vi.mock("@/lib/invoices/extract", () => ({
  extractInvoiceFromDocument: mocks.extractInvoiceFromDocument,
}));

import { extractInvoiceTool } from "./extract-invoice";

describe("extractInvoice tool", () => {
  it("forwards documentId, userId, and abortSignal to extraction", async () => {
    mocks.extractInvoiceFromDocument.mockResolvedValueOnce({
      ok: true,
      documentId: "doc-1",
      fileName: "invoice.pdf",
      extractionPath: "text",
      notes: "",
      invoice: { vendor: "Acme" },
    });

    const abortSignal = new AbortController().signal;

    await expect(
      extractInvoiceTool.execute!(
        { documentId: "doc-1" },
        {
          toolCallId: "ex-1",
          messages: [],
          context: { userId: "user-1" },
          abortSignal,
        } as never,
      ),
    ).resolves.toMatchObject({ ok: true, documentId: "doc-1" });

    expect(mocks.extractInvoiceFromDocument).toHaveBeenCalledWith({
      documentId: "doc-1",
      userId: "user-1",
      abortSignal,
    });
  });
});
