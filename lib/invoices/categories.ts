import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "software",
  "travel",
  "meals",
  "office",
  "telecom",
  "marketing",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  software: "Software",
  travel: "Travel",
  meals: "Meals",
  office: "Office",
  telecom: "Telecom",
  marketing: "Marketing",
  other: "Other",
};

export const ExpenseCategorySchema = z
  .enum(EXPENSE_CATEGORIES)
  .describe(
    "Expense category: software, travel, meals, office, telecom, marketing, or other",
  );

const categorySet = new Set<string>(EXPENSE_CATEGORIES);

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return categorySet.has(value);
}

export function parseExpenseCategory(value: unknown): ExpenseCategory | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return isExpenseCategory(normalized) ? normalized : null;
}

/** Classifier output must always be an enum member. Unknown values become other. */
export function clampExpenseCategory(value: unknown): ExpenseCategory {
  return parseExpenseCategory(value) ?? "other";
}

export const CategorizeExpenseInputSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1)
    .describe("What was purchased or billed, e.g. line items"),
  vendor: z.string().trim().min(1).describe("Vendor or merchant name"),
});

export type CategorizeExpenseInput = z.infer<
  typeof CategorizeExpenseInputSchema
>;

export const CategorizeExpenseOutputSchema = z.object({
  category: ExpenseCategorySchema,
  reason: z
    .string()
    .describe("One sentence explaining why this category was chosen"),
});

export type CategorizeExpenseOutput = z.infer<
  typeof CategorizeExpenseOutputSchema
>;

export type CategorizeExpenseSuccess = {
  ok: true;
  category: ExpenseCategory;
  reason: string;
  vendor: string;
  description: string;
};

export type CategorizeExpenseFailure = {
  ok: false;
  error: string;
};

export type CategorizeExpenseResult =
  | CategorizeExpenseSuccess
  | CategorizeExpenseFailure;

export type CategorizeExpenseFixture = CategorizeExpenseInput & {
  expected: ExpenseCategory;
};

/** Golden examples used in the classifier prompt and consistency tests. */
export const CATEGORIZE_TEST_SET: CategorizeExpenseFixture[] = [
  {
    vendor: "GitHub",
    description: "GitHub Enterprise Cloud seats — August",
    expected: "software",
  },
  {
    vendor: "Adobe",
    description: "Creative Cloud all apps subscription",
    expected: "software",
  },
  {
    vendor: "Royal Air Maroc",
    description: "Round-trip flight CMN-CDG",
    expected: "travel",
  },
  {
    vendor: "Marriott",
    description: "Hotel stay 3 nights, business trip",
    expected: "travel",
  },
  {
    vendor: "Cafe Clock",
    description: "Team lunch for 6 people",
    expected: "meals",
  },
  {
    vendor: "Restaurant Le Grand Comptoir",
    description: "Client dinner",
    expected: "meals",
  },
  {
    vendor: "IKEA",
    description: "Standing desk and office chair",
    expected: "office",
  },
  {
    vendor: "Staples",
    description: "Printer paper, pens, and toner",
    expected: "office",
  },
  {
    vendor: "Maroc Telecom",
    description: "Monthly fiber internet",
    expected: "telecom",
  },
  {
    vendor: "Orange",
    description: "Mobile plan for the team",
    expected: "telecom",
  },
  {
    vendor: "Google",
    description: "Google Ads campaign — Q3",
    expected: "marketing",
  },
  {
    vendor: "LinkedIn",
    description: "Sponsored job posts and ads",
    expected: "marketing",
  },
  {
    vendor: "Benani & Associates",
    description: "Legal retainer for contract review",
    expected: "other",
  },
  {
    vendor: "Green Thumb",
    description: "Office plant watering service",
    expected: "other",
  },
];
