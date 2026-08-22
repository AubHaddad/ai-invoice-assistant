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
  pinned: boolean;
  updatedAt: string;
};

export type ConversationUsage = {
  tokensIn: number;
  tokensOut: number;
  tokensCached: number;
  tokensCacheWrite: number;
  costUsd: number;
};

export const EMPTY_CONVERSATION_USAGE: ConversationUsage = {
  tokensIn: 0,
  tokensOut: 0,
  tokensCached: 0,
  tokensCacheWrite: 0,
  costUsd: 0,
};

export type ToolErrorResult = { error: string };

export type InvoiceAssistantTools = {
  extractInvoice: {
    input: { documentId: string };
    output: ExtractInvoiceResult | ToolErrorResult;
  };
  queryInvoices: {
    input: QueryInvoicesInput;
    output: QueryInvoicesResult | ToolErrorResult;
  };
  generateReport: {
    input: GenerateReportInput;
    output: GenerateReportResult | ToolErrorResult;
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

