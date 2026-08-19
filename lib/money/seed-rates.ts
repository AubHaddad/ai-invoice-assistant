import { rateString, toDecimal } from "./precision";
import type { ExchangeRateQuote } from "./convert";

function invert(rate: string) {
  return rateString(toDecimal(1).div(rate));
}

function pair(
  from: string,
  to: string,
  rate: string,
  effectiveDate: string,
): ExchangeRateQuote[] {
  return [
    { fromCurrency: from, toCurrency: to, rate, effectiveDate },
    { fromCurrency: to, toCurrency: from, rate: invert(rate), effectiveDate },
  ];
}

function ratesOn(
  effectiveDate: string,
  quotes: { eurMad: string; usdMad: string },
): ExchangeRateQuote[] {
  const eurUsd = rateString(toDecimal(quotes.eurMad).div(quotes.usdMad));

  return [
    ...pair("EUR", "MAD", quotes.eurMad, effectiveDate),
    ...pair("USD", "MAD", quotes.usdMad, effectiveDate),
    ...pair("EUR", "USD", eurUsd, effectiveDate),
  ];
}

/** Admin FX table for MAD / EUR / USD. Amounts are 1 fromCurrency = rate toCurrency. */
export const SEEDED_EXCHANGE_RATES: ExchangeRateQuote[] = [
  ...ratesOn("2026-01-01", { eurMad: "10.85000000", usdMad: "10.05000000" }),
  ...ratesOn("2026-08-01", { eurMad: "10.92000000", usdMad: "9.98000000" }),
];
