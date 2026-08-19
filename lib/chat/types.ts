import type { UIMessage } from "ai";
import type {
  ExtractInvoiceResult,
  QueryInvoicesInput,
  QueryInvoicesResult,
} from "@/lib/invoices/types";

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
  queryInvoices: {
    input: QueryInvoicesInput;
    output: QueryInvoicesResult;
  };
};

export type InvoiceAssistantUIMessage = UIMessage<
  never,
  never,
  InvoiceAssistantTools
>;

