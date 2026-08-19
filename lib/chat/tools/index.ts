import { calculateTool } from "./calculate";
import { categorizeExpenseTool } from "./categorize-expense";
import { convertCurrencyTool } from "./convert-currency";
import { extractInvoiceTool } from "./extract-invoice";
import { queryInvoicesTool } from "./query-invoices";

export const invoiceAssistantTools = {
  extractInvoice: extractInvoiceTool,
  queryInvoices: queryInvoicesTool,
  calculate: calculateTool,
  convertCurrency: convertCurrencyTool,
  categorizeExpense: categorizeExpenseTool,
};
