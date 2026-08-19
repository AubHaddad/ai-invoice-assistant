"use client";

import type { ConvertCurrencyResult } from "@/lib/money/convert";

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function CurrencyConversionCard({
  result,
}: {
  result: ConvertCurrencyResult;
}) {
  if (!result.ok) {
    return <p className="text-sm text-destructive">{result.error}</p>;
  }

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-3xl border bg-background text-sm">
      <div className="border-b px-3 py-2 text-muted-foreground">
        {result.fromCurrency} → {result.toCurrency}
      </div>
      <div className="px-3 py-2.5">
        <p className="text-right text-base font-medium tabular-nums">
          {formatMoney(result.amount, result.toCurrency)}
        </p>
        <p className="mt-1 text-right text-muted-foreground">
          {formatMoney(result.fromAmount, result.fromCurrency)} at {result.rateExact}
        </p>
        <p className="mt-0.5 text-right text-xs text-muted-foreground">
          Rate date {result.rateDate}
        </p>
      </div>
    </div>
  );
}
