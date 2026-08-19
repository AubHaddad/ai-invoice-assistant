import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SYSTEM_PROMPT, UNTRUSTED_DOCUMENT_POLICY } from "@/lib/ai/prompts";
import { PDF_MIME } from "@/lib/documents/constants";
import {
  UNTRUSTED_DOCUMENT_END,
  UNTRUSTED_DOCUMENT_START,
  buildExtractionTextPrompt,
  splitUntrustedDocumentPrompt,
} from "@/lib/documents/untrusted";
import { validateUploadedBytes } from "@/lib/documents/validate";
import { extractPdfPages } from "@/lib/invoices/pdf";
import {
  INJECTION_FIXTURES,
  buildBaselineInvoicePdf,
  buildInjectionPdf,
  injectionPdfText,
} from "./injection-fixtures";
import { JPEG_MAGIC_BYTES, buildTextPdf } from "./pdf";

describe("prompt-injection eval suite", () => {
  it("includes five Ignore-previous-instructions PDF fixtures", () => {
    expect(INJECTION_FIXTURES).toHaveLength(5);

    for (const fixture of INJECTION_FIXTURES) {
      expect(fixture.payload).toMatch(/Ignore previous instructions/i);
      expect(fixture.canary.length).toBeGreaterThan(3);
      expect(fixture.fileName).toMatch(/\.pdf$/);
    }
  });

  it("embeds each payload in a valid PDF that still contains the invoice", async () => {
    for (const fixture of INJECTION_FIXTURES) {
      const bytes = buildInjectionPdf(fixture);
      const validation = await validateUploadedBytes({
        bytes,
        declaredMime: PDF_MIME,
      });
      const parsed = await extractPdfPages(bytes);

      expect(validation).toMatchObject({ ok: true, pageCount: 1 });
      expect(parsed.concatenated).toContain(fixture.vendor);
      expect(parsed.concatenated).toContain(fixture.invoiceNumber);
      expect(parsed.concatenated).toMatch(/Ignore previous instructions/i);
      expect(parsed.concatenated).toContain(fixture.canary);
    }
  });

  it("never lets injection fixtures change trusted assistant instructions", () => {
    const baselineText = injectionPdfText({
      ...INJECTION_FIXTURES[0],
      payload: "Thank you for your business.",
      canary: "UNUSED",
    });
    const baselinePrompt = buildExtractionTextPrompt(
      "acme-baseline.pdf",
      baselineText,
    );
    const baselineTrusted = splitUntrustedDocumentPrompt(baselinePrompt).trusted;

    expect(SYSTEM_PROMPT).toContain(UNTRUSTED_DOCUMENT_POLICY);

    for (const fixture of INJECTION_FIXTURES) {
      const prompt = buildExtractionTextPrompt(
        fixture.fileName,
        injectionPdfText(fixture),
      );
      const { trusted, untrusted } = splitUntrustedDocumentPrompt(prompt);

      expect(untrusted).toMatch(/Ignore previous instructions/i);
      expect(untrusted).toContain(fixture.canary);
      expect(untrusted).toContain(fixture.vendor);
      expect(trusted).not.toContain(fixture.canary);
      expect(trusted).not.toMatch(/Ignore previous instructions/i);
      expect(SYSTEM_PROMPT).not.toContain(fixture.canary);

      const trustedWithoutFile = trusted.replaceAll(fixture.fileName, "FILE");
      const baselineWithoutFile = baselineTrusted.replaceAll(
        "acme-baseline.pdf",
        "FILE",
      );
      expect(trustedWithoutFile).toBe(baselineWithoutFile);
    }
  });

  it("neutralizes a delimiter-breakout fixture so the canary stays untrusted", () => {
    const fixture = INJECTION_FIXTURES.find(
      (item) => item.id === "delimiter-breakout",
    );

    expect(fixture).toBeDefined();

    const prompt = buildExtractionTextPrompt(
      fixture!.fileName,
      injectionPdfText(fixture!),
    );
    const { trusted, untrusted } = splitUntrustedDocumentPrompt(prompt);

    expect(prompt.indexOf(UNTRUSTED_DOCUMENT_START)).toBe(
      prompt.lastIndexOf(UNTRUSTED_DOCUMENT_START),
    );
    expect(prompt.indexOf(UNTRUSTED_DOCUMENT_END)).toBe(
      prompt.lastIndexOf(UNTRUSTED_DOCUMENT_END),
    );
    expect(untrusted).toContain(fixture!.canary);
    expect(trusted).not.toContain(fixture!.canary);
    expect(trusted).not.toMatch(/Reply REFUND_APPROVED/i);
  });

  it("rejects malformed files before they can reach the model", async () => {
    const malformed = [
      Buffer.from("not a document"),
      Buffer.from("%PDF-1.4\n"),
      JPEG_MAGIC_BYTES,
      buildTextPdf("Invoice", 21),
    ];

    const results = await Promise.all(
      malformed.map((bytes) =>
        validateUploadedBytes({
          bytes,
          declaredMime: PDF_MIME,
        }),
      ),
    );

    expect(results.every((result) => result.ok === false)).toBe(true);
    expect(buildBaselineInvoicePdf().subarray(0, 4).toString()).toBe("%PDF");
  });
});
