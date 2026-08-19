import { describe, expect, it } from "vitest";
import { convertCurrency } from "./convert";
import { SEEDED_EXCHANGE_RATES } from "./seed-rates";

describe("convertCurrency", () => {
  it("uses the rate effective on or before the given date", () => {
    const january = convertCurrency({
      amount: 100,
      fromCurrency: "EUR",
      toCurrency: "MAD",
      asOfDate: "2026-01-15",
      rates: SEEDED_EXCHANGE_RATES,
    });
    const august = convertCurrency({
      amount: 100,
      fromCurrency: "EUR",
      toCurrency: "MAD",
      asOfDate: "2026-08-19",
      rates: SEEDED_EXCHANGE_RATES,
    });

    expect(january).toMatchObject({
      ok: true,
      amount: 1085,
      fromAmount: 100,
      fromCurrency: "EUR",
      toCurrency: "MAD",
      rate: 10.85,
      rateDate: "2026-01-01",
      asOfDate: "2026-01-15",
    });
    expect(august).toMatchObject({
      ok: true,
      amount: 1092,
      fromAmount: 100,
      fromCurrency: "EUR",
      toCurrency: "MAD",
      rate: 10.92,
      rateDate: "2026-08-01",
      asOfDate: "2026-08-19",
    });
  });

  it("converts USD and MAD with the cited rate date", () => {
    const result = convertCurrency({
      amount: 250,
      fromCurrency: "USD",
      toCurrency: "MAD",
      asOfDate: "2026-08-19",
      rates: SEEDED_EXCHANGE_RATES,
    });

    expect(result).toMatchObject({
      ok: true,
      amount: 2495,
      rate: 9.98,
      rateDate: "2026-08-01",
    });
  });

  it("does not pick a later rate when the as-of date is earlier", () => {
    const result = convertCurrency({
      amount: 100,
      fromCurrency: "EUR",
      toCurrency: "MAD",
      asOfDate: "2026-07-31",
      rates: SEEDED_EXCHANGE_RATES,
    });

    expect(result).toMatchObject({
      ok: true,
      amount: 1085,
      rateDate: "2026-01-01",
    });
  });

  it("returns the identity rate when currencies match", () => {
    expect(
      convertCurrency({
        amount: 99.999,
        fromCurrency: "mad",
        toCurrency: "MAD",
        asOfDate: "2026-08-19",
        rates: SEEDED_EXCHANGE_RATES,
      }),
    ).toMatchObject({
      ok: true,
      amount: 100,
      rate: 1,
      rateExact: "1.00000000",
      rateDate: "2026-08-19",
    });
  });

  it("inverts a quoted pair when the direct rate is missing", () => {
    const result = convertCurrency({
      amount: 1085,
      fromCurrency: "MAD",
      toCurrency: "EUR",
      asOfDate: "2026-01-15",
      rates: [
        {
          fromCurrency: "EUR",
          toCurrency: "MAD",
          rate: "10.85000000",
          effectiveDate: "2026-01-01",
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.amount).toBe(100);
    expect(result.rateDate).toBe("2026-01-01");
    expect(result.rateExact).toBe("0.09216590");
  });

  it("fails when no rate exists on or before the date", () => {
    expect(
      convertCurrency({
        amount: 100,
        fromCurrency: "EUR",
        toCurrency: "MAD",
        asOfDate: "2025-12-31",
        rates: SEEDED_EXCHANGE_RATES,
      }),
    ).toMatchObject({
      ok: false,
      error: "No EUR/MAD rate on or before 2025-12-31.",
    });
  });

  it("rejects currencies outside MAD, EUR, and USD", () => {
    expect(
      convertCurrency({
        amount: 10,
        fromCurrency: "GBP",
        toCurrency: "MAD",
        asOfDate: "2026-08-19",
        rates: SEEDED_EXCHANGE_RATES,
      }),
    ).toMatchObject({ ok: false });
  });
});
