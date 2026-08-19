import { calculateTool } from "./calculate";
import { categorizeExpenseTool } from "./categorize-expense";
import { convertCurrencyTool } from "./convert-currency";
import { extractInvoiceTool } from "./extract-invoice";
import { generateReportTool } from "./generate-report";
import { queryInvoicesTool } from "./query-invoices";

export const invoiceAssistantTools = {
  extractInvoice: extractInvoiceTool,
  queryInvoices: queryInvoicesTool,
  generateReport: generateReportTool,
  calculate: calculateTool,
  convertCurrency: convertCurrencyTool,
  categorizeExpense: categorizeExpenseTool,
};
