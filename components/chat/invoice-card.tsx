"use client";

import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveInvoiceAction } from "@/lib/invoices/actions";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  parseExpenseCategory,
} from "@/lib/invoices/categories";
import type {
  ExtractInvoiceResult,
  ExtractInvoiceSuccess,
  SavedInvoice,
} from "@/lib/invoices/types";
import { InvoiceSchema, type Invoice, type LineItem } from "@/lib/schemas";
import { cn } from "@/lib/utils";

type InvoiceDraft = {
  vendor: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: string;
  tax: string;
  total: string;
  category: string;
  lineItems: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    amount: string;
  }>;
};

type CardStatus = "editing" | "saved" | "discarded";

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

function moneyString(value: number) {
  return Number.isFinite(value) ? String(value) : "";
}

function invoiceToDraft(invoice: Invoice): InvoiceDraft {
  return {
    vendor: invoice.vendor,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate ?? "",
    currency: invoice.currency,
    subtotal: moneyString(invoice.subtotal),
    tax: moneyString(invoice.tax),
    total: moneyString(invoice.total),
    category: invoice.category ?? "",
    lineItems: invoice.lineItems.map((item) => ({
      description: item.description,
      quantity: moneyString(item.quantity),
      unitPrice: moneyString(item.unitPrice),
      amount: moneyString(item.amount),
    })),
  };
}

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function draftToInvoice(draft: InvoiceDraft, original: Invoice): Invoice {
  const lineItems: LineItem[] = draft.lineItems
    .map((item) => ({
      description: item.description.trim(),
      quantity: parseNumber(item.quantity),
      unitPrice: parseNumber(item.unitPrice),
      amount: parseNumber(item.amount),
    }))
    .filter((item) => item.description.length > 0);

  return {
    vendor: draft.vendor.trim(),
    invoiceNumber: draft.invoiceNumber.trim(),
    issueDate: draft.issueDate,
    dueDate: draft.dueDate.trim() ? draft.dueDate : null,
    currency: draft.currency.trim().toUpperCase(),
    subtotal: parseNumber(draft.subtotal),
    tax: parseNumber(draft.tax),
    total: parseNumber(draft.total),
    category: parseExpenseCategory(draft.category),
    confidence: original.confidence,
    raw: original.raw,
    lineItems,
  };
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-1 text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ExtractionErrorCard({ result }: { result: ExtractInvoiceResult }) {
  if (result.ok) {
    return null;
  }

  const isUnreadable = result.code === "unreadable";

  return (
    <Card size="sm" className="bg-destructive/5 shadow-none ring-destructive/20">
      <CardHeader>
        <CardTitle>
          {isUnreadable ? "Unreadable document" : "Extraction failed"}
        </CardTitle>
        <CardDescription>{result.error}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function SavedInvoiceSummary({
  invoice,
  notes,
  fileName,
  extractionPath,
}: {
  invoice: Invoice;
  notes: string;
  fileName: string;
  extractionPath: ExtractInvoiceSuccess["extractionPath"];
}) {
  const confidencePct = Math.round(invoice.confidence * 100);

  return (
    <>
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
            "rounded-xl px-3 py-2 text-sm",
            notes.includes("does not match total")
              ? "bg-amber-500/10 text-amber-800 dark:text-amber-400"
              : "bg-muted/80 text-muted-foreground",
          )}
        >
          {notes}
        </p>
      ) : null}
    </>
  );
}

function InvoiceReviewForm({
  result,
  conversationId,
  onSaved,
  onDiscard,
}: {
  result: ExtractInvoiceSuccess;
  conversationId: string;
  onSaved: (saved: SavedInvoice) => void;
  onDiscard?: () => void;
}) {
  const [draft, setDraft] = useState(() => invoiceToDraft(result.invoice));
  const [status, setStatus] = useState<CardStatus>("editing");
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const confidencePct = Math.round(result.invoice.confidence * 100);

  function updateField<K extends keyof InvoiceDraft>(
    key: K,
    value: InvoiceDraft[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateLineItem(
    index: number,
    key: "description" | "quantity" | "unitPrice" | "amount",
    value: string,
  ) {
    setDraft((current) => {
      const lineItems = current.lineItems.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        const next = { ...item, [key]: value };

        if (key === "quantity" || key === "unitPrice") {
          const quantity = parseNumber(key === "quantity" ? value : item.quantity);
          const unitPrice = parseNumber(
            key === "unitPrice" ? value : item.unitPrice,
          );

          if (Number.isFinite(quantity) && Number.isFinite(unitPrice)) {
            next.amount = String(
              Math.round((quantity * unitPrice + Number.EPSILON) * 100) / 100,
            );
          }
        }

        return next;
      });

      return { ...current, lineItems };
    });
  }

  function addLineItem() {
    setDraft((current) => ({
      ...current,
      lineItems: [
        ...current.lineItems,
        { description: "", quantity: "1", unitPrice: "0", amount: "0" },
      ],
    }));
  }

  function removeLineItem(index: number) {
    setDraft((current) => ({
      ...current,
      lineItems: current.lineItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function onSave() {
    setError(null);
    const parsed = InvoiceSchema.safeParse(
      draftToInvoice(draft, result.invoice),
    );

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setError(
        firstIssue?.message
          ? `${firstIssue.path.join(".") || "Invoice"}: ${firstIssue.message}`
          : "Invoice data is invalid.",
      );
      return;
    }

    startTransition(async () => {
      const saved = await saveInvoiceAction({
        documentId: result.documentId,
        conversationId,
        invoice: parsed.data,
      });

      if (!saved.ok) {
        setError(saved.error);
        return;
      }

      setSavedInvoice(parsed.data);
      setStatus("saved");
      onSaved(saved);
    });
  }

  if (status === "discarded") {
    return (
      <Card size="sm" className="bg-muted/40 shadow-none">
        <CardHeader>
          <CardTitle>Extraction discarded</CardTitle>
          <CardDescription>
            {result.invoice.vendor} · {result.invoice.invoiceNumber} was not
            saved.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (status === "saved" && savedInvoice) {
    return (
      <Card size="sm" className="bg-background shadow-none">
        <CardHeader>
          <CardTitle>{savedInvoice.vendor}</CardTitle>
          <CardDescription>
            {savedInvoice.invoiceNumber}
            {savedInvoice.category
              ? ` · ${EXPENSE_CATEGORY_LABELS[savedInvoice.category]}`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SavedInvoiceSummary
            invoice={savedInvoice}
            notes={result.notes}
            fileName={result.fileName}
            extractionPath={result.extractionPath}
          />
        </CardContent>
        <CardFooter>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Saved
          </span>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card size="sm" className="bg-background shadow-none">
      <CardHeader>
        <CardTitle>Review invoice</CardTitle>
        <CardDescription>
          Edit any fields, then save to persist this extraction.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vendor" className="col-span-2">
            <Input
              value={draft.vendor}
              onChange={(event) => updateField("vendor", event.target.value)}
              className="h-8 rounded-xl"
              disabled={isPending}
            />
          </Field>
          <Field label="Invoice number">
            <Input
              value={draft.invoiceNumber}
              onChange={(event) =>
                updateField("invoiceNumber", event.target.value)
              }
              className="h-8 rounded-xl"
              disabled={isPending}
            />
          </Field>
          <Field label="Currency">
            <Input
              value={draft.currency}
              onChange={(event) => updateField("currency", event.target.value)}
              className="h-8 rounded-xl uppercase"
              disabled={isPending}
            />
          </Field>
          <Field label="Issue date">
            <Input
              type="date"
              value={draft.issueDate}
              onChange={(event) => updateField("issueDate", event.target.value)}
              className="h-8 rounded-xl"
              disabled={isPending}
            />
          </Field>
          <Field label="Due date">
            <Input
              type="date"
              value={draft.dueDate}
              onChange={(event) => updateField("dueDate", event.target.value)}
              className="h-8 rounded-xl"
              disabled={isPending}
            />
          </Field>
          <Field label="Category" className="col-span-2">
            <select
              value={draft.category}
              onChange={(event) => updateField("category", event.target.value)}
              className="h-8 w-full min-w-0 rounded-xl border border-transparent bg-input/50 px-3 py-1 text-sm outline-none transition-[color,box-shadow,background-color] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isPending}
            >
              <option value="">Uncategorized</option>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {EXPENSE_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subtotal">
            <Input
              inputMode="decimal"
              value={draft.subtotal}
              onChange={(event) => updateField("subtotal", event.target.value)}
              className="h-8 rounded-xl"
              disabled={isPending}
            />
          </Field>
          <Field label="Tax">
            <Input
              inputMode="decimal"
              value={draft.tax}
              onChange={(event) => updateField("tax", event.target.value)}
              className="h-8 rounded-xl"
              disabled={isPending}
            />
          </Field>
          <Field label="Total" className="col-span-2">
            <Input
              inputMode="decimal"
              value={draft.total}
              onChange={(event) => updateField("total", event.target.value)}
              className="h-8 rounded-xl"
              disabled={isPending}
            />
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Line items</p>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={addLineItem}
              disabled={isPending}
            >
              <PlusIcon />
              Add
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-md border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-border border px-2 py-1 text-left font-medium">
                    Item
                  </th>
                  <th className="border-border border px-2 py-1 text-right font-medium">
                    Qty
                  </th>
                  <th className="border-border border px-2 py-1 text-right font-medium">
                    Unit
                  </th>
                  <th className="border-border border px-2 py-1 text-right font-medium">
                    Amount
                  </th>
                  <th className="border-border w-10 border px-1 py-1">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {draft.lineItems.map((item, index) => (
                  <tr key={index}>
                    <td className="border-border border p-1">
                      <Input
                        value={item.description}
                        onChange={(event) =>
                          updateLineItem(index, "description", event.target.value)
                        }
                        className="h-8 rounded-lg"
                        disabled={isPending}
                      />
                    </td>
                    <td className="border-border w-20 border p-1">
                      <Input
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(event) =>
                          updateLineItem(index, "quantity", event.target.value)
                        }
                        className="h-8 rounded-lg text-right"
                        disabled={isPending}
                      />
                    </td>
                    <td className="border-border w-24 border p-1">
                      <Input
                        inputMode="decimal"
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateLineItem(index, "unitPrice", event.target.value)
                        }
                        className="h-8 rounded-lg text-right"
                        disabled={isPending}
                      />
                    </td>
                    <td className="border-border w-24 border p-1">
                      <Input
                        inputMode="decimal"
                        value={item.amount}
                        onChange={(event) =>
                          updateLineItem(index, "amount", event.target.value)
                        }
                        className="h-8 rounded-lg text-right"
                        disabled={isPending}
                      />
                    </td>
                    <td className="border-border border p-1 text-center">
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label="Remove line item"
                        onClick={() => removeLineItem(index)}
                        disabled={isPending}
                      >
                        <Trash2Icon />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

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
            {result.extractionPath === "text"
              ? "Text layer"
              : result.extractionPath === "mixed"
                ? "Text + vision"
                : "Vision"}{" "}
            · {result.fileName}
          </span>
        </div>

        {result.notes.trim() ? (
          <p
            className={cn(
              "rounded-xl px-3 py-2 text-sm",
              result.notes.includes("does not match total")
                ? "bg-amber-500/10 text-amber-800 dark:text-amber-400"
                : "bg-muted/80 text-muted-foreground",
            )}
          >
            {result.notes}
          </p>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
      <CardFooter className="gap-2">
        <Button type="button" onClick={onSave} disabled={isPending}>
          {isPending ? <Loader2Icon className="animate-spin" /> : null}
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={() => {
            setStatus("discarded");
            onDiscard?.();
          }}
        >
          Discard
        </Button>
      </CardFooter>
    </Card>
  );
}

export function InvoiceCard({
  result,
  conversationId,
  onSaved,
  onDiscard,
}: {
  result: ExtractInvoiceResult;
  conversationId: string;
  onSaved: (saved: SavedInvoice) => void;
  onDiscard?: () => void;
}) {
  if (!result.ok) {
    return <ExtractionErrorCard result={result} />;
  }

  return (
    <InvoiceReviewForm
      result={result}
      conversationId={conversationId}
      onSaved={onSaved}
      onDiscard={onDiscard}
    />
  );
}
