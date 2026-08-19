import type { UIMessage } from "ai";
import type { ExtractInvoiceResult } from "@/lib/invoices/types";

export type ConversationSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
};

export type InvoiceAssistantTools = {
  extractInvoice: {
    input: { documentId: string };
    output: ExtractInvoiceResult;
  };
};

export type InvoiceAssistantUIMessage = UIMessage<
  never,
  never,
  InvoiceAssistantTools
>;

