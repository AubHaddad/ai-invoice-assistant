"use server";

import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/session";
import { InvoiceSchema } from "@/lib/schemas";
import { saveInvoice } from "./save";
import type { SaveInvoiceResult } from "./types";

const SaveInvoiceInputSchema = z.object({
  documentId: z.string().min(1),
  conversationId: z.string().min(1),
  invoice: InvoiceSchema,
});

export async function saveInvoiceAction(
  input: unknown,
): Promise<SaveInvoiceResult> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { ok: false, error: "Unauthorized" };
  }

  const parsed = SaveInvoiceInputSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Invoice data is invalid." };
  }

  return saveInvoice({
    userId,
    documentId: parsed.data.documentId,
    conversationId: parsed.data.conversationId,
    invoice: parsed.data.invoice,
  });
}
