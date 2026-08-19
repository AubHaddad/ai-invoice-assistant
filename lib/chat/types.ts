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
  CategorizeExpenseInput,
  CategorizeExpenseResult,
} from "@/lib/invoices/categories";
import type {
  ExtractInvoiceResult,
  GenerateReportInput,
  GenerateReportResult,
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
  generateReport: {
    input: GenerateReportInput;
    output: GenerateReportResult;
  };
  calculate: {
    input: CalculateInput;
    output: CalculateResult;
  };
  convertCurrency: {
    input: ConvertCurrencyInput;
    output: ConvertCurrencyResult;
  };
  categorizeExpense: {
    input: CategorizeExpenseInput;
    output: CategorizeExpenseResult;
  };
};

export type InvoiceAssistantUIMessage = UIMessage<
  never,
  never,
  InvoiceAssistantTools
>;

