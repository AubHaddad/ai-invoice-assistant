import type { InvoiceExtraction, LineItem } from "@/lib/schemas";
import { roundMoney } from "@/lib/money/precision";

export { roundMoney };

export const TOTAL_RECONCILE_TOLERANCE = 0.02;

export function mergeLineItems(items: LineItem[]): LineItem[] {
  const merged: LineItem[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const key = JSON.stringify({
      description: item.description.trim().toLowerCase(),
      quantity: roundMoney(item.quantity),
      unitPrice: roundMoney(item.unitPrice),
      amount: roundMoney(item.amount),
    });

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(item);
  }

  return merged;
}

export function reconcileTotals(invoice: {
  lineItems: LineItem[];
  tax: number;
  total: number;
}) {
  const lineSum = roundMoney(
    invoice.lineItems.reduce((sum, item) => sum + item.amount, 0),
  );
  const computed = roundMoney(lineSum + invoice.tax);
  const total = roundMoney(invoice.total);
  const delta = roundMoney(Math.abs(computed - total));
  const tolerance = Math.max(
    TOTAL_RECONCILE_TOLERANCE,
    roundMoney(Math.abs(total) * 0.01),
  );

  if (delta > tolerance) {
    return {
      ok: false as const,
      warning: `Line items (${lineSum.toFixed(2)}) + tax (${invoice.tax.toFixed(2)}) = ${computed.toFixed(2)}, which does not match total ${total.toFixed(2)} (difference ${delta.toFixed(2)}).`,
      lineSum,
      computed,
      total,
      delta,
    };
  }

  return { ok: true as const, lineSum, computed, total, delta: 0 };
}

export function appendNote(notes: string, extra: string) {
  const existing = notes.trim();
  const addition = extra.trim();

  if (!addition) {
    return existing;
  }

  if (!existing) {
    return addition;
  }

  if (existing.includes(addition)) {
    return existing;
  }

  return `${existing}\n${addition}`;
}

export function mergePageExtractions(
  pages: InvoiceExtraction[],
): InvoiceExtraction | null {
  const readable = pages.filter((page) => !page.unreadable);

  if (readable.length === 0) {
    return null;
  }

  const header = readable.reduce((best, page) =>
    page.confidence > best.confidence ? page : best,
  );
  const totalsSource =
    [...readable].reverse().find((page) => page.total !== 0) ?? header;
  const lineItems = mergeLineItems(
    readable.flatMap((page) => page.lineItems),
  );
  const notes = readable
    .map((page) => page.notes.trim())
    .filter(Boolean)
    .filter((note, index, all) => all.indexOf(note) === index)
    .join("\n");

  return {
    ...header,
    invoiceNumber: totalsSource.invoiceNumber || header.invoiceNumber,
    issueDate: header.issueDate || totalsSource.issueDate,
    dueDate: header.dueDate ?? totalsSource.dueDate,
    currency: header.currency || totalsSource.currency,
    subtotal: totalsSource.subtotal,
    tax: totalsSource.tax,
    total: totalsSource.total,
    category: header.category ?? totalsSource.category,
    confidence:
      readable.reduce((sum, page) => sum + page.confidence, 0) / readable.length,
    lineItems,
    notes,
    unreadable: false,
  };
}
