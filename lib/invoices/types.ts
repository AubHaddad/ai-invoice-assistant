import { z } from "zod";
import { ExpenseCategorySchema, type ExpenseCategory } from "./categories";
import { InvoiceSchema } from "@/lib/schemas";

export const InvoiceExtractionPathSchema = z.enum(["text", "vision", "mixed"]);

export type InvoiceExtractionPath = z.infer<typeof InvoiceExtractionPathSchema>;

export const ExtractInvoiceSuccessSchema = z.object({
  ok: z.literal(true),
  documentId: z.string(),
  fileName: z.string(),
  extractionPath: InvoiceExtractionPathSchema,
  invoice: InvoiceSchema,
  notes: z.string(),
});

export const ExtractInvoiceUnreadableSchema = z.object({
  ok: z.literal(false),
  code: z.literal("unreadable"),
  error: z.string(),
  documentId: z.string(),
  fileName: z.string(),
});

export const ExtractInvoiceRejectedSchema = z.object({
  ok: z.literal(false),
  code: z.literal("rejected"),
  error: z.string(),
  documentId: z.string(),
  fileName: z.string(),
});

export const ExtractInvoiceFailureSchema = z.object({
  ok: z.literal(false),
  code: z.literal("error").optional(),
  error: z.string(),
});

export const ExtractInvoiceResultSchema = z.union([
  ExtractInvoiceSuccessSchema,
  ExtractInvoiceUnreadableSchema,
  ExtractInvoiceRejectedSchema,
  ExtractInvoiceFailureSchema,
]);

export type ExtractInvoiceSuccess = z.infer<typeof ExtractInvoiceSuccessSchema>;
export type ExtractInvoiceUnreadable = z.infer<
  typeof ExtractInvoiceUnreadableSchema
>;
export type ExtractInvoiceRejected = z.infer<typeof ExtractInvoiceRejectedSchema>;
export type ExtractInvoiceFailure = z.infer<typeof ExtractInvoiceFailureSchema>;
export type ExtractInvoiceResult = z.infer<typeof ExtractInvoiceResultSchema>;

export type SavedInvoice = {
  invoiceId: string;
  documentId: string;
  vendor: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  category: ExpenseCategory | null;
};

export type SaveInvoiceResult =
  | ({ ok: true } & SavedInvoice)
  | { ok: false; error: string };

export function invoiceSavedSystemText(saved: SavedInvoice) {
  const category = saved.category ? ` Category: ${saved.category}.` : "";
  return `The user reviewed and saved invoice ${saved.invoiceNumber} from ${saved.vendor} (invoice id: ${saved.invoiceId}, document id: ${saved.documentId}). Total: ${saved.total} ${saved.currency}.${category} Confirm the save briefly. You can reference this invoice by vendor, invoice number, or id.`;
}

const SAVED_DOCUMENT_ID_RE =
  /document id: ([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i;

export function savedDocumentIdFromSystemText(text: string) {
  return SAVED_DOCUMENT_ID_RE.exec(text)?.[1] ?? null;
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
  category: ExpenseCategorySchema.optional().describe(
    "Expense category to match (software, travel, meals, office, telecom, marketing, or other)",
  ),
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

export const QueriedInvoiceSchema = z.object({
  id: z.string(),
  vendor: z.string(),
  invoiceNumber: z.string(),
  issueDate: z.string(),
  dueDate: z.string().nullable(),
  category: ExpenseCategorySchema.nullable(),
  currency: z.string(),
  total: z.number(),
});

export const QueryInvoicesResultSchema = z.object({
  invoices: z.array(QueriedInvoiceSchema),
  summary: z.object({
    count: z.number(),
    sum: z.number(),
    currency: z.string().nullable(),
    returned: z.number(),
  }),
});

export type QueriedInvoice = z.infer<typeof QueriedInvoiceSchema>;
export type QueryInvoicesResult = z.infer<typeof QueryInvoicesResultSchema>;

export const ReportPeriodSchema = z.enum(["month", "quarter", "year"]);

export type ReportPeriod = z.infer<typeof ReportPeriodSchema>;

export const ReportGroupBySchema = z.enum(["category", "vendor"]);

export type ReportGroupBy = z.infer<typeof ReportGroupBySchema>;

export const GenerateReportInputSchema = z.object({
  period: ReportPeriodSchema.describe(
    "month, quarter, or year. Combine with year (and month or quarter) when the user names a specific window such as 2024 or June 2025; otherwise the current calendar window.",
  ),
  year: z
    .number()
    .int()
    .min(2000)
    .max(2100)
    .optional()
    .describe(
      "Calendar year for the report. Pass this when the user names a year (e.g. 2024). Defaults to the current year.",
    ),
  month: z
    .number()
    .int()
    .min(1)
    .max(12)
    .optional()
    .describe(
      "Calendar month 1–12. Use with period=month when the user names a month. Defaults to the current month.",
    ),
  quarter: z
    .number()
    .int()
    .min(1)
    .max(4)
    .optional()
    .describe(
      "Calendar quarter 1–4. Use with period=quarter when the user names a quarter. Defaults to the current quarter.",
    ),
  groupBy: ReportGroupBySchema.default("category").describe(
    "How to break down spend: category or vendor",
  ),
  currency: z
    .enum(["MAD", "EUR", "USD"])
    .optional()
    .describe(
      "Convert all amounts to this currency (MAD, EUR, or USD). Defaults to the most common invoice currency in the period.",
    ),
});

export type GenerateReportInput = z.infer<typeof GenerateReportInputSchema>;

export const ReportRowSchema = z.object({
  key: z.string(),
  label: z.string(),
  amount: z.number(),
  count: z.number(),
});

export const GenerateReportResultSchema = z.object({
  period: ReportPeriodSchema,
  groupBy: ReportGroupBySchema,
  dateFrom: z.iso.date(),
  dateTo: z.iso.date(),
  rows: z.array(ReportRowSchema),
  total: z.number(),
  currency: z.string(),
});

export type ReportRow = z.infer<typeof ReportRowSchema>;
export type GenerateReportResult = z.infer<typeof GenerateReportResultSchema>;

export { DEFAULT_QUERY_LIMIT, MAX_QUERY_LIMIT };
