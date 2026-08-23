import { generateObject, type ModelMessage } from "ai";
import "server-only";
import { getModel } from "@/lib/ai/models";
import { toPublicErrorMessage } from "@/lib/chat/error-message";
import { AGENT_TIMEOUT } from "@/lib/chat/loop";
import { PDF_MIME } from "@/lib/documents/constants";
import {
  getDocumentForUser,
  setDocumentPages,
} from "@/lib/documents/store";
import {
  UNTRUSTED_DOCUMENT_POLICY,
  buildExtractionTextPrompt,
  untrustedImageExtractionPrompt,
  wrapUntrustedDocumentText,
} from "@/lib/documents/untrusted";
import { validateUploadedBytes } from "@/lib/documents/validate";
import { logFailureToLangfuse } from "@/lib/observability/log-failure";
import { abortAfter } from "@/lib/timeout";
import {
  InvoiceExtractionSchema,
  InvoiceSchema,
  type Invoice,
  type InvoiceExtraction,
} from "@/lib/schemas";
import { downloadObject } from "@/lib/storage/gcs";
import {
  concatenatePdfPages,
  extractPdfPages,
  hasUsableTextLayer,
  rasterizePdfPages,
  TEXT_LAYER_MIN_CHARS,
  type PdfPageImage,
  type PdfPageText,
} from "./pdf";
import { categorizeExpense, descriptionFromLineItems } from "./categorize";
import {
  appendNote,
  mergeLineItems,
  mergePageExtractions,
  reconcileTotals,
} from "./postprocess";
import type {
  ExtractInvoiceRejected,
  ExtractInvoiceResult,
  ExtractInvoiceUnreadable,
  InvoiceExtractionPath,
} from "./types";

export type {
  ExtractInvoiceFailure,
  ExtractInvoiceRejected,
  ExtractInvoiceResult,
  ExtractInvoiceSuccess,
  ExtractInvoiceUnreadable,
  InvoiceExtractionPath,
} from "./types";

const EXTRACTION_INSTRUCTIONS = `Extract invoice fields from the provided document.
${UNTRUSTED_DOCUMENT_POLICY}
Pages are labeled with markers like "--- Page 1 ---". Combine line items from every page into one list. Do not duplicate the same line item.
Use ISO dates (YYYY-MM-DD).
Amounts are numbers in the invoice currency, not cents.
confidence is a number from 0 to 1 for how sure you are.
notes must describe anything ambiguous, missing, unreadable, or inferred. Empty string if the invoice is clear.
Set unreadable to true if the document is blank, too blurry, or not an invoice. Do not invent invoice numbers, vendors, or totals.
If a nullable field is absent, use null.`;

const UNREADABLE_MESSAGE =
  "This document is unreadable. Try a clearer photo or a PDF with a text layer.";

function unreadableResult(
  document: { id: string; fileName: string },
  error = UNREADABLE_MESSAGE,
): ExtractInvoiceUnreadable {
  return {
    ok: false,
    code: "unreadable",
    error,
    documentId: document.id,
    fileName: document.fileName,
  };
}

function rejectedResult(
  document: { id: string; fileName: string },
  error: string,
): ExtractInvoiceRejected {
  return {
    ok: false,
    code: "rejected",
    error,
    documentId: document.id,
    fileName: document.fileName,
  };
}

function toInvoice(extraction: InvoiceExtraction): Invoice {
  const { notes: _notes, unreadable: _unreadable, ...fields } = extraction;
  return InvoiceSchema.parse({
    ...fields,
    category: null,
    lineItems: mergeLineItems(fields.lineItems),
    raw: extraction,
  });
}

async function classifyInvoice(
  invoice: Invoice,
  abortSignal?: AbortSignal,
): Promise<Invoice> {
  const result = await categorizeExpense(
    {
      description: descriptionFromLineItems(invoice.lineItems, invoice.vendor),
      vendor: invoice.vendor,
    },
    { abortSignal },
  );

  if (!result.ok) {
    return invoice;
  }

  return { ...invoice, category: result.category };
}

function finalizeExtraction(extraction: InvoiceExtraction) {
  const lineItems = mergeLineItems(extraction.lineItems);
  const reconciled = reconcileTotals({
    lineItems,
    tax: extraction.tax,
    total: extraction.total,
  });
  const notes = reconciled.ok
    ? extraction.notes
    : appendNote(extraction.notes, reconciled.warning);

  return {
    ...extraction,
    lineItems,
    notes,
    unreadable: false,
  };
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
    abortSignal: abortAfter(AGENT_TIMEOUT.tools.extractInvoiceMs, abortSignal),
    telemetry: {
      functionId: `extract-invoice-${extractionPath}`,
    },
  });

  return object;
}

async function extractFromText({
  fileName,
  text,
  abortSignal,
}: {
  fileName: string;
  text: string;
  abortSignal?: AbortSignal;
}) {
  return generateInvoice({
    extractionPath: "text",
    abortSignal,
    messages: [
      {
        role: "user",
        content: buildExtractionTextPrompt(fileName, text),
      },
    ],
  });
}

async function extractFromImages({
  fileName,
  prompt,
  images,
  abortSignal,
}: {
  fileName: string;
  prompt: string;
  images: PdfPageImage[];
  abortSignal?: AbortSignal;
}) {
  return generateInvoice({
    extractionPath: images.length > 1 ? "mixed" : "vision",
    abortSignal,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: untrustedImageExtractionPrompt(fileName, prompt),
          },
          ...images.map((image) => ({
            type: "file" as const,
            mediaType: image.mediaType,
            data: image.bytes,
            filename: `page-${image.pageNumber}.png`,
          })),
        ],
      },
    ],
  });
}

async function extractEachPageThenMerge({
  fileName,
  textPages,
  imagePages,
  abortSignal,
}: {
  fileName: string;
  textPages: PdfPageText[];
  imagePages: PdfPageImage[];
  abortSignal?: AbortSignal;
}) {
  const imagesByPage = new Map(
    imagePages.map((image) => [image.pageNumber, image]),
  );
  const pageResults: InvoiceExtraction[] = [];

  for (const page of textPages) {
    const image = imagesByPage.get(page.pageNumber);

    try {
      const extraction = hasUsableTextLayer(page.text)
        ? await extractFromText({
            fileName: `${fileName} (page ${page.pageNumber})`,
            text: concatenatePdfPages([page]),
            abortSignal,
          })
        : image
          ? await extractFromImages({
              fileName: `${fileName} (page ${page.pageNumber})`,
              prompt: `Extract invoice fields from page ${page.pageNumber}. Combine with other pages later.`,
              images: [image],
              abortSignal,
            })
          : null;

      if (extraction && !extraction.unreadable) {
        pageResults.push(extraction);
      }
    } catch (error) {
      console.warn(`Page ${page.pageNumber} extraction failed`, error);
    }
  }

  return mergePageExtractions(pageResults);
}

async function extractPdfInvoice({
  bytes,
  fileName,
  abortSignal,
}: {
  bytes: Buffer;
  fileName: string;
  abortSignal?: AbortSignal;
}) {
  let textPages: PdfPageText[] = [];
  let concatenated = "";
  let pageCount = 0;

  try {
    const parsed = await extractPdfPages(bytes);
    textPages = parsed.pages;
    concatenated = parsed.concatenated;
    pageCount = parsed.pageCount;
  } catch (error) {
    console.warn("PDF text extraction failed; using vision path", error);
  }

  const usableCharCount = textPages.reduce(
    (sum, page) => sum + page.text.length,
    0,
  );
  const textIsUsable = usableCharCount >= TEXT_LAYER_MIN_CHARS;
  const sparsePages = textPages.filter((page) => !hasUsableTextLayer(page.text));
  const needsVision = !textIsUsable || sparsePages.length > 0;

  if (!needsVision) {
    const extraction = await extractFromText({
      fileName,
      text: concatenated,
      abortSignal,
    });

    return {
      extraction,
      extractionPath: "text" as const,
      pageCount,
    };
  }

  let images: PdfPageImage[] = [];

  try {
    images = await rasterizePdfPages(bytes);
  } catch (error) {
    console.warn("PDF rasterization failed", error);
  }

  if (images.length === 0) {
    if (textIsUsable) {
      const extraction = await extractFromText({
        fileName,
        text: concatenated,
        abortSignal,
      });
      return { extraction, extractionPath: "text" as const, pageCount };
    }

    throw new Error("unreadable");
  }

  if (pageCount > 1 && images.length > 1) {
    const merged = await extractEachPageThenMerge({
      fileName,
      textPages:
        textPages.length > 0
          ? textPages
          : images.map((image) => ({
              pageNumber: image.pageNumber,
              text: "",
            })),
      imagePages: images,
      abortSignal,
    });

    if (merged) {
      return {
        extraction: merged,
        extractionPath: textIsUsable ? ("mixed" as const) : ("vision" as const),
        pageCount: images.length,
      };
    }
  }

  const visionPages = textIsUsable
    ? images.filter((image) =>
        sparsePages.some((page) => page.pageNumber === image.pageNumber),
      )
    : images;

  const extraction = await extractFromImages({
    fileName,
    prompt: textIsUsable
      ? `Selectable text is below; attached images are pages without a usable text layer.\n\n${wrapUntrustedDocumentText({ fileName, text: concatenated })}`
      : "Extract the invoice from these page images, in order.",
    images: visionPages.length > 0 ? visionPages : images,
    abortSignal,
  });

  return {
    extraction,
    extractionPath: textIsUsable ? ("mixed" as const) : ("vision" as const),
    pageCount: images.length || pageCount,
  };
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
  const validation = await validateUploadedBytes({
    bytes,
    declaredMime: document.mime,
  });

  if (!validation.ok) {
    return rejectedResult(document, validation.error);
  }

  const isPdf = validation.mime === PDF_MIME;

  try {
    if (isPdf) {
      const { extraction, extractionPath, pageCount } = await extractPdfInvoice({
        bytes,
        fileName: document.fileName,
        abortSignal,
      });

      if (pageCount > 0) {
        await setDocumentPages(document.id, userId, pageCount);
      }

      if (extraction.unreadable) {
        return unreadableResult(document);
      }

      const finalized = finalizeExtraction(extraction);

      return {
        ok: true,
        documentId: document.id,
        fileName: document.fileName,
        extractionPath,
        invoice: await classifyInvoice(toInvoice(finalized), abortSignal),
        notes: finalized.notes,
      };
    }

    const extraction = await generateInvoice({
      extractionPath: "vision",
      abortSignal,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: untrustedImageExtractionPrompt(document.fileName),
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

    if (extraction.unreadable) {
      return unreadableResult(document);
    }

    const finalized = finalizeExtraction(extraction);

    return {
      ok: true,
      documentId: document.id,
      fileName: document.fileName,
      extractionPath: "vision",
      invoice: await classifyInvoice(toInvoice(finalized), abortSignal),
      notes: finalized.notes,
    };
  } catch (error) {
    console.error("Invoice extraction failed", error);
    logFailureToLangfuse({
      source: "tool",
      error,
      extra: { tool: "extractInvoice" },
    });

    const message = error instanceof Error ? error.message : "";

    if (message === "unreadable" || /unreadable|could not parse|no object/i.test(message)) {
      return unreadableResult(document);
    }

    return {
      ok: false,
      error: toPublicErrorMessage(error, "Could not extract invoice fields."),
    };
  }
}
