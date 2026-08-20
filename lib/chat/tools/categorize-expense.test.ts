import { generateObject } from "ai";
import { describe, expect, it, vi } from "vitest";
import {
  CategorizeExpenseInputSchema,
  EXPENSE_CATEGORIES,
} from "@/lib/invoices/categories";

vi.mock("server-only", () => ({}));
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateObject: vi.fn(),
  };
});
vi.mock("@/lib/ai/models", () => ({
  getModel: vi.fn(() => "fast-model"),
}));
vi.mock("@/lib/observability/log-failure", () => ({
  logFailureToLangfuse: vi.fn(),
}));

import { categorizeExpenseTool } from "./categorize-expense";

const generateObjectMock = vi.mocked(generateObject);

async function runCategorize(input: unknown) {
  return categorizeExpenseTool.execute!(input as never, {
    toolCallId: "cat-1",
    messages: [],
  } as never);
}

describe("CategorizeExpenseInputSchema", () => {
  it("requires a non-empty vendor and description", () => {
    expect(
      CategorizeExpenseInputSchema.safeParse({
        vendor: "GitHub",
        description: "Seats",
      }).success,
    ).toBe(true);
    expect(
      CategorizeExpenseInputSchema.safeParse({
        vendor: "  ",
        description: "Seats",
      }).success,
    ).toBe(false);
    expect(
      CategorizeExpenseInputSchema.safeParse({
        vendor: "GitHub",
        description: "",
      }).success,
    ).toBe(false);
  });
});

describe("categorizeExpense tool", () => {
  it("returns a category from the fixed enum", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: {
        category: "software",
        reason: "SaaS seats",
      },
    } as never);

    const result = await runCategorize({
      vendor: "GitHub",
      description: "Enterprise Cloud seats",
    });

    expect(result).toMatchObject({
      ok: true,
      category: "software",
      vendor: "GitHub",
    });
    expect(EXPENSE_CATEGORIES).toContain(
      (result as { category: string }).category,
    );
  });

  it("clamps model output outside the enum to other", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: {
        category: "legal",
        reason: "Retainer",
      },
    } as never);

    await expect(
      runCategorize({
        vendor: "Benani & Associates",
        description: "Legal retainer",
      }),
    ).resolves.toMatchObject({
      ok: true,
      category: "other",
    });
  });

  it("returns a validation error instead of calling the model", async () => {
    generateObjectMock.mockClear();

    await expect(
      runCategorize({ vendor: "", description: "Seats" }),
    ).resolves.toMatchObject({ ok: false });
    expect(generateObjectMock).not.toHaveBeenCalled();
  });
});
