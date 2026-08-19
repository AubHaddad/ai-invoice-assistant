"use client";

import type { CalculateResult } from "@/lib/money/calculate";

function formatAmount(value: number) {
  return value.toFixed(2);
}

const OPERATION_LABEL: Record<
  Extract<CalculateResult, { ok: true }>["operation"],
  string
> = {
  sum: "Sum",
  avg: "Average",
  percent: "Percent",
  vat: "VAT",
};

export function CalculateCard({ result }: { result: CalculateResult }) {
  if (!result.ok) {
    return <p className="text-sm text-destructive">{result.error}</p>;
  }

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-3xl border bg-background text-sm">
      <div className="border-b px-3 py-2 text-muted-foreground">
        {OPERATION_LABEL[result.operation]}
        {result.rate != null ? ` · ${result.rate}%` : ""}
        {` · ${result.values.length} value${result.values.length === 1 ? "" : "s"}`}
      </div>
      <div className="px-3 py-2.5">
        {result.operation === "vat" &&
        result.net != null &&
        result.vat != null &&
        result.gross != null ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
            <dt className="text-muted-foreground">Net</dt>
            <dd className="text-right tabular-nums">{formatAmount(result.net)}</dd>
            <dt className="text-muted-foreground">VAT</dt>
            <dd className="text-right tabular-nums">{formatAmount(result.vat)}</dd>
            <dt className="font-medium">Gross</dt>
            <dd className="text-right font-medium tabular-nums">
              {formatAmount(result.gross)}
            </dd>
          </dl>
        ) : (
          <p className="text-right text-base font-medium tabular-nums">
            {formatAmount(result.result)}
          </p>
        )}
      </div>
    </div>
  );
}
