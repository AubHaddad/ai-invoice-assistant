import { tool } from "ai";
import { z } from "zod";
import "server-only";
import { executeTool } from "@/lib/chat/safe-tool";
import {
  generateReport,
  GenerateReportInputSchema,
} from "@/lib/invoices/report";

export const generateReportTool = tool({
  description:
    "Build a spending report for a chart. period is month, quarter, or year. Pass year when the user names a year (e.g. 2024); pass month (1–12) or quarter (1–4) for a specific month or quarter. Defaults to the current calendar window. groupBy is category or vendor. Optional currency converts every amount to MAD, EUR, or USD; otherwise the most common invoice currency in the period is used. Totals are aggregated in SQL and converted to one currency. Use this for monthly/quarterly/yearly reports or spend charts (e.g. “Give me my 2024 report by category”). Report only the rows and total this tool returns. Already scoped to the signed-in user.",
  inputSchema: GenerateReportInputSchema,
  contextSchema: z.object({
    userId: z.string(),
  }),
  execute: async (filters, { context }) => {
    return executeTool("generateReport", () =>
      generateReport({
        userId: context.userId,
        filters,
      }),
    );
  },
});
