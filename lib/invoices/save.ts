import { eq } from "drizzle-orm";
import "server-only";
import { getConversationForUser, isUuid } from "@/lib/chat/store";
import { db } from "@/lib/db";
import {
  invoiceInsertValues,
  lineItemInsertValues,
} from "@/lib/db/invoices";
import {
  conversationInvoices,
  invoices,
  lineItems,
} from "@/lib/db/schema";
import { getDocumentForUser } from "@/lib/documents/store";
import { InvoiceSchema, type Invoice } from "@/lib/schemas";
import { roundMoney } from "./postprocess";
import type { SaveInvoiceResult } from "./types";

function roundInvoiceMoney(invoice: Invoice): Invoice {
  return {
    ...invoice,
    subtotal: roundMoney(invoice.subtotal),
    tax: roundMoney(invoice.tax),
    total: roundMoney(invoice.total),
    lineItems: invoice.lineItems.map((item) => ({
      ...item,
      quantity: item.quantity,
      unitPrice: roundMoney(item.unitPrice),
      amount: roundMoney(item.amount),
    })),
  };
}

export async function saveInvoice({
  userId,
  documentId,
  conversationId,
  invoice,
}: {
  userId: string;
  documentId: string;
  conversationId: string;
  invoice: Invoice;
}): Promise<SaveInvoiceResult> {
  if (!isUuid(documentId) || !isUuid(conversationId)) {
    return { ok: false, error: "Invoice data is invalid." };
  }

  const parsed = InvoiceSchema.safeParse(roundInvoiceMoney(invoice));

  if (!parsed.success) {
    return { ok: false, error: "Invoice data is invalid." };
  }

  const document = await getDocumentForUser(documentId, userId);

  if (!document) {
    return { ok: false, error: "Document not found." };
  }

  if (document.status !== "uploaded") {
    return { ok: false, error: "Document is not ready to save." };
  }

  const conversation = await getConversationForUser(conversationId, userId);

  if (!conversation) {
    return { ok: false, error: "Conversation not found." };
  }

  const values = invoiceInsertValues(parsed.data, {
    userId,
    documentId,
  });
  const updateValues = {
    vendor: values.vendor,
    invoiceNumber: values.invoiceNumber,
    issueDate: values.issueDate,
    dueDate: values.dueDate,
    currency: values.currency,
    subtotal: values.subtotal,
    tax: values.tax,
    total: values.total,
    category: values.category,
    confidence: values.confidence,
    raw: values.raw,
  };

  try {
    const saved = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(invoices)
        .values(values)
        .onConflictDoUpdate({
          target: invoices.documentId,
          set: updateValues,
        })
        .returning();

      await tx.delete(lineItems).where(eq(lineItems.invoiceId, row.id));

      const lineItemValues = lineItemInsertValues(parsed.data, row.id);

      if (lineItemValues.length > 0) {
        await tx.insert(lineItems).values(lineItemValues);
      }

      await tx
        .insert(conversationInvoices)
        .values({
          conversationId,
          invoiceId: row.id,
        })
        .onConflictDoNothing();

      return row;
    });

    return {
      ok: true,
      invoiceId: saved.id,
      documentId: saved.documentId,
      vendor: saved.vendor,
      invoiceNumber: saved.invoiceNumber,
      total: saved.total,
      currency: saved.currency,
    };
  } catch (error) {
    console.error("Failed to save invoice", error);
    return { ok: false, error: "Could not save invoice." };
  }
}
