import { z } from "zod";
import {
  isSupportedCurrency,
  normalizeCurrency,
  SUPPORTED_CURRENCIES,
} from "./currencies";
import {
  MONEY_DECIMAL_PLACES,
  rateString,
  roundMoney,
  roundRate,
  toDecimal,
} from "./precision";

export const ConvertCurrencyInputSchema = z.object({
  amount: z.number().finite().describe("Amount in fromCurrency"),
  fromCurrency: z
    .string()
    .trim()
    .min(1)
    .describe("ISO 4217 code to convert from (MAD, EUR, or USD)"),
  toCurrency: z
    .string()
    .trim()
    .min(1)
    .describe("ISO 4217 code to convert to (MAD, EUR, or USD)"),
  date: z.iso
    .date()
    .optional()
    .describe(
      "ISO date (YYYY-MM-DD) to pick the rate effective on or before that day. Defaults to today.",
    ),
});

export type ConvertCurrencyInput = z.infer<typeof ConvertCurrencyInputSchema>;

export type ExchangeRateQuote = {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  effectiveDate: string;
};

export type ConvertCurrencySuccess = {
  ok: true;
  amount: number;
  fromAmount: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  rateExact: string;
  rateDate: string;
  asOfDate: string;
  decimalPlaces: typeof MONEY_DECIMAL_PLACES;
  rounding: "half-up";
};

export type ConvertCurrencyFailure = {
  ok: false;
  error: string;
};

export type ConvertCurrencyResult =
  | ConvertCurrencySuccess
  | ConvertCurrencyFailure;

export function todayIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function latestOnOrBefore(
  quotes: ExchangeRateQuote[],
  fromCurrency: string,
  toCurrency: string,
  asOfDate: string,
) {
  return quotes
    .filter(
      (quote) =>
        quote.fromCurrency === fromCurrency &&
        quote.toCurrency === toCurrency &&
        quote.effectiveDate <= asOfDate,
    )
    .sort((left, right) => right.effectiveDate.localeCompare(left.effectiveDate))[0];
}

export function resolveRate({
  fromCurrency,
  toCurrency,
  asOfDate,
  rates,
}: {
  fromCurrency: string;
  toCurrency: string;
  asOfDate: string;
  rates: ExchangeRateQuote[];
}): { rate: ReturnType<typeof toDecimal>; rateDate: string } | null {
  if (fromCurrency === toCurrency) {
    return { rate: toDecimal(1), rateDate: asOfDate };
  }

  const direct = latestOnOrBefore(rates, fromCurrency, toCurrency, asOfDate);

  if (direct) {
    return { rate: toDecimal(direct.rate), rateDate: direct.effectiveDate };
  }

  const inverse = latestOnOrBefore(rates, toCurrency, fromCurrency, asOfDate);

  if (inverse) {
    return {
      rate: toDecimal(1).div(inverse.rate),
      rateDate: inverse.effectiveDate,
    };
  }

  return null;
}

export function convertCurrency({
  amount,
  fromCurrency,
  toCurrency,
  asOfDate,
  rates,
}: {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  asOfDate: string;
  rates: ExchangeRateQuote[];
}): ConvertCurrencyResult {
  const from = normalizeCurrency(fromCurrency);
  const to = normalizeCurrency(toCurrency);

  if (!isSupportedCurrency(from) || !isSupportedCurrency(to)) {
    return {
      ok: false,
      error: `Unsupported currency. Use ${SUPPORTED_CURRENCIES.join(", ")}.`,
    };
  }

  const resolved = resolveRate({
    fromCurrency: from,
    toCurrency: to,
    asOfDate,
    rates: rates.map((quote) => ({
      ...quote,
      fromCurrency: normalizeCurrency(quote.fromCurrency),
      toCurrency: normalizeCurrency(quote.toCurrency),
    })),
  });

  if (!resolved) {
    return {
      ok: false,
      error: `No ${from}/${to} rate on or before ${asOfDate}.`,
    };
  }

  const fromAmount = roundMoney(amount);
  const converted = roundMoney(toDecimal(fromAmount).times(resolved.rate));

  return {
    ok: true,
    amount: converted,
    fromAmount,
    fromCurrency: from,
    toCurrency: to,
    rate: roundRate(resolved.rate),
    rateExact: rateString(resolved.rate),
    rateDate: resolved.rateDate,
    asOfDate,
    decimalPlaces: MONEY_DECIMAL_PLACES,
    rounding: "half-up",
  };
}
