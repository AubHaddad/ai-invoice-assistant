"use client";

import { getToolName, isToolUIPart } from "ai";
import { Component, type ReactNode } from "react";
import { CalculateCard } from "@/components/chat/calculate-card";
import { CategorizeCard } from "@/components/chat/categorize-card";
import { CurrencyConversionCard } from "@/components/chat/currency-conversion-card";
import { InvoiceCard } from "@/components/chat/invoice-card";
import { SpendingChart } from "@/components/chat/spending-chart";
import { SpendingTable } from "@/components/chat/spending-table";
import { ToolStatusChip } from "@/components/chat/tool-status-chip";
import { Button } from "@/components/ui/button";
import type { InvoiceAssistantUIMessage } from "@/lib/chat/types";
import {
  BROKEN_PAYLOAD_TEXT,
  extractInvoiceFallback,
  generateReportFallback,
  queryInvoicesFallback,
} from "@/lib/chat/tool-ui";
import {
  ExtractInvoiceResultSchema,
  GenerateReportResultSchema,
  QueryInvoicesResultSchema,
} from "@/lib/invoices/types";

type ToolUIPart = Extract<
  InvoiceAssistantUIMessage["parts"][number],
  { type: `tool-${string}` }
>;

export type ExtractInvoiceToolPart = Extract<
  InvoiceAssistantUIMessage["parts"][number],
  { type: "tool-extractInvoice" }
>;

function ToolFallback({ text }: { text: string }) {
  return (
    <p className="max-w-xl whitespace-pre-wrap text-sm text-muted-foreground">
      {text}
    </p>
  );
}

class ToolPartBoundary extends Component<
  { fallbackText: string; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <ToolFallback text={this.props.fallbackText} />;
    }

    return this.props.children;
  }
}

function ExtractInvoiceResult({
  part,
  isReviewing,
  onReview,
}: {
  part: Extract<ToolUIPart, { type: "tool-extractInvoice"; state: "output-available" }>;
  isReviewing: boolean;
  onReview: () => void;
}) {
  const parsed = ExtractInvoiceResultSchema.safeParse(part.output);

  if (!parsed.success) {
    return <ToolFallback text={BROKEN_PAYLOAD_TEXT} />;
  }

  if (!parsed.data.ok) {
    return (
      <p className="text-sm text-destructive">{parsed.data.error}</p>
    );
  }

  return (
    <ToolPartBoundary fallbackText={extractInvoiceFallback(parsed.data)}>
      <div className="flex w-full max-w-xl flex-col items-start gap-2">
        <InvoiceCard result={parsed.data} />
        <Button
          type="button"
          size="xs"
          variant={isReviewing ? "secondary" : "ghost"}
          onClick={onReview}
        >
          {isReviewing ? "Reviewing" : "Review"}
        </Button>
      </div>
    </ToolPartBoundary>
  );
}

export function ToolPart({
  part,
  isReviewing = false,
  onReview,
}: {
  part: InvoiceAssistantUIMessage["parts"][number];
  isReviewing?: boolean;
  onReview?: (part: ExtractInvoiceToolPart) => void;
}) {
  if (!isToolUIPart(part)) {
    return null;
  }

  const toolName = getToolName(part);

  if (part.state === "input-streaming" || part.state === "input-available") {
    return <ToolStatusChip toolName={toolName} />;
  }

  if (part.state === "output-error") {
    return (
      <p className="text-sm text-destructive">
        {part.errorText || "Tool failed."}
      </p>
    );
  }

  if (part.state !== "output-available") {
    return null;
  }

  switch (part.type) {
    case "tool-extractInvoice":
      return (
        <ExtractInvoiceResult
          part={part}
          isReviewing={isReviewing}
          onReview={() => onReview?.(part)}
        />
      );
    case "tool-queryInvoices": {
      const parsed = QueryInvoicesResultSchema.safeParse(part.output);

      if (!parsed.success) {
        return <ToolFallback text={BROKEN_PAYLOAD_TEXT} />;
      }

      return (
        <ToolPartBoundary
          key={part.toolCallId}
          fallbackText={queryInvoicesFallback(parsed.data)}
        >
          <SpendingTable result={parsed.data} />
        </ToolPartBoundary>
      );
    }
    case "tool-generateReport": {
      const parsed = GenerateReportResultSchema.safeParse(part.output);

      if (!parsed.success) {
        return <ToolFallback text={BROKEN_PAYLOAD_TEXT} />;
      }

      return (
        <ToolPartBoundary
          key={part.toolCallId}
          fallbackText={generateReportFallback(parsed.data)}
        >
          <SpendingChart result={parsed.data} />
        </ToolPartBoundary>
      );
    }
    case "tool-calculate":
      return <CalculateCard result={part.output} />;
    case "tool-convertCurrency":
      return <CurrencyConversionCard result={part.output} />;
    case "tool-categorizeExpense":
      return <CategorizeCard result={part.output} />;
    default:
      return null;
  }
}

export function isRenderableToolPart(
  part: InvoiceAssistantUIMessage["parts"][number],
) {
  return isToolUIPart(part);
}
