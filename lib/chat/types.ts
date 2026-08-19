import type { UIMessage } from "ai";
import type {
  CalculateInput,
  CalculateResult,
} from "@/lib/money/calculate";
import type {
  ConvertCurrencyInput,
  ConvertCurrencyResult,
} from "@/lib/money/convert";
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
  calculate: {
    input: CalculateInput;
    output: CalculateResult;
  };
  convertCurrency: {
    input: ConvertCurrencyInput;
    output: ConvertCurrencyResult;
  };
};

export type InvoiceAssistantUIMessage = UIMessage<
  never,
  never,
  InvoiceAssistantTools
>;

