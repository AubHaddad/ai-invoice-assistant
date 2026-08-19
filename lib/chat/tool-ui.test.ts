import { describe, expect, it } from "vitest";
import {
  BROKEN_PAYLOAD_TEXT,
  extractInvoiceFallback,
  generateReportFallback,
  queryInvoicesFallback,
  toolStatusFallback,
} from "./tool-ui";
import type {
  ExtractInvoiceSuccess,
  GenerateReportResult,
  QueryInvoicesResult,
} from "@/lib/invoices/types";

const invoiceResult: ExtractInvoiceSuccess = {
  ok: true,
  documentId: "doc-1",
  fileName: "github-inv-2041.pdf",
  extractionPath: "text",
  notes: "",
  invoice: {
    vendor: "GitHub",
    invoiceNumber: "INV-2041",
    issueDate: "2026-04-12",
    dueDate: "2026-05-12",
    currency: "USD",
    subtotal: 200,
    tax: 20,
    total: 220,
    category: "software",
    confidence: 0.95,
    raw: {},
    lineItems: [
      {
        description: "Team plan — April",
        quantity: 1,
        unitPrice: 200,
        amount: 200,
      },
    ],
  },
};

const queryResult: QueryInvoicesResult = {
  invoices: [
    {
      id: "inv-1",
      vendor: "GitHub",
      invoiceNumber: "INV-2041",
      issueDate: "2026-04-12",
      dueDate: "2026-05-12",
      category: "software",
      currency: "USD",
      total: 220,
    },
  ],
  summary: {
    count: 1,
    sum: 220,
    currency: "USD",
    returned: 1,
  },
};

const reportResult: GenerateReportResult = {
  period: "month",
  groupBy: "category",
  dateFrom: "2026-08-01",
  dateTo: "2026-08-31",
  rows: [{ key: "software", label: "Software", amount: 1320, count: 1 }],
  total: 1320,
  currency: "USD",
};

describe("tool UI fallbacks", () => {
  it("formats extractInvoice, queryInvoices, and generateReport output as text", () => {
    expect(extractInvoiceFallback(invoiceResult)).toContain("GitHub");
    expect(extractInvoiceFallback(invoiceResult)).toContain("INV-2041");
    expect(queryInvoicesFallback(queryResult)).toContain("1 invoice");
    expect(generateReportFallback(reportResult)).toContain("Software");
  });

  it("degrades a broken extractInvoice payload to text", () => {
    expect(extractInvoiceFallback({ ok: true })).toBe(BROKEN_PAYLOAD_TEXT);
    expect(extractInvoiceFallback(null)).toBe(BROKEN_PAYLOAD_TEXT);
    expect(extractInvoiceFallback("nope")).toBe(BROKEN_PAYLOAD_TEXT);
  });

  it("degrades a broken queryInvoices payload to text", () => {
    expect(queryInvoicesFallback({ invoices: [{ vendor: "GitHub" }] })).toBe(
      BROKEN_PAYLOAD_TEXT,
    );
    expect(queryInvoicesFallback(undefined)).toBe(BROKEN_PAYLOAD_TEXT);
  });

  it("degrades a broken generateReport payload to text", () => {
    expect(generateReportFallback({ rows: "bad" })).toBe(BROKEN_PAYLOAD_TEXT);
    expect(generateReportFallback({ groupBy: "category" })).toBe(
      BROKEN_PAYLOAD_TEXT,
    );
  });

  it("uses the extraction error as fallback for a failed but valid payload", () => {
    expect(
      extractInvoiceFallback({
        ok: false,
        error: "This document is unreadable.",
      }),
    ).toBe("This document is unreadable.");
  });

  it("labels in-progress tools", () => {
    expect(toolStatusFallback("extractInvoice")).toBe("Extracting invoice…");
    expect(toolStatusFallback("queryInvoices")).toBe("Searching invoices…");
    expect(toolStatusFallback("generateReport")).toBe("Generating report…");
    expect(toolStatusFallback("unknownTool")).toBe("Running unknownTool…");
  });
});
