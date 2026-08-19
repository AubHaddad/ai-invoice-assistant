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
