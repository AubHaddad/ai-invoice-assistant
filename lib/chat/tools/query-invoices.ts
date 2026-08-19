import { tool } from "ai";
import { z } from "zod";
import "server-only";
import {
  queryInvoices,
  QueryInvoicesInputSchema,
} from "@/lib/invoices/query";

export const queryInvoicesTool = tool({
  description:
    "Search the user's saved invoices with structured filters. Use this when they ask about invoices by vendor, date range, category, amount, or currency. Category must be one of software, travel, meals, office, telecom, marketing, or other. For a month like June, set dateFrom and dateTo to that month's first and last day. Never invent invoice data — only report what this tool returns. The tool is already scoped to the signed-in user.",
  inputSchema: QueryInvoicesInputSchema,
  contextSchema: z.object({
    userId: z.string(),
  }),
  execute: async (filters, { context }) => {
    return queryInvoices({
      userId: context.userId,
      filters,
    });
  },
});
