import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import "server-only";
import { saveAssistantMessage } from "@/lib/chat/store";
import { getMessageText } from "@/lib/chat/ui-message";
import type { InvoiceAssistantUIMessage } from "@/lib/chat/types";
import {
  getDocumentForUser,
  listUploadedDocumentsForConversation,
} from "@/lib/documents/store";
import { queryInvoices } from "@/lib/invoices/query";
import type { ExtractInvoiceSuccess } from "@/lib/invoices/types";
import type { Invoice } from "@/lib/schemas";

export const E2E_FIXTURE_INVOICE: Invoice = {
  vendor: "Acme Corp",
  invoiceNumber: "INV-9001",
  issueDate: "2026-08-01",
  dueDate: null,
  currency: "USD",
  subtotal: 100,
  tax: 0,
  total: 100,
  category: "other",
  confidence: 0.95,
  raw: { source: "e2e" },
  lineItems: [
    {
      description: "Consulting services",
      quantity: 1,
      unitPrice: 100,
      amount: 100,
    },
  ],
};

function writeText(
  writer: {
    write: (
      part:
        | { type: "text-start"; id: string }
        | { type: "text-delta"; id: string; delta: string }
        | { type: "text-end"; id: string },
    ) => void;
  },
  text: string,
) {
  const id = crypto.randomUUID();
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: text });
  writer.write({ type: "text-end", id });
}

function fixtureExtract(document: {
  id: string;
  fileName: string;
}): ExtractInvoiceSuccess {
  return {
    ok: true,
    documentId: document.id,
    fileName: document.fileName,
    extractionPath: "text",
    notes: "",
    invoice: E2E_FIXTURE_INVOICE,
  };
}

export async function e2eChatResponse({
  userId,
  conversationId,
  messages,
}: {
  userId: string;
  conversationId: string;
  messages: InvoiceAssistantUIMessage[];
}) {
  const lastMessage = messages[messages.length - 1];
  const lastUserText = getMessageText(
    [...messages].reverse().find((message) => message.role === "user") ?? {
      parts: [],
    },
  );

  const stream = createUIMessageStream<InvoiceAssistantUIMessage>({
    originalMessages: messages,
    generateId: () => crypto.randomUUID(),
    execute: async ({ writer }) => {
      if (lastMessage?.role === "system") {
        writeText(
          writer,
          "Saved. You can ask about this invoice by vendor, number, or total.",
        );
        return;
      }

      if (/total/i.test(lastUserText) && /last invoice/i.test(lastUserText)) {
        const result = await queryInvoices({
          userId,
          filters: { limit: 1 },
        });
        const invoice = result.invoices[0];

        if (!invoice) {
          writeText(writer, "I could not find a saved invoice.");
          return;
        }

        writeText(
          writer,
          `The last invoice total is ${invoice.total.toFixed(2)} ${invoice.currency}.`,
        );
        return;
      }

      const uploaded = await listUploadedDocumentsForConversation(
        conversationId,
        userId,
      );
      const documentIdMatch = /[0-9a-f-]{36}/i.exec(lastUserText);
      const byId = documentIdMatch
        ? await getDocumentForUser(documentIdMatch[0], userId)
        : null;
      const resolved = uploaded[0] ?? byId;

      if (!resolved) {
        writeText(writer, "Upload an invoice first, then ask me to extract it.");
        return;
      }

      const toolCallId = crypto.randomUUID();
      writer.write({
        type: "tool-input-start",
        toolCallId,
        toolName: "extractInvoice",
      });
      writer.write({
        type: "tool-input-available",
        toolCallId,
        toolName: "extractInvoice",
        input: { documentId: resolved.id },
      });
      writer.write({
        type: "tool-output-available",
        toolCallId,
        output: fixtureExtract(resolved),
      });
      writeText(
        writer,
        `Extracted ${resolved.fileName} from ${E2E_FIXTURE_INVOICE.vendor}.`,
      );
    },
    onEnd: async ({ responseMessage, isContinuation }) => {
      try {
        await saveAssistantMessage({
          conversationId,
          message: responseMessage as UIMessage,
          isContinuation,
        });
      } catch (error) {
        console.error("Failed to persist e2e assistant message", error);
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
