import { tool } from "ai";
import { executeTool } from "@/lib/chat/safe-tool";
import { calculate, CalculateInputSchema } from "@/lib/money/calculate";

export const calculateTool = tool({
  description:
    "Decimal-safe arithmetic for invoice amounts. Use for sums, averages, percentages, and VAT. Never compute money in your head — always call this tool. For Moroccan MAD VAT, pass rate 20, 10, or 7. Values for vat are exclusive (HT) amounts. Results are rounded to 2 decimal places, half-up.",
  inputSchema: CalculateInputSchema,
  execute: async (input) => executeTool("calculate", () => calculate(input)),
});
