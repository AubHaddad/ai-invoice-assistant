import { and, eq, lte, or } from "drizzle-orm";
import "server-only";
import { db } from "@/lib/db";
import { exchangeRates } from "@/lib/db/schema";
import {
  convertCurrency,
  ConvertCurrencyInputSchema,
  todayIsoDate,
  type ConvertCurrencyInput,
  type ConvertCurrencyResult,
  type ExchangeRateQuote,
} from "@/lib/money/convert";
import {
  isSupportedCurrency,
  normalizeCurrency,
  SUPPORTED_CURRENCIES,
} from "@/lib/money/currencies";

export async function loadExchangeRatesOnOrBefore(
  asOfDate: string,
): Promise<ExchangeRateQuote[]> {
  return db
    .select({
      fromCurrency: exchangeRates.fromCurrency,
      toCurrency: exchangeRates.toCurrency,
      rate: exchangeRates.rate,
      effectiveDate: exchangeRates.effectiveDate,
    })
    .from(exchangeRates)
    .where(lte(exchangeRates.effectiveDate, asOfDate));
}

export async function convertCurrencyFromDb(
  input: ConvertCurrencyInput,
): Promise<ConvertCurrencyResult> {
  const parsed = ConvertCurrencyInputSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const fromCurrency = normalizeCurrency(parsed.data.fromCurrency);
  const toCurrency = normalizeCurrency(parsed.data.toCurrency);
  const asOfDate = parsed.data.date ?? todayIsoDate();

  if (!isSupportedCurrency(fromCurrency) || !isSupportedCurrency(toCurrency)) {
    return {
      ok: false,
      error: `Unsupported currency. Use ${SUPPORTED_CURRENCIES.join(", ")}.`,
    };
  }

  const rows = await db
    .select({
      fromCurrency: exchangeRates.fromCurrency,
      toCurrency: exchangeRates.toCurrency,
      rate: exchangeRates.rate,
      effectiveDate: exchangeRates.effectiveDate,
    })
    .from(exchangeRates)
    .where(
      and(
        lte(exchangeRates.effectiveDate, asOfDate),
        or(
          and(
            eq(exchangeRates.fromCurrency, fromCurrency),
            eq(exchangeRates.toCurrency, toCurrency),
          ),
          and(
            eq(exchangeRates.fromCurrency, toCurrency),
            eq(exchangeRates.toCurrency, fromCurrency),
          ),
        ),
      ),
    );

  return convertCurrency({
    amount: parsed.data.amount,
    fromCurrency,
    toCurrency,
    asOfDate,
    rates: rows,
  });
}
