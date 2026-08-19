import { and, count, eq, gte, lte, sql, sum } from "drizzle-orm";
import "server-only";
import { db } from "@/lib/db";
import { loadExchangeRatesOnOrBefore } from "@/lib/db/exchange-rates";
import { invoices } from "@/lib/db/schema";
import { todayIsoDate } from "@/lib/money/convert";
import { roundMoney } from "@/lib/money/precision";
import {
  buildReportResult,
  conversionAsOfDate,
  periodRange,
} from "./report-utils";
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

async function loadReportGroups(
  userId: string,
  groupBy: ReportGroupBy,
  dateFrom: string,
  dateTo: string,
) {
  const where = and(
    eq(invoices.userId, userId),
    gte(invoices.issueDate, dateFrom),
    lte(invoices.issueDate, dateTo),
  );

  if (groupBy === "vendor") {
    const rows = await db
      .select({
        key: invoices.vendor,
        currency: invoices.currency,
        count: count(),
        sum: sum(invoices.total),
      })
      .from(invoices)
      .where(where)
      .groupBy(invoices.vendor, invoices.currency);

    return rows.map((row) => ({
      key: row.key,
      currency: row.currency,
      count: row.count,
      sum: toNumber(row.sum),
    }));
  }

  const category = sql<string>`coalesce(${invoices.category}, 'uncategorized')`;
  const rows = await db
    .select({
      key: category,
      currency: invoices.currency,
      count: count(),
      sum: sum(invoices.total),
    })
    .from(invoices)
    .where(where)
    .groupBy(category, invoices.currency);

  return rows.map((row) => ({
    key: row.key,
    currency: row.currency,
    count: row.count,
    sum: toNumber(row.sum),
  }));
}

export async function generateReport({
  userId,
  filters,
  now = new Date(),
}: {
  userId: string;
  filters: GenerateReportInput;
  now?: Date;
}): Promise<GenerateReportResult | { error: string }> {
  const input = GenerateReportInputSchema.parse(filters);
  const today = todayIsoDate(now);
  const { dateFrom, dateTo } = periodRange(input.period, today);
  const asOfDate = conversionAsOfDate(dateTo, today);
  const [groups, rates] = await Promise.all([
    loadReportGroups(userId, input.groupBy, dateFrom, dateTo),
    loadExchangeRatesOnOrBefore(asOfDate),
  ]);
  const built = buildReportResult({
    input,
    dateFrom,
    dateTo,
    groups,
    rates,
    asOfDate,
  });

  if (!built.ok) {
    return { error: built.error };
  }

  return built.report;
}
