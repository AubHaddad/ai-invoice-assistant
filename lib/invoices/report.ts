import { count, sql, sum } from "drizzle-orm";
import "server-only";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema";
import {
  EXPENSE_CATEGORY_LABELS,
  parseExpenseCategory,
} from "./categories";
import { roundMoney } from "./postprocess";
import { invoiceWhere } from "./query";
import {
  GenerateReportInputSchema,
  type GenerateReportInput,
  type GenerateReportResult,
  type ReportGroupBy,
} from "./types";

export type { GenerateReportInput, GenerateReportResult } from "./types";
export { GenerateReportInputSchema } from "./types";

function toNumber(value: string | number | null | undefined) {
  if (value == null) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
}

function pointLabel(groupBy: ReportGroupBy, key: string) {
  if (groupBy === "category") {
    const category = parseExpenseCategory(key);
    return category ? EXPENSE_CATEGORY_LABELS[category] : "Uncategorized";
  }

  return key;
}

async function loadReportGroups(
  userId: string,
  input: GenerateReportInput,
) {
  const where = invoiceWhere(userId, input);

  if (input.groupBy === "month") {
    const month = sql<string>`to_char(${invoices.issueDate}::date, 'YYYY-MM')`;
    return db
      .select({
        key: month,
        currency: invoices.currency,
        count: count(),
        sum: sum(invoices.total),
      })
      .from(invoices)
      .where(where)
      .groupBy(month, invoices.currency);
  }

  if (input.groupBy === "vendor") {
    return db
      .select({
        key: invoices.vendor,
        currency: invoices.currency,
        count: count(),
        sum: sum(invoices.total),
      })
      .from(invoices)
      .where(where)
      .groupBy(invoices.vendor, invoices.currency);
  }

  const category = sql<string>`coalesce(${invoices.category}, 'uncategorized')`;
  return db
    .select({
      key: category,
      currency: invoices.currency,
      count: count(),
      sum: sum(invoices.total),
    })
    .from(invoices)
    .where(where)
    .groupBy(category, invoices.currency);
}

export async function generateReport({
  userId,
  filters,
}: {
  userId: string;
  filters: GenerateReportInput;
}): Promise<GenerateReportResult> {
  const input = GenerateReportInputSchema.parse(filters);
  const rows = await loadReportGroups(userId, input);
  const currencies = new Set(rows.map((row) => row.currency));
  const mixedCurrencies = currencies.size > 1;

  const points = rows
    .map((row) => {
      const baseLabel = pointLabel(input.groupBy, row.key);
      return {
        key: row.key,
        label: mixedCurrencies ? `${baseLabel} · ${row.currency}` : baseLabel,
        amount: toNumber(row.sum),
        count: row.count,
        currency: row.currency,
      };
    })
    .sort((left, right) => {
      if (input.groupBy === "month") {
        return (
          left.key.localeCompare(right.key) ||
          left.currency.localeCompare(right.currency)
        );
      }

      return right.amount - left.amount;
    })
    .map((point) => ({
      label: point.label,
      amount: point.amount,
      count: point.count,
      currency: point.currency,
    }));

  return {
    groupBy: input.groupBy,
    points,
    summary: {
      count: rows.reduce((total, row) => total + row.count, 0),
      sum: roundMoney(rows.reduce((total, row) => total + toNumber(row.sum), 0)),
      currency: currencies.size === 1 ? rows[0].currency : null,
    },
  };
}
