import { tool } from "ai";
import { z } from "zod";
import "server-only";
import {
  generateReport,
  GenerateReportInputSchema,
} from "@/lib/invoices/report";

export const generateReportTool = tool({
  description:
    "Build a spending report for a chart. period is the current calendar month, quarter, or year. groupBy is category or vendor. Optional currency converts every amount to MAD, EUR, or USD; otherwise the most common invoice currency in the period is used. Totals are aggregated in SQL and converted to one currency. Use this for monthly/quarterly/yearly reports or spend charts (e.g. “Give me my monthly report by category”). Report only the rows and total this tool returns. Already scoped to the signed-in user.",
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
