import { and, count, desc, eq, gte, ilike, lte, sum, type SQL } from "drizzle-orm";
import "server-only";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema";
import { parseExpenseCategory } from "./categories";
import { roundMoney } from "./postprocess";
import {
  DEFAULT_QUERY_LIMIT,
  QueryInvoicesInputSchema,
  type QueryInvoicesInput,
  type QueryInvoicesResult,
} from "./types";

export type { QueryInvoicesInput, QueryInvoicesResult } from "./types";
export { QueryInvoicesInputSchema } from "./types";

function likeContains(value: string) {
  return `%${value.replace(/[%_\\]/g, "")}%`;
}

function toNumber(value: string | number | null | undefined) {
  if (value == null) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
}

export function invoiceWhere(userId: string, input: QueryInvoicesInput): SQL {
  const conditions: SQL[] = [eq(invoices.userId, userId)];

  if (input.vendor) {
    conditions.push(ilike(invoices.vendor, likeContains(input.vendor)));
  }

  if (input.dateFrom) {
    conditions.push(gte(invoices.issueDate, input.dateFrom));
  }

  if (input.dateTo) {
    conditions.push(lte(invoices.issueDate, input.dateTo));
  }

  if (input.category) {
    conditions.push(eq(invoices.category, input.category));
  }

  if (input.minAmount != null) {
    conditions.push(gte(invoices.total, input.minAmount));
  }

  if (input.maxAmount != null) {
    conditions.push(lte(invoices.total, input.maxAmount));
  }

  if (input.currency) {
    conditions.push(eq(invoices.currency, input.currency.toUpperCase()));
  }

  return and(...conditions)!;
}

export async function queryInvoices({
  userId,
  filters,
}: {
  userId: string;
  filters: QueryInvoicesInput;
}): Promise<QueryInvoicesResult> {
  const input = QueryInvoicesInputSchema.parse(filters);
  const limit = input.limit ?? DEFAULT_QUERY_LIMIT;
  const where = invoiceWhere(userId, input);

  const groups = await db
    .select({
      currency: invoices.currency,
      count: count(),
      sum: sum(invoices.total),
    })
    .from(invoices)
    .where(where)
    .groupBy(invoices.currency);

  const rows = await db
    .select({
      id: invoices.id,
      vendor: invoices.vendor,
      invoiceNumber: invoices.invoiceNumber,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      category: invoices.category,
      currency: invoices.currency,
      total: invoices.total,
    })
    .from(invoices)
    .where(where)
    .orderBy(desc(invoices.issueDate), desc(invoices.createdAt))
    .limit(limit);

  return {
    invoices: rows.map((row) => ({
      ...row,
      category: parseExpenseCategory(row.category),
    })),
    summary: {
      count: groups.reduce((total, group) => total + group.count, 0),
      sum: roundMoney(
        groups.reduce((total, group) => total + toNumber(group.sum), 0),
      ),
      currency: groups.length === 1 ? groups[0].currency : null,
      returned: rows.length,
    },
  };
}
