import type { GenerateReportResult } from "@/lib/invoices/types";
import { formatMoney } from "@/lib/money/format";

const GROUP_LABEL = {
  category: "By category",
  month: "By month",
  vendor: "By vendor",
} as const;

const BAR_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

export function SpendingChart({ result }: { result: GenerateReportResult }) {
  const max = Math.max(...result.points.map((point) => point.amount), 0);

  return (
    <div className="w-full max-w-xl overflow-hidden rounded-3xl border bg-background text-sm">
      <div className="border-b px-3 py-2 text-muted-foreground">
        {GROUP_LABEL[result.groupBy]}
        {result.summary.count > 0
          ? ` · ${result.summary.count} invoice${result.summary.count === 1 ? "" : "s"} · ${formatMoney(result.summary.sum, result.summary.currency)}`
          : ""}
      </div>
      {result.points.length === 0 ? (
        <p className="px-3 py-2.5 text-muted-foreground">No spending data</p>
      ) : (
        <ul className="space-y-2.5 px-3 py-2.5">
          {result.points.map((point, index) => {
            const width = max > 0 ? Math.max((point.amount / max) * 100, 2) : 0;

            return (
              <li key={`${point.label}-${point.currency}`}>
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate">{point.label}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {formatMoney(point.amount, point.currency)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full ${BAR_COLORS[index % BAR_COLORS.length]}`}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
