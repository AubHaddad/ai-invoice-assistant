import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/log-failure", () => ({
  logFailureToLangfuse: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  queryInvoices: vi.fn(),
}));

vi.mock("@/lib/invoices/query", async () => {
  const types = await import("@/lib/invoices/types");
  return {
    queryInvoices: mocks.queryInvoices,
    QueryInvoicesInputSchema: types.QueryInvoicesInputSchema,
  };
});

import { queryInvoicesTool } from "./query-invoices";

describe("queryInvoices tool", () => {
  it("passes the signed-in user and structured filters to the query layer", async () => {
    mocks.queryInvoices.mockResolvedValueOnce({
      invoices: [],
      summary: { count: 0, sum: 0, currency: null, returned: 0 },
    });

    const filters = {
      vendor: "GitHub",
      dateFrom: "2026-04-01",
      dateTo: "2026-06-30",
      category: "software" as const,
    };

    await expect(
      queryInvoicesTool.execute!(filters, {
        toolCallId: "q-1",
        messages: [],
        context: { userId: "user-1" },
      } as never),
    ).resolves.toMatchObject({
      summary: { count: 0 },
    });

    expect(mocks.queryInvoices).toHaveBeenCalledWith({
      userId: "user-1",
      filters,
    });
  });

  it("returns a public error when the mocked DB throws", async () => {
    mocks.queryInvoices.mockRejectedValueOnce(
      new Error("connect ECONNREFUSED 127.0.0.1:5432"),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      queryInvoicesTool.execute!(
        { vendor: "Acme" },
        {
          toolCallId: "q-2",
          messages: [],
          context: { userId: "user-1" },
        } as never,
      ),
    ).resolves.toEqual({
      error: "I couldn't reach the invoice database. Please try again.",
    });

    errorSpy.mockRestore();
  });
});
