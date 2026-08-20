import { describe, expect, it, vi } from "vitest";
import { ConvertCurrencyInputSchema } from "@/lib/money/convert";
import { SEEDED_EXCHANGE_RATES } from "@/lib/money/seed-rates";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/log-failure", () => ({
  logFailureToLangfuse: vi.fn(),
}));

const dbState = vi.hoisted(() => ({
  rates: [] as typeof SEEDED_EXCHANGE_RATES,
}));

vi.mock("@/lib/db", () => {
  function selectChain() {
    const chain = {
      from: () => chain,
      where: () => chain,
      then(
        resolve: (value: unknown) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        return Promise.resolve(dbState.rates).then(resolve, reject);
      },
    };
    return chain;
  }

  return {
    db: {
      select: vi.fn(() => selectChain()),
    },
  };
});

import { convertCurrencyTool } from "./convert-currency";

async function runConvert(
  input: unknown,
): Promise<Awaited<ReturnType<NonNullable<typeof convertCurrencyTool.execute>>>> {
  return convertCurrencyTool.execute!(input as never, {
    toolCallId: "fx-1",
    messages: [],
  } as never);
}

describe("ConvertCurrencyInputSchema", () => {
  it("accepts MAD/EUR/USD with an optional ISO date", () => {
    expect(
      ConvertCurrencyInputSchema.parse({
        amount: 100,
        fromCurrency: "EUR",
        toCurrency: "MAD",
        date: "2026-08-19",
      }),
    ).toMatchObject({ fromCurrency: "EUR", toCurrency: "MAD" });
  });

  it("rejects a missing amount or a non-ISO date", () => {
    expect(
      ConvertCurrencyInputSchema.safeParse({
        fromCurrency: "EUR",
        toCurrency: "MAD",
      }).success,
    ).toBe(false);
    expect(
      ConvertCurrencyInputSchema.safeParse({
        amount: 100,
        fromCurrency: "EUR",
        toCurrency: "MAD",
        date: "19/08/2026",
      }).success,
    ).toBe(false);
  });
});

describe("convertCurrency tool", () => {
  it("converts with the mocked rate table and cites the rate date", async () => {
    dbState.rates = SEEDED_EXCHANGE_RATES;

    await expect(
      runConvert({
        amount: 100,
        fromCurrency: "EUR",
        toCurrency: "MAD",
        date: "2026-08-19",
      }),
    ).resolves.toMatchObject({
      ok: true,
      amount: 1092,
      fromAmount: 100,
      rate: 10.92,
      rateDate: "2026-08-01",
      rounding: "half-up",
    });
  });

  it("returns the identity rate when currencies match", async () => {
    dbState.rates = SEEDED_EXCHANGE_RATES;

    await expect(
      runConvert({
        amount: 99.999,
        fromCurrency: "mad",
        toCurrency: "MAD",
        date: "2026-08-19",
      }),
    ).resolves.toMatchObject({
      ok: true,
      amount: 100,
      rate: 1,
    });
  });

  it("rejects currencies outside MAD, EUR, and USD without querying rates", async () => {
    dbState.rates = [];

    await expect(
      runConvert({
        amount: 10,
        fromCurrency: "GBP",
        toCurrency: "MAD",
        date: "2026-08-19",
      }),
    ).resolves.toMatchObject({ ok: false });
  });

  it("fails when the mocked table has no rate on or before the date", async () => {
    dbState.rates = SEEDED_EXCHANGE_RATES;

    await expect(
      runConvert({
        amount: 100,
        fromCurrency: "EUR",
        toCurrency: "MAD",
        date: "2025-12-31",
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: "No EUR/MAD rate on or before 2025-12-31.",
    });
  });
});
