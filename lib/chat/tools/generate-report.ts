import { tool } from "ai";
import { z } from "zod";
import "server-only";
import {
  generateReport,
  GenerateReportInputSchema,
} from "@/lib/invoices/report";

export const generateReportTool = tool({
  description:
    "Build a spending breakdown for a chart, grouped by category, calendar month, or vendor. Use this when the user asks for spend by category, over time, or by vendor, or wants a report or chart. Apply the same invoice filters as queryInvoices. Do not invent series — only report the groups this tool returns. Mixed currencies are split into separate points and are not added together. The tool is already scoped to the signed-in user.",
  inputSchema: GenerateReportInputSchema,
  contextSchema: z.object({
    userId: z.string(),
  }),
  execute: async (filters, { context }) => {
    return generateReport({
      userId: context.userId,
      filters,
    });
  },
});
