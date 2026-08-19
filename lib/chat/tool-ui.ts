import {
  ExtractInvoiceResultSchema,
  GenerateReportResultSchema,
  QueryInvoicesResultSchema,
  type ExtractInvoiceResult,
  type GenerateReportResult,
  type QueryInvoicesResult,
} from "@/lib/invoices/types";
import { formatMoney } from "@/lib/money/format";

export const BROKEN_PAYLOAD_TEXT = "This result could not be displayed.";

export const TOOL_STATUS_LABELS: Record<string, string> = {
  extractInvoice: "Extracting invoice…",
  queryInvoices: "Searching invoices…",
  generateReport: "Generating report…",
  calculate: "Calculating…",
  convertCurrency: "Converting currency…",
  categorizeExpense: "Categorizing expense…",
};

export function toolStatusFallback(toolName: string) {
  return TOOL_STATUS_LABELS[toolName] ?? `Running ${toolName}…`;
}

export function extractInvoiceFallback(output: unknown) {
  const parsed = ExtractInvoiceResultSchema.safeParse(output);

  if (!parsed.success) {
    return BROKEN_PAYLOAD_TEXT;
  }

  return formatExtractInvoice(parsed.data);
}

export function formatExtractInvoice(result: ExtractInvoiceResult) {
  if (!result.ok) {
    return result.error;
  }

  const { invoice, fileName } = result;
  return `${invoice.vendor} ${invoice.invoiceNumber}: ${formatMoney(invoice.total, invoice.currency)} on ${invoice.issueDate} (${fileName})`;
}

export function queryInvoicesFallback(output: unknown) {
  const parsed = QueryInvoicesResultSchema.safeParse(output);

  if (!parsed.success) {
    return BROKEN_PAYLOAD_TEXT;
  }

  return formatQueryInvoices(parsed.data);
}

export function formatQueryInvoices(result: QueryInvoicesResult) {
  const { invoices, summary } = result;

  if (summary.count === 0) {
    return "No matching invoices.";
  }

  const total = formatMoney(summary.sum, summary.currency);
  const header = `${summary.count} invoice${summary.count === 1 ? "" : "s"} totaling ${total}`;
  const rows = invoices.map(
    (invoice) =>
      `${invoice.vendor} ${invoice.invoiceNumber}: ${formatMoney(invoice.total, invoice.currency)}`,
  );

  return [header, ...rows].join("\n");
}

export function generateReportFallback(output: unknown) {
  const parsed = GenerateReportResultSchema.safeParse(output);

  if (!parsed.success) {
    return BROKEN_PAYLOAD_TEXT;
  }

  return formatGenerateReport(parsed.data);
}

export function formatGenerateReport(result: GenerateReportResult) {
  if (result.points.length === 0) {
    return "No spending data.";
  }

  const header = `${result.summary.count} invoice${result.summary.count === 1 ? "" : "s"} totaling ${formatMoney(result.summary.sum, result.summary.currency)} by ${result.groupBy}`;
  const rows = result.points.map(
    (point) =>
      `${point.label}: ${formatMoney(point.amount, point.currency)} (${point.count})`,
  );

  return [header, ...rows].join("\n");
}
