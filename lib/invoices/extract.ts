import { generateObject, type ModelMessage } from "ai";
import { PDFParse } from "pdf-parse";
import "server-only";
import { getModel } from "@/lib/ai/models";
import {
  getDocumentForUser,
  setDocumentPages,
} from "@/lib/documents/store";
import {
  InvoiceExtractionSchema,
  InvoiceSchema,
  type Invoice,
  type InvoiceExtraction,
} from "@/lib/schemas";
import { downloadObject } from "@/lib/storage/gcs";
import type {
  ExtractInvoiceResult,
  InvoiceExtractionPath,
} from "./types";

export type {
  ExtractInvoiceFailure,
  ExtractInvoiceResult,
  ExtractInvoiceSuccess,
  InvoiceExtractionPath,
} from "./types";

const PDF_MIME = "application/pdf";
const TEXT_LAYER_MIN_CHARS = 80;

const EXTRACTION_INSTRUCTIONS = `Extract invoice fields from the provided document.
Use ISO dates (YYYY-MM-DD).
Amounts are numbers in the invoice currency, not cents.
confidence is a number from 0 to 1 for how sure you are.
notes must describe anything ambiguous, missing, unreadable, or inferred. Use an empty string if nothing is unclear.
Do not invent invoice numbers, vendors, or totals. If a nullable field is absent, use null.`;

function normalizeExtractedText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function toInvoice(extraction: InvoiceExtraction): Invoice {
  const { notes: _notes, ...fields } = extraction;
  return InvoiceSchema.parse({
    ...fields,
    raw: extraction,
  });
}

async function extractPdfText(bytes: Buffer) {
  const parser = new PDFParse({ data: Uint8Array.from(bytes) });

  try {
    const result = await parser.getText();
    return {
      text: normalizeExtractedText(result.text),
      pages: result.total,
    };
  } finally {
    await parser.destroy();
  }
}

async function generateInvoice({
  extractionPath,
  messages,
  abortSignal,
}: {
  extractionPath: InvoiceExtractionPath;
  messages: ModelMessage[];
  abortSignal?: AbortSignal;
}) {
  const { object } = await generateObject({
    model: getModel("smart"),
    schema: InvoiceExtractionSchema,
    schemaName: "Invoice",
    schemaDescription: "Structured invoice extracted from a PDF or image",
    instructions: EXTRACTION_INSTRUCTIONS,
    messages,
    maxRetries: 0,
    abortSignal,
    telemetry: {
      functionId:
        extractionPath === "text"
          ? "extract-invoice-text"
          : "extract-invoice-vision",
    },
  });

  return object;
}

export async function extractInvoiceFromDocument({
  documentId,
  userId,
  abortSignal,
}: {
  documentId: string;
  userId: string;
  abortSignal?: AbortSignal;
}): Promise<ExtractInvoiceResult> {
  const document = await getDocumentForUser(documentId, userId);

  if (!document) {
    return { ok: false, error: "Document not found." };
  }

  if (document.status !== "uploaded") {
    return { ok: false, error: "Document is not ready to extract." };
  }

  const bytes = await downloadObject(document.gcsPath);
  const isPdf = document.mime === PDF_MIME;

  let extractionPath: InvoiceExtractionPath = isPdf ? "text" : "vision";
  let pdfText = "";

  if (isPdf) {
    try {
      const parsed = await extractPdfText(bytes);

      if (parsed.pages > 0) {
        await setDocumentPages(document.id, userId, parsed.pages);
      }

      pdfText = parsed.text;
      extractionPath =
        pdfText.length >= TEXT_LAYER_MIN_CHARS ? "text" : "vision";
    } catch (error) {
      console.warn("PDF text extraction failed; using vision path", error);
      extractionPath = "vision";
    }
  }

  try {
    const extraction =
      extractionPath === "text"
        ? await generateInvoice({
            extractionPath,
            abortSignal,
            messages: [
              {
                role: "user",
                content: `Extract the invoice from this text.\n\nFile: ${document.fileName}\n\n${pdfText}`,
              },
            ],
          })
        : await generateInvoice({
            extractionPath,
            abortSignal,
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Extract the invoice from this ${isPdf ? "document" : "image"} (${document.fileName}).`,
                  },
                  {
                    type: "file",
                    mediaType: document.mime,
                    data: new Uint8Array(bytes),
                    filename: document.fileName,
                  },
                ],
              },
            ],
          });

    return {
      ok: true,
      documentId: document.id,
      fileName: document.fileName,
      extractionPath,
      invoice: toInvoice(extraction),
      notes: extraction.notes,
    };
  } catch (error) {
    console.error("Invoice extraction failed", error);
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not extract invoice fields.",
    };
  }
}
