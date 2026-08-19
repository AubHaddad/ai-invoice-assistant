import { tool } from "ai";
import "server-only";
import { categorizeExpense } from "@/lib/invoices/categorize";
import { CategorizeExpenseInputSchema } from "@/lib/invoices/categories";

export const categorizeExpenseTool = tool({
  description:
    "Classify a business expense into a fixed category: software, travel, meals, office, telecom, marketing, or other. Pass a short description (line items or what was billed) and the vendor. Always call this instead of inventing a category. The result is always one of those seven values.",
  inputSchema: CategorizeExpenseInputSchema,
  execute: async (input, { abortSignal }) => {
    return categorizeExpense(input, { abortSignal });
  },
});
