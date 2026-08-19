"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  invoiceCount,
  REPORT_GROUP_LABELS,
  REPORT_PERIOD_LABELS,
  reportCsvFileName,
  reportToCsv,
} from "@/lib/invoices/report-utils";
import type { GenerateReportResult, ReportRow } from "@/lib/invoices/types";
import { formatMoney } from "@/lib/money/format";

const CHART_COLORS = [
  "var(--primary)",
  "oklch(0.62 0.12 200)",
  "oklch(0.58 0.11 145)",
  "oklch(0.64 0.12 300)",
  "oklch(0.68 0.12 80)",
  "oklch(0.55 0.13 25)",
  "oklch(0.52 0.08 250)",
];

function ChartTooltip({
  active,
  payload,
  currency,
}: Pick<TooltipContentProps, "active" | "payload"> & { currency: string }) {
  const row = payload[0]?.payload as ReportRow | undefined;

  if (!active || !row) {
    return null;
  }

  return (
    <div className="rounded-xl border bg-background px-2.5 py-1.5 text-xs shadow-sm">
      <p>{row.label}</p>
      <p className="tabular-nums text-muted-foreground">
        {formatMoney(row.amount, currency)}
        {` · ${row.count} invoice${row.count === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}

function downloadCsv(result: GenerateReportResult) {
  const blob = new Blob([reportToCsv(result)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = reportCsvFileName(result);
  link.click();
  URL.revokeObjectURL(url);
}

export function SpendingChart({ result }: { result: GenerateReportResult }) {
  const [view, setView] = useState<"bar" | "pie">("bar");
  const count = invoiceCount(result.rows);
  const groupLabel = REPORT_GROUP_LABELS[result.groupBy];

  return (
    <div className="w-full max-w-xl overflow-hidden rounded-3xl border bg-background text-sm">
      <div className="flex items-start justify-between gap-3 border-b px-3 py-2">
        <div className="min-w-0">
          <p className="text-muted-foreground">
            {REPORT_PERIOD_LABELS[result.period]} report by {groupLabel}
          </p>
          <p className="tabular-nums text-muted-foreground">
            {result.dateFrom} – {result.dateTo}
            {count > 0
              ? ` · ${count} invoice${count === 1 ? "" : "s"} · ${formatMoney(result.total, result.currency)}`
              : ""}
          </p>
        </div>
        {result.rows.length > 0 ? (
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              size="xs"
              variant={view === "bar" ? "secondary" : "ghost"}
              aria-pressed={view === "bar"}
              onClick={() => setView("bar")}
            >
              Bar
            </Button>
            <Button
              type="button"
              size="xs"
              variant={view === "pie" ? "secondary" : "ghost"}
              aria-pressed={view === "pie"}
              onClick={() => setView("pie")}
            >
              Pie
            </Button>
          </div>
        ) : null}
      </div>

      {result.rows.length === 0 ? (
        <p className="px-3 py-2.5 text-muted-foreground">No spending data</p>
      ) : (
        <>
          <div className="h-60 px-2 py-2">
            <ResponsiveContainer width="100%" height="100%">
              {view === "bar" ? (
                <BarChart
                  data={result.rows}
                  margin={{ top: 8, right: 8, left: 4, bottom: 8 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <YAxis
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                    tickFormatter={(value: number) =>
                      formatMoney(value, result.currency)
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    content={(props) => (
                      <ChartTooltip {...props} currency={result.currency} />
                    )}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {result.rows.map((row, index) => (
                      <Cell
                        key={row.key}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <PieChart>
                  <Pie
                    data={result.rows}
                    dataKey="amount"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {result.rows.map((row, index) => (
                      <Cell
                        key={row.key}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={(props) => (
                      <ChartTooltip {...props} currency={result.currency} />
                    )}
                  />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>

          <table className="w-full border-collapse border-t text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-1.5 font-medium">
                  {result.groupBy === "vendor" ? "Vendor" : "Category"}
                </th>
                <th className="px-3 py-1.5 text-right font-medium">Invoices</th>
                <th className="px-3 py-1.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, index) => (
                <tr key={row.key} className="border-t">
                  <td className="px-3 py-1.5">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            CHART_COLORS[index % CHART_COLORS.length],
                        }}
                      />
                      {row.label}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {row.count}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {formatMoney(row.amount, result.currency)}
                  </td>
                </tr>
              ))}
              <tr className="border-t">
                <td className="px-3 py-1.5 font-medium">Total</td>
                <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                  {count}
                </td>
                <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                  {formatMoney(result.total, result.currency)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="border-t px-3 py-2">
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => downloadCsv(result)}
            >
              <DownloadIcon data-icon="inline-start" />
              Download CSV
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
