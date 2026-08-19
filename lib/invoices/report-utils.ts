import {
  EXPENSE_CATEGORY_LABELS,
  parseExpenseCategory,
} from "./categories";
import { convertCurrency, type ExchangeRateQuote } from "@/lib/money/convert";
import {
  isSupportedCurrency,
  normalizeCurrency,
} from "@/lib/money/currencies";
import { roundMoney } from "@/lib/money/precision";
import type {
  GenerateReportInput,
  GenerateReportResult,
  ReportGroupBy,
  ReportPeriod,
  ReportRow,
} from "./types";

export const REPORT_PERIOD_LABELS: Record<ReportPeriod, string> = {
  month: "Monthly",
  quarter: "Quarterly",
  year: "Yearly",
};

export const REPORT_GROUP_LABELS: Record<ReportGroupBy, string> = {
  category: "category",
  vendor: "vendor",
};

export type ReportGroup = {
  key: string;
  currency: string;
  count: number;
  sum: number;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function periodRange(
  period: ReportPeriod,
  asOfDate: string,
): { dateFrom: string; dateTo: string } {
  const [year, month] = asOfDate.split("-").map(Number);

  if (period === "month") {
    return {
      dateFrom: isoDate(year, month, 1),
      dateTo: isoDate(year, month, lastDayOfMonth(year, month)),
    };
  }

  if (period === "quarter") {
    const startMonth = Math.floor((month - 1) / 3) * 3 + 1;
    const endMonth = startMonth + 2;
    return {
      dateFrom: isoDate(year, startMonth, 1),
      dateTo: isoDate(year, endMonth, lastDayOfMonth(year, endMonth)),
    };
  }

  return {
    dateFrom: isoDate(year, 1, 1),
    dateTo: isoDate(year, 12, 31),
  };
}

export function conversionAsOfDate(dateTo: string, today: string) {
  return dateTo < today ? dateTo : today;
}

export function reportGroupLabel(groupBy: ReportGroupBy, key: string) {
  if (groupBy === "category") {
    const category = parseExpenseCategory(key);
    return category ? EXPENSE_CATEGORY_LABELS[category] : "Uncategorized";
  }

  return key;
}

export function pickTargetCurrency(
  groups: ReportGroup[],
  requested?: string,
) {
  if (requested) {
    return normalizeCurrency(requested);
  }

  if (groups.length === 0) {
    return "USD";
  }

  const totals = new Map<string, { count: number; sum: number }>();

  for (const group of groups) {
    const currency = normalizeCurrency(group.currency);
    const current = totals.get(currency) ?? { count: 0, sum: 0 };
    current.count += group.count;
    current.sum = roundMoney(current.sum + group.sum);
    totals.set(currency, current);
  }

  return [...totals.entries()]
    .sort(([leftCurrency, left], [rightCurrency, right]) => {
      return (
        right.count - left.count ||
        right.sum - left.sum ||
        leftCurrency.localeCompare(rightCurrency)
      );
    })[0][0];
}

export function invoiceCount(rows: ReportRow[]) {
  return rows.reduce((total, row) => total + row.count, 0);
}

export function buildReportResult({
  input,
  dateFrom,
  dateTo,
  groups,
  rates,
  asOfDate,
}: {
  input: GenerateReportInput;
  dateFrom: string;
  dateTo: string;
  groups: ReportGroup[];
  rates: ExchangeRateQuote[];
  asOfDate: string;
}): { ok: true; report: GenerateReportResult } | { ok: false; error: string } {
  const currency = pickTargetCurrency(groups, input.currency);

  if (!isSupportedCurrency(currency)) {
    return {
      ok: false,
      error: `Unsupported currency. Use MAD, EUR, or USD.`,
    };
  }

  const merged = new Map<string, ReportRow>();

  for (const group of groups) {
    const converted = convertCurrency({
      amount: group.sum,
      fromCurrency: group.currency,
      toCurrency: currency,
      asOfDate,
      rates,
    });

    if (!converted.ok) {
      return converted;
    }

    const existing = merged.get(group.key);
    const amount = roundMoney((existing?.amount ?? 0) + converted.amount);
    const count = (existing?.count ?? 0) + group.count;

    merged.set(group.key, {
      key: group.key,
      label: reportGroupLabel(input.groupBy, group.key),
      amount,
      count,
    });
  }

  const rows = [...merged.values()].sort(
    (left, right) =>
      right.amount - left.amount || left.label.localeCompare(right.label),
  );

  return {
    ok: true,
    report: {
      period: input.period,
      groupBy: input.groupBy,
      dateFrom,
      dateTo,
      rows,
      total: roundMoney(rows.reduce((sum, row) => sum + row.amount, 0)),
      currency,
    },
  };
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function csvLine(values: Array<string | number>) {
  return values.map((value) => csvEscape(String(value))).join(",");
}

export function reportToCsv(result: GenerateReportResult) {
  const groupHeader = result.groupBy === "vendor" ? "Vendor" : "Category";
  const lines = [
    csvLine([groupHeader, "Amount", "Invoices", "Currency"]),
    ...result.rows.map((row) =>
      csvLine([row.label, row.amount.toFixed(2), row.count, result.currency]),
    ),
    csvLine([
      "Total",
      result.total.toFixed(2),
      invoiceCount(result.rows),
      result.currency,
    ]),
  ];

  return `${lines.join("\n")}\n`;
}

export function reportCsvFileName(result: GenerateReportResult) {
  return `spending-${result.period}-by-${result.groupBy}.csv`;
}
