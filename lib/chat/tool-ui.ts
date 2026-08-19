import {
  ExtractInvoiceResultSchema,
  GenerateReportResultSchema,
  QueryInvoicesResultSchema,
  type ExtractInvoiceResult,
  type GenerateReportResult,
  type QueryInvoicesResult,
} from "@/lib/invoices/types";
import { readToolError } from "@/lib/chat/error-message";
import {
  invoiceCount,
  REPORT_GROUP_LABELS,
  REPORT_PERIOD_LABELS,
} from "@/lib/invoices/report-utils";
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
  const error = readToolError(output);

  if (error) {
    return error;
  }

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
  const error = readToolError(output);

  if (error) {
    return error;
  }

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
  const error = readToolError(output);

  if (error) {
    return error;
  }

  const parsed = GenerateReportResultSchema.safeParse(output);

  if (!parsed.success) {
    return BROKEN_PAYLOAD_TEXT;
  }

  return formatGenerateReport(parsed.data);
}

export function formatGenerateReport(result: GenerateReportResult) {
  const count = invoiceCount(result.rows);
  const total = formatMoney(result.total, result.currency);
  const header = `${REPORT_PERIOD_LABELS[result.period]} report by ${REPORT_GROUP_LABELS[result.groupBy]} totaling ${total}`;

  if (result.rows.length === 0) {
    return `${header}. No spending data.`;
  }

  const rows = result.rows.map(
    (row) =>
      `${row.label}: ${formatMoney(row.amount, result.currency)} (${row.count})`,
  );

  return [
    `${header} · ${count} invoice${count === 1 ? "" : "s"}`,
    ...rows,
  ].join("\n");
}
