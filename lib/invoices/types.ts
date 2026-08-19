import { z } from "zod";
import type { Invoice } from "@/lib/schemas";

export type InvoiceExtractionPath = "text" | "vision" | "mixed";

export type ExtractInvoiceSuccess = {
  ok: true;
  documentId: string;
  fileName: string;
  extractionPath: InvoiceExtractionPath;
  invoice: Invoice;
  notes: string;
};

export type ExtractInvoiceUnreadable = {
  ok: false;
  code: "unreadable";
  error: string;
  documentId: string;
  fileName: string;
};

export type ExtractInvoiceFailure = {
  ok: false;
  code?: "error";
  error: string;
};

export type ExtractInvoiceResult =
  | ExtractInvoiceSuccess
  | ExtractInvoiceUnreadable
  | ExtractInvoiceFailure;

export type SavedInvoice = {
  invoiceId: string;
  documentId: string;
  vendor: string;
  invoiceNumber: string;
  total: number;
  currency: string;
};

export type SaveInvoiceResult =
  | ({ ok: true } & SavedInvoice)
  | { ok: false; error: string };

export function invoiceSavedSystemText(saved: SavedInvoice) {
  return `The user reviewed and saved invoice ${saved.invoiceNumber} from ${saved.vendor} (invoice id: ${saved.invoiceId}, document id: ${saved.documentId}). Total: ${saved.total} ${saved.currency}. Confirm the save briefly. You can reference this invoice by vendor, invoice number, or id.`;
}

const DEFAULT_QUERY_LIMIT = 20;
const MAX_QUERY_LIMIT = 50;

export const QueryInvoicesInputSchema = z.object({
  vendor: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Vendor name to match (case-insensitive substring)"),
  dateFrom: z.iso
    .date()
    .optional()
    .describe("Inclusive issue-date start (YYYY-MM-DD)"),
  dateTo: z.iso
    .date()
    .optional()
    .describe("Inclusive issue-date end (YYYY-MM-DD)"),
  category: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Expense category to match (case-insensitive substring)"),
  minAmount: z
    .number()
    .optional()
    .describe("Minimum invoice total in the invoice currency"),
  maxAmount: z
    .number()
    .optional()
    .describe("Maximum invoice total in the invoice currency"),
  currency: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("ISO 4217 currency code, e.g. USD"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_QUERY_LIMIT)
    .optional()
    .describe(
      `Max rows to return (default ${DEFAULT_QUERY_LIMIT}, max ${MAX_QUERY_LIMIT})`,
    ),
});

export type QueryInvoicesInput = z.infer<typeof QueryInvoicesInputSchema>;

export type QueriedInvoice = {
  id: string;
  vendor: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  category: string | null;
  currency: string;
  total: number;
};

export type QueryInvoicesResult = {
  invoices: QueriedInvoice[];
  summary: {
    count: number;
    sum: number;
    currency: string | null;
    returned: number;
  };
};

export { DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT };
