import type { Invoice } from "@/lib/schemas";
import type { NewInvoice, NewLineItem } from "./schema";

export function invoiceInsertValues(
  parsed: Invoice,
  keys: { userId: string; documentId: string },
): NewInvoice {
  const { lineItems: _lineItems, ...invoice } = parsed;
  return { ...invoice, ...keys };
}

export function lineItemInsertValues(
  parsed: Invoice,
  invoiceId: string,
): NewLineItem[] {
  return parsed.lineItems.map((item) => ({ ...item, invoiceId }));
}
