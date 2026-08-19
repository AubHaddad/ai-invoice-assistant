import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_PAGES,
  PDF_MIME,
} from "./constants";
import { detectDocumentMimeFromMagicBytes } from "./magic";
import { validateUploadedBytes } from "./validate";
import {
  GIF_MAGIC_BYTES,
  JPEG_MAGIC_BYTES,
  PNG_MAGIC_BYTES,
  WEBP_MAGIC_BYTES,
  buildTextPdf,
} from "@/evals/pdf";

describe("detectDocumentMimeFromMagicBytes", () => {
  it("recognizes PDF, JPEG, PNG, GIF, and WebP signatures", () => {
    expect(detectDocumentMimeFromMagicBytes(buildTextPdf("Invoice"))).toBe(
      PDF_MIME,
    );
    expect(detectDocumentMimeFromMagicBytes(JPEG_MAGIC_BYTES)).toBe("image/jpeg");
    expect(detectDocumentMimeFromMagicBytes(PNG_MAGIC_BYTES)).toBe("image/png");
    expect(detectDocumentMimeFromMagicBytes(GIF_MAGIC_BYTES)).toBe("image/gif");
    expect(detectDocumentMimeFromMagicBytes(WEBP_MAGIC_BYTES)).toBe("image/webp");
    expect(detectDocumentMimeFromMagicBytes(Buffer.from("not a file"))).toBeNull();
  });
});

describe("validateUploadedBytes", () => {
  let validPdf: Buffer;

  beforeAll(() => {
    validPdf = buildTextPdf("Acme invoice INV-1 total 100.00 USD");
  });

  it("accepts a well-formed one-page PDF", async () => {
    const result = await validateUploadedBytes({
      bytes: validPdf,
      declaredMime: PDF_MIME,
    });

    expect(result).toEqual({
      ok: true,
      mime: PDF_MIME,
      pageCount: 1,
      sizeBytes: validPdf.length,
    });
  });

  it("rejects empty and oversized files before parsing", async () => {
    await expect(
      validateUploadedBytes({
        bytes: Buffer.alloc(0),
        declaredMime: PDF_MIME,
      }),
    ).resolves.toEqual({ ok: false, error: "That file is empty." });

    await expect(
      validateUploadedBytes({
        bytes: validPdf,
        declaredMime: PDF_MIME,
        sizeBytes: MAX_DOCUMENT_BYTES + 1,
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: expect.stringMatching(/20\.0 MB or smaller/),
    });
  });

  it("rejects a declared PDF whose magic bytes are not PDF", async () => {
    const result = await validateUploadedBytes({
      bytes: JPEG_MAGIC_BYTES,
      declaredMime: PDF_MIME,
    });

    expect(result).toEqual({
      ok: false,
      error: "File contents do not match the declared type.",
    });
  });

  it("rejects random bytes that are not a PDF or image", async () => {
    const result = await validateUploadedBytes({
      bytes: Buffer.from("PK\x03\x04this is a zip"),
      declaredMime: PDF_MIME,
    });

    expect(result).toEqual({
      ok: false,
      error: "File contents do not match a PDF or image.",
    });
  });

  it("rejects a truncated PDF that cannot be parsed", async () => {
    const result = await validateUploadedBytes({
      bytes: Buffer.from("%PDF-1.4\n1 0 obj\n<< >>\nendobj\n"),
      declaredMime: PDF_MIME,
    });

    expect(result).toEqual({
      ok: false,
      error: "That PDF could not be read. Try exporting it again.",
    });
  });

  it("rejects PDFs over the page limit", async () => {
    const tooManyPages = buildTextPdf("Invoice page", MAX_DOCUMENT_PAGES + 1);
    const result = await validateUploadedBytes({
      bytes: tooManyPages,
      declaredMime: PDF_MIME,
    });

    expect(result).toEqual({
      ok: false,
      error: `PDFs can have at most ${MAX_DOCUMENT_PAGES} pages.`,
    });
  });

  it("accepts image magic bytes for the matching declared type", async () => {
    await expect(
      validateUploadedBytes({
        bytes: PNG_MAGIC_BYTES,
        declaredMime: "image/png",
      }),
    ).resolves.toMatchObject({
      ok: true,
      mime: "image/png",
      pageCount: null,
    });
  });
});
