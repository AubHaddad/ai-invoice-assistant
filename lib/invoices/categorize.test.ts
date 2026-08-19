import { generateObject } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CATEGORIZE_TEST_SET,
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from "./categories";

vi.mock("server-only", () => ({}));
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));
vi.mock("@/lib/ai/models", () => ({
  getModel: vi.fn(() => "fast-model"),
}));

import { getModel } from "@/lib/ai/models";
import { categorizeExpense, descriptionFromLineItems } from "./categorize";

const generateObjectMock = vi.mocked(generateObject);

describe("categorizeExpense", () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
  });

  it("classifies the test set with generateObject on the fast tier", async () => {
    for (const fixture of CATEGORIZE_TEST_SET) {
      generateObjectMock.mockResolvedValueOnce({
        object: {
          category: fixture.expected,
          reason: `Matches ${fixture.expected}`,
        },
      } as never);

      const result = await categorizeExpense(fixture);

      expect(getModel).toHaveBeenCalledWith("fast");
      expect(result).toMatchObject({
        ok: true,
        category: fixture.expected,
        vendor: fixture.vendor,
        description: fixture.description,
      });
      expect(EXPENSE_CATEGORIES).toContain(
        (result as { category: ExpenseCategory }).category,
      );
    }
  });

  it("clamps model output that falls outside the enum", async () => {
    generateObjectMock.mockResolvedValueOnce({
      object: {
        category: "legal",
        reason: "Contract work",
      },
    } as never);

    const result = await categorizeExpense({
      vendor: "Benani & Associates",
      description: "Legal retainer",
    });

    expect(result).toMatchObject({
      ok: true,
      category: "other",
    });
  });

  it("returns an error instead of an invalid category when generation fails", async () => {
    generateObjectMock.mockRejectedValueOnce(new Error("provider down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await categorizeExpense({
      vendor: "GitHub",
      description: "Enterprise seats",
    });

    expect(result).toEqual({
      ok: false,
      error: "provider down",
    });
    errorSpy.mockRestore();
  });
});

describe("descriptionFromLineItems", () => {
  it("joins line item text and falls back to the vendor", () => {
    expect(
      descriptionFromLineItems(
        [{ description: "Seats" }, { description: "Support" }],
        "GitHub",
      ),
    ).toBe("Seats; Support");
    expect(descriptionFromLineItems([], "GitHub")).toBe("GitHub");
  });
});
