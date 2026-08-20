import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  db: { select: vi.fn() },
}));
vi.mock("@/lib/observability/log-failure", () => ({
  logFailureToLangfuse: vi.fn(),
}));
vi.mock("@/lib/invoices/extract", () => ({
  extractInvoiceFromDocument: vi.fn(),
}));
vi.mock("@/lib/invoices/query", async () => {
  const types = await import("@/lib/invoices/types");
  return {
    queryInvoices: vi.fn(),
    QueryInvoicesInputSchema: types.QueryInvoicesInputSchema,
  };
});
vi.mock("@/lib/invoices/report", async () => {
  const types = await import("@/lib/invoices/types");
  return {
    generateReport: vi.fn(),
    GenerateReportInputSchema: types.GenerateReportInputSchema,
  };
});
vi.mock("@/lib/db/exchange-rates", () => ({
  convertCurrencyFromDb: vi.fn(),
}));
vi.mock("@/lib/invoices/categorize", () => ({
  categorizeExpense: vi.fn(),
}));

import { invoiceAssistantTools } from "./index";

describe("invoiceAssistantTools", () => {
  it("exports every assistant tool", () => {
    expect(Object.keys(invoiceAssistantTools).sort()).toEqual([
      "calculate",
      "categorizeExpense",
      "convertCurrency",
      "extractInvoice",
      "generateReport",
      "queryInvoices",
    ]);
    expect(invoiceAssistantTools.calculate.execute).toEqual(expect.any(Function));
    expect(invoiceAssistantTools.queryInvoices.execute).toEqual(
      expect.any(Function),
    );
  });
});
