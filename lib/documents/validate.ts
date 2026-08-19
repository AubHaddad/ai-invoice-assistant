import "server-only";
import {
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_PAGES,
  PDF_MIME,
  formatFileSize,
  isAllowedDocumentMimeType,
  type AllowedDocumentMimeType,
} from "./constants";
import { detectDocumentMimeFromMagicBytes } from "./magic";
import { countPdfPages } from "@/lib/invoices/pdf";

export type DocumentValidationSuccess = {
  ok: true;
  mime: AllowedDocumentMimeType;
  pageCount: number | null;
  sizeBytes: number;
};

export type DocumentValidationFailure = {
  ok: false;
  error: string;
};

export type DocumentValidationResult =
  | DocumentValidationSuccess
  | DocumentValidationFailure;

export function rejectedDocumentSize(sizeBytes: number) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return "That file is empty.";
  }

  if (sizeBytes > MAX_DOCUMENT_BYTES) {
    return `Files must be ${formatFileSize(MAX_DOCUMENT_BYTES)} or smaller.`;
  }

  return null;
}

export async function validateUploadedBytes({
  bytes,
  declaredMime,
  sizeBytes = bytes.length,
}: {
  bytes: Buffer;
  declaredMime: string;
  sizeBytes?: number;
}): Promise<DocumentValidationResult> {
  const sizeError = rejectedDocumentSize(sizeBytes);

  if (sizeError) {
    return { ok: false, error: sizeError };
  }

  if (bytes.length <= 0) {
    return { ok: false, error: "That file is empty." };
  }

  if (bytes.length > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      error: `Files must be ${formatFileSize(MAX_DOCUMENT_BYTES)} or smaller.`,
    };
  }

  if (!isAllowedDocumentMimeType(declaredMime)) {
    return { ok: false, error: "Unsupported file type. Use a PDF or image." };
  }

  const detectedMime = detectDocumentMimeFromMagicBytes(bytes);

  if (!detectedMime) {
    return {
      ok: false,
      error: "File contents do not match a PDF or image.",
    };
  }

  if (detectedMime !== declaredMime) {
    return {
      ok: false,
      error: "File contents do not match the declared type.",
    };
  }

  if (declaredMime !== PDF_MIME) {
    return {
      ok: true,
      mime: declaredMime,
      pageCount: null,
      sizeBytes: bytes.length,
    };
  }

  let pageCount: number;

  try {
    pageCount = await countPdfPages(bytes);
  } catch {
    return {
      ok: false,
      error: "That PDF could not be read. Try exporting it again.",
    };
  }

  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return {
      ok: false,
      error: "That PDF could not be read. Try exporting it again.",
    };
  }

  if (pageCount > MAX_DOCUMENT_PAGES) {
    return {
      ok: false,
      error: `PDFs can have at most ${MAX_DOCUMENT_PAGES} pages.`,
    };
  }

  return {
    ok: true,
    mime: PDF_MIME,
    pageCount,
    sizeBytes: bytes.length,
  };
}
