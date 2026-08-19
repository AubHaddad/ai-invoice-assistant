import { tool } from "ai";
import "server-only";
import { executeTool } from "@/lib/chat/safe-tool";
import { convertCurrencyFromDb } from "@/lib/db/exchange-rates";
import { ConvertCurrencyInputSchema } from "@/lib/money/convert";

export const convertCurrencyTool = tool({
  description:
    "Convert an amount between MAD, EUR, and USD using the dated rate table. Pass date (YYYY-MM-DD) to use the rate effective on or before that day (invoice issue date). Defaults to today. Always cite the returned rate and rateDate in the answer. Never invent an exchange rate.",
  inputSchema: ConvertCurrencyInputSchema,
  execute: async (input) =>
    executeTool("convertCurrency", () => convertCurrencyFromDb(input)),
});
