import type { QueryInvoicesResult } from "@/lib/invoices/types";
import { formatMoney } from "@/lib/money/format";

export function SpendingTable({ result }: { result: QueryInvoicesResult }) {
  const { invoices, summary } = result;

  return (
    <div className="w-full max-w-xl overflow-hidden rounded-3xl border bg-background text-sm">
      <div className="border-b px-3 py-2 text-muted-foreground">
        {summary.count === 0
          ? "No matching invoices"
          : `${summary.count} invoice${summary.count === 1 ? "" : "s"} · ${formatMoney(summary.sum, summary.currency)}`}
        {summary.returned < summary.count
          ? ` · showing ${summary.returned}`
          : ""}
      </div>
      {invoices.length > 0 ? (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="px-3 py-1.5 font-medium">Vendor</th>
              <th className="px-3 py-1.5 font-medium">Number</th>
              <th className="px-3 py-1.5 font-medium">Issued</th>
              <th className="px-3 py-1.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-t">
                <td className="px-3 py-1.5">{invoice.vendor}</td>
                <td className="px-3 py-1.5">{invoice.invoiceNumber}</td>
                <td className="px-3 py-1.5">{invoice.issueDate}</td>
                <td className="px-3 py-1.5 text-right">
                  {formatMoney(invoice.total, invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
