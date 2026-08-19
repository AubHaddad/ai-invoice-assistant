import { generateObject } from "ai";
import "server-only";
import { getModel } from "@/lib/ai/models";
import { toPublicErrorMessage } from "@/lib/chat/error-message";
import { AGENT_TIMEOUT } from "@/lib/chat/loop";
import { logFailureToLangfuse } from "@/lib/observability/log-failure";
import { abortAfter } from "@/lib/timeout";
import {
  CATEGORIZE_TEST_SET,
  CategorizeExpenseInputSchema,
  CategorizeExpenseOutputSchema,
  clampExpenseCategory,
  EXPENSE_CATEGORIES,
  type CategorizeExpenseInput,
  type CategorizeExpenseResult,
} from "./categories";

const CATEGORY_LIST = EXPENSE_CATEGORIES.join(", ");

const FEW_SHOT = CATEGORIZE_TEST_SET.map(
  (example) =>
    `- Vendor: ${example.vendor}. Description: ${example.description}. Category: ${example.expected}.`,
).join("\n");

export const CATEGORIZE_INSTRUCTIONS = `Classify a business expense into exactly one category: ${CATEGORY_LIST}.

Rules:
- software: SaaS, licenses, cloud seats, developer tools, IT subscriptions.
- travel: flights, hotels, trains, taxis, mileage, trip lodging.
- meals: restaurants, cafes, catering, client or team food and drink.
- office: furniture, stationery, supplies, equipment for the workplace.
- telecom: mobile plans, internet, phone, connectivity.
- marketing: ads, campaigns, sponsorships, promotional spend.
- other: anything that does not clearly fit the categories above, including legal, insurance, facilities services, and mixed or ambiguous spend.

Always return one of those seven values. If unsure, use other.
Do not invent a new category.

Examples:
${FEW_SHOT}`;

export async function categorizeExpense(
  input: CategorizeExpenseInput,
  options?: { abortSignal?: AbortSignal },
): Promise<CategorizeExpenseResult> {
  const parsed = CategorizeExpenseInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { description, vendor } = parsed.data;

  try {
    const { object } = await generateObject({
      model: getModel("fast"),
      schema: CategorizeExpenseOutputSchema,
      schemaName: "ExpenseCategory",
      schemaDescription: `Business expense category. Must be one of: ${CATEGORY_LIST}.`,
      instructions: CATEGORIZE_INSTRUCTIONS,
      prompt: `Vendor: ${vendor}\nDescription: ${description}`,
      temperature: 0,
      maxRetries: 0,
      abortSignal: abortAfter(
        AGENT_TIMEOUT.tools.categorizeExpenseMs,
        options?.abortSignal,
      ),
      telemetry: {
        functionId: "categorize-expense",
      },
    });

    return {
      ok: true,
      category: clampExpenseCategory(object.category),
      reason: object.reason.trim(),
      vendor,
      description,
    };
  } catch (error) {
    console.error("Expense categorization failed", error);
    logFailureToLangfuse({
      source: "provider",
      error,
      extra: { tool: "categorizeExpense" },
    });
    return {
      ok: false,
      error: toPublicErrorMessage(error, "Could not categorize expense."),
    };
  }
}

export function descriptionFromLineItems(
  lineItems: Array<{ description: string }>,
  fallback: string,
) {
  const joined = lineItems
    .map((item) => item.description.trim())
    .filter(Boolean)
    .join("; ");

  return joined || fallback;
}
