import { tool } from "ai";
import { z } from "zod";
import "server-only";
import { executeTool } from "@/lib/chat/safe-tool";
import { extractInvoiceFromDocument } from "@/lib/invoices/extract";

export const extractInvoiceTool = tool({
  description:
    "Extract structured invoice fields from an uploaded PDF or image, including multi-page documents. Use this after the user uploads an invoice or asks about a document. Pass the document id from the uploaded documents list.",
  inputSchema: z.object({
    documentId: z
      .string()
      .describe("ID of the uploaded document to extract"),
  }),
  contextSchema: z.object({
    userId: z.string(),
  }),
  execute: async ({ documentId }, { context, abortSignal }) => {
    return executeTool("extractInvoice", () =>
      extractInvoiceFromDocument({
        documentId,
        userId: context.userId,
        abortSignal,
      }),
    );
  },
});
