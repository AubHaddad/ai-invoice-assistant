"use client";

import {
  EXPENSE_CATEGORY_LABELS,
  type CategorizeExpenseResult,
} from "@/lib/invoices/categories";

export function CategorizeCard({ result }: { result: CategorizeExpenseResult }) {
  if (!result.ok) {
    return <p className="text-sm text-destructive">{result.error}</p>;
  }

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-3xl border bg-background text-sm">
      <div className="border-b px-3 py-2 text-muted-foreground">
        {result.vendor}
      </div>
      <div className="px-3 py-2.5">
        <p className="text-base font-medium">
          {EXPENSE_CATEGORY_LABELS[result.category]}
        </p>
        {result.reason ? (
          <p className="mt-1 text-muted-foreground">{result.reason}</p>
        ) : null}
      </div>
    </div>
  );
}
