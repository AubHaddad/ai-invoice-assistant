import { describe, expect, it } from "vitest";
import { InvoiceSchema } from "@/lib/schemas";
import {
  CATEGORIZE_TEST_SET,
  CategorizeExpenseInputSchema,
  CategorizeExpenseOutputSchema,
  clampExpenseCategory,
  EXPENSE_CATEGORIES,
  parseExpenseCategory,
} from "./categories";

const invoiceBase = {
  vendor: "Acme Corp",
  invoiceNumber: "INV-1042",
  issueDate: "2026-08-01",
  dueDate: "2026-08-31",
  currency: "USD",
  subtotal: 1200,
  tax: 120,
  total: 1320,
  confidence: 0.96,
  raw: {},
  lineItems: [
    {
      description: "API usage — August",
      quantity: 1,
      unitPrice: 1200,
      amount: 1200,
    },
  ],
};

describe("expense categories", () => {
  it("keeps the test set inside the fixed enum", () => {
    const expected = new Set(CATEGORIZE_TEST_SET.map((fixture) => fixture.expected));

    expect(CATEGORIZE_TEST_SET.length).toBeGreaterThanOrEqual(EXPENSE_CATEGORIES.length);
    expect([...expected].sort()).toEqual([...EXPENSE_CATEGORIES].sort());

    for (const fixture of CATEGORIZE_TEST_SET) {
      expect(EXPENSE_CATEGORIES).toContain(fixture.expected);
      expect(CategorizeExpenseInputSchema.safeParse(fixture).success).toBe(true);
      expect(
        CategorizeExpenseOutputSchema.safeParse({
          category: fixture.expected,
          reason: "fixture",
        }).success,
      ).toBe(true);
    }
  });

  it("never accepts a category outside the enum", () => {
    expect(CategorizeExpenseOutputSchema.safeParse({
      category: "legal",
      reason: "retainer",
    }).success).toBe(false);
    expect(CategorizeExpenseOutputSchema.safeParse({
      category: "Software",
      reason: "seats",
    }).success).toBe(false);
    expect(parseExpenseCategory("legal")).toBeNull();
    expect(parseExpenseCategory("Software")).toBe("software");
    expect(clampExpenseCategory("legal")).toBe("other");
    expect(clampExpenseCategory("FOOD")).toBe("other");
    expect(clampExpenseCategory(null)).toBe("other");
  });

  it("persists only enum categories on the invoice schema", () => {
    expect(
      InvoiceSchema.safeParse({ ...invoiceBase, category: "software" }).success,
    ).toBe(true);
    expect(
      InvoiceSchema.safeParse({ ...invoiceBase, category: null }).success,
    ).toBe(true);
    expect(
      InvoiceSchema.safeParse({ ...invoiceBase, category: "Software" }).success,
    ).toBe(false);
    expect(
      InvoiceSchema.safeParse({ ...invoiceBase, category: "legal" }).success,
    ).toBe(false);
  });
});
