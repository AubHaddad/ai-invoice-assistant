import { extractInvoiceTool } from "./extract-invoice";
import { queryInvoicesTool } from "./query-invoices";

export const invoiceAssistantTools = {
  extractInvoice: extractInvoiceTool,
  queryInvoices: queryInvoicesTool,
};
