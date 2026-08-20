import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/log-failure", () => ({
  logFailureToLangfuse: vi.fn(),
}));

import { calculateTool } from "./calculate";
import { CalculateInputSchema } from "@/lib/money/calculate";

async function runCalculate(
  input: unknown,
): Promise<Awaited<ReturnType<NonNullable<typeof calculateTool.execute>>>> {
  return calculateTool.execute!(input as never, {
    toolCallId: "calc-1",
    messages: [],
  } as never);
}

describe("CalculateInputSchema", () => {
  it("requires at least one finite value", () => {
    expect(
      CalculateInputSchema.safeParse({ operation: "sum", values: [] }).success,
    ).toBe(false);
    expect(
      CalculateInputSchema.safeParse({
        operation: "sum",
        values: [Number.POSITIVE_INFINITY],
      }).success,
    ).toBe(false);
  });

  it("rejects unknown operations and negative rates", () => {
    expect(
      CalculateInputSchema.safeParse({ operation: "multiply", values: [1] })
        .success,
    ).toBe(false);
    expect(
      CalculateInputSchema.safeParse({
        operation: "vat",
        values: [100],
        rate: -1,
      }).success,
    ).toBe(false);
  });
});

describe("calculate tool", () => {
  it("rounds half-up to two decimal places without binary float error", async () => {
    await expect(
      runCalculate({ operation: "sum", values: [0.1, 0.2] }),
    ).resolves.toMatchObject({
      ok: true,
      result: 0.3,
      rounding: "half-up",
      decimalPlaces: 2,
    });

    await expect(
      runCalculate({ operation: "sum", values: [10.105, 0.1] }),
    ).resolves.toMatchObject({
      ok: true,
      result: 10.21,
    });
  });

  it("computes Moroccan MAD VAT on exclusive amounts", async () => {
    await expect(
      runCalculate({ operation: "vat", values: [100], rate: 20 }),
    ).resolves.toMatchObject({
      ok: true,
      net: 100,
      vat: 20,
      gross: 120,
      result: 20,
    });
    await expect(
      runCalculate({ operation: "vat", values: [100], rate: 10 }),
    ).resolves.toMatchObject({ ok: true, vat: 10, gross: 110 });
    await expect(
      runCalculate({ operation: "vat", values: [100], rate: 7 }),
    ).resolves.toMatchObject({ ok: true, vat: 7, gross: 107 });
  });

  it("requires a rate for percent and vat", async () => {
    await expect(
      runCalculate({ operation: "percent", values: [200] }),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      runCalculate({ operation: "vat", values: [100] }),
    ).resolves.toMatchObject({ ok: false });
  });
});
