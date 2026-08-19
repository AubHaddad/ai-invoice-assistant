import type { Invoice } from "@/lib/schemas";

export type InvoiceExtractionPath = "text" | "vision";

export type ExtractInvoiceSuccess = {
  ok: true;
  documentId: string;
  fileName: string;
  extractionPath: InvoiceExtractionPath;
  invoice: Invoice;
  notes: string;
};

export type ExtractInvoiceFailure = {
  ok: false;
  error: string;
};

export type ExtractInvoiceResult = ExtractInvoiceSuccess | ExtractInvoiceFailure;
