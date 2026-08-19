import { z } from "zod";

const money = z
  .number()
  .describe("Amount in the invoice currency, not cents");

export const LineItemSchema = z.object({
  description: z.string().min(1).describe("Line item description"),
  quantity: z.number().describe("Quantity billed"),
  unitPrice: money.describe("Price per unit"),
  amount: money.describe("Line total (quantity × unit price)"),
});

export const InvoiceSchema = z.object({
  vendor: z.string().min(1).describe("Vendor or supplier name"),
  invoiceNumber: z.string().min(1).describe("Vendor-assigned invoice number"),
  issueDate: z.iso.date().describe("Invoice issue date (YYYY-MM-DD)"),
  dueDate: z.iso
    .date()
    .nullable()
    .describe("Payment due date (YYYY-MM-DD), if present"),
  currency: z
    .string()
    .min(1)
    .describe("ISO 4217 currency code, e.g. USD"),
  subtotal: money.describe("Sum of line items before tax"),
  tax: money.describe("Tax amount"),
  total: money.describe("Grand total including tax"),
  category: z
    .string()
    .nullable()
    .describe("Expense category, if classified"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Extractor confidence from 0 to 1"),
  raw: z
    .record(z.string(), z.unknown())
    .describe("Original extraction payload"),
  lineItems: z.array(LineItemSchema).describe("Invoice line items"),
});

/** Extraction-only shape: InvoiceSchema without `raw`, plus model notes. */
export const InvoiceExtractionSchema = InvoiceSchema.omit({ raw: true }).extend({
  unreadable: z
    .boolean()
    .describe(
      "True if the document is blank, too blurry, or otherwise unreadable. Do not invent invoice data in that case.",
    ),
  notes: z
    .string()
    .describe(
      "Anything ambiguous, missing, unreadable, or inferred. Empty string if the invoice is clear.",
    ),
});

export type LineItem = z.infer<typeof LineItemSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type InvoiceExtraction = z.infer<typeof InvoiceExtractionSchema>;
