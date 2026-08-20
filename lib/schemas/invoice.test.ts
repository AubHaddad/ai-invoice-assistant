import { describe, expect, it } from "vitest";
import {
  InvoiceExtractionSchema,
  InvoiceSchema,
  LineItemSchema,
} from "@/lib/schemas";
import { EXPENSE_CATEGORIES } from "@/lib/invoices/categories";

const lineItem = {
  description: "API usage — August",
  quantity: 1,
  unitPrice: 1200,
  amount: 1200,
};

const invoice = {
  vendor: "Acme Corp",
  invoiceNumber: "INV-1042",
  issueDate: "2026-08-01",
  dueDate: "2026-08-31",
  currency: "USD",
  subtotal: 1200,
  tax: 120,
  total: 1320,
  category: "software" as const,
  confidence: 0.96,
  raw: { source: "extractor" },
  lineItems: [lineItem],
};

describe("LineItemSchema", () => {
  it("accepts a complete line item", () => {
    expect(LineItemSchema.safeParse(lineItem).success).toBe(true);
  });

  it("rejects an empty description", () => {
    expect(
      LineItemSchema.safeParse({ ...lineItem, description: "" }).success,
    ).toBe(false);
  });

  it("rejects non-numeric amounts", () => {
    expect(
      LineItemSchema.safeParse({ ...lineItem, amount: "1200" }).success,
    ).toBe(false);
  });
});

describe("InvoiceSchema", () => {
  it("accepts a saved invoice including a category enum value", () => {
    expect(InvoiceSchema.parse(invoice)).toMatchObject({
      vendor: "Acme Corp",
      category: "software",
      lineItems: [lineItem],
    });
  });

  it("allows a null category and due date", () => {
    expect(
      InvoiceSchema.safeParse({ ...invoice, category: null, dueDate: null })
        .success,
    ).toBe(true);
  });

  it("accepts every expense category", () => {
    for (const category of EXPENSE_CATEGORIES) {
      expect(
        InvoiceSchema.safeParse({ ...invoice, category }).success,
      ).toBe(true);
    }
  });

  it("rejects a category outside the enum", () => {
    expect(
      InvoiceSchema.safeParse({ ...invoice, category: "legal" }).success,
    ).toBe(false);
    expect(
      InvoiceSchema.safeParse({ ...invoice, category: "Software" }).success,
    ).toBe(false);
  });

  it("rejects missing vendor, bad ISO dates, and confidence outside 0–1", () => {
    expect(InvoiceSchema.safeParse({ ...invoice, vendor: "" }).success).toBe(
      false,
    );
    expect(
      InvoiceSchema.safeParse({ ...invoice, issueDate: "01/08/2026" }).success,
    ).toBe(false);
    expect(
      InvoiceSchema.safeParse({ ...invoice, dueDate: "August 31" }).success,
    ).toBe(false);
    expect(
      InvoiceSchema.safeParse({ ...invoice, confidence: 1.2 }).success,
    ).toBe(false);
    expect(
      InvoiceSchema.safeParse({ ...invoice, confidence: -0.1 }).success,
    ).toBe(false);
  });

  it("requires raw extraction payload and line items", () => {
    const { raw: _raw, ...withoutRaw } = invoice;
    expect(InvoiceSchema.safeParse(withoutRaw).success).toBe(false);
    expect(
      InvoiceSchema.safeParse({ ...invoice, lineItems: "none" }).success,
    ).toBe(false);
  });
});

describe("InvoiceExtractionSchema", () => {
  const extraction = {
    vendor: invoice.vendor,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
    confidence: invoice.confidence,
    lineItems: invoice.lineItems,
    unreadable: false,
    notes: "",
  };

  it("accepts extractor output without raw or category", () => {
    expect(InvoiceExtractionSchema.parse(extraction)).toMatchObject({
      unreadable: false,
      notes: "",
    });
  });

  it("requires unreadable and notes", () => {
    const { unreadable: _unreadable, notes: _notes, ...rest } = extraction;
    expect(InvoiceExtractionSchema.safeParse(rest).success).toBe(false);
    expect(
      InvoiceExtractionSchema.safeParse({ ...rest, unreadable: true }).success,
    ).toBe(false);
    expect(
      InvoiceExtractionSchema.safeParse({ ...rest, notes: "blurry" }).success,
    ).toBe(false);
  });

  it("marks a blank document as unreadable without inventing extras", () => {
    expect(
      InvoiceExtractionSchema.safeParse({
        ...extraction,
        unreadable: true,
        notes: "Blank scan",
      }).success,
    ).toBe(true);
  });
});
