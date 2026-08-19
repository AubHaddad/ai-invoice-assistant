import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ExtractInvoiceResult } from "@/lib/invoices/types";
import { cn } from "@/lib/utils";

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

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return value;
}

export function InvoiceExtractionCard({
  result,
}: {
  result: ExtractInvoiceResult;
}) {
  if (!result.ok) {
    return (
      <Card size="sm" className="bg-destructive/5 shadow-none ring-destructive/20">
        <CardHeader>
          <CardTitle>Extraction failed</CardTitle>
          <CardDescription>{result.error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { invoice, notes, fileName, extractionPath } = result;
  const confidencePct = Math.round(invoice.confidence * 100);

  return (
    <Card size="sm" className="bg-background shadow-none">
      <CardHeader>
        <CardTitle>{invoice.vendor}</CardTitle>
        <CardDescription>
          {invoice.invoiceNumber}
          {invoice.category ? ` · ${invoice.category}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
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
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-border border px-2 py-1 text-left">Item</th>
                <th className="border-border border px-2 py-1 text-right">Qty</th>
                <th className="border-border border px-2 py-1 text-right">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems.map((item, index) => (
                <tr key={`${item.description}-${index}`}>
                  <td className="border-border border px-2 py-1">
                    {item.description}
                  </td>
                  <td className="border-border border px-2 py-1 text-right">
                    {item.quantity}
                  </td>
                  <td className="border-border border px-2 py-1 text-right">
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
            {extractionPath === "text" ? "Text layer" : "Vision"} · {fileName}
          </span>
        </div>

        {notes.trim() ? (
          <p className="rounded-xl bg-muted/80 px-3 py-2 text-sm text-muted-foreground">
            {notes}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
