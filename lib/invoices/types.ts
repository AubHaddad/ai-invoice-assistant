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
