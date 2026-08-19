import {
  EXPENSE_CATEGORY_LABELS,
} from "@/lib/invoices/categories";
import type { ExtractInvoiceSuccess } from "@/lib/invoices/types";
import { formatMoney } from "@/lib/money/format";
import { cn } from "@/lib/utils";

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return value;
}

export function InvoiceCard({ result }: { result: ExtractInvoiceSuccess }) {
  const { invoice, notes, fileName, extractionPath } = result;
  const confidencePct = Math.round(invoice.confidence * 100);
  const category = invoice.category
    ? EXPENSE_CATEGORY_LABELS[invoice.category]
    : null;

  return (
    <div className="w-full max-w-xl overflow-hidden rounded-3xl border bg-background text-sm">
      <div className="border-b px-3 py-2">
        <p className="font-medium">{invoice.vendor}</p>
        <p className="text-muted-foreground">
          {invoice.invoiceNumber}
          {category ? ` · ${category}` : ""}
        </p>
      </div>
      <div className="space-y-3 px-3 py-2.5">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          <div>
            <dt className="text-muted-foreground">Issued</dt>
            <dd>{formatDate(invoice.issueDate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Due</dt>
            <dd>{formatDate(invoice.dueDate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{formatMoney(invoice.subtotal, invoice.currency)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tax</dt>
            <dd>{formatMoney(invoice.tax, invoice.currency)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-muted-foreground">Total</dt>
            <dd className="font-medium">
              {formatMoney(invoice.total, invoice.currency)}
            </dd>
          </div>
        </dl>

        {invoice.lineItems.length > 0 ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 font-medium">Item</th>
                <th className="py-1 text-right font-medium">Qty</th>
                <th className="py-1 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item, index) => (
                <tr key={`${item.description}-${index}`} className="border-t">
                  <td className="py-1.5">{item.description}</td>
                  <td className="py-1.5 text-right">{item.quantity}</td>
                  <td className="py-1.5 text-right">
                    {formatMoney(item.amount, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-medium",
              confidencePct >= 80
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : confidencePct >= 50
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : "bg-destructive/10 text-destructive",
            )}
          >
            {confidencePct}% confident
          </span>
          <span>
            {extractionPath === "text"
              ? "Text layer"
              : extractionPath === "mixed"
                ? "Text + vision"
                : "Vision"}{" "}
            · {fileName}
          </span>
        </div>

        {notes.trim() ? (
          <p
            className={cn(
              "rounded-xl px-3 py-2",
              notes.includes("does not match total")
                ? "bg-amber-500/10 text-amber-800 dark:text-amber-400"
                : "bg-muted/80 text-muted-foreground",
            )}
          >
            {notes}
          </p>
        ) : null}
      </div>
    </div>
  );
}
