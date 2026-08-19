import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateObject } from "ai";
import {
  INJECTION_FIXTURES,
  buildInjectionPdf,
} from "@/evals/injection-fixtures";
import {
  UNTRUSTED_DOCUMENT_POLICY,
  splitUntrustedDocumentPrompt,
} from "@/lib/documents/untrusted";
import { PDF_MIME } from "@/lib/documents/constants";

vi.mock("server-only", () => ({}));
vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));
vi.mock("@/lib/ai/models", () => ({
  getModel: vi.fn(() => "smart-model"),
}));
vi.mock("@/lib/documents/store", () => ({
  getDocumentForUser: vi.fn(),
  setDocumentPages: vi.fn(),
}));
vi.mock("@/lib/storage/gcs", () => ({
  downloadObject: vi.fn(),
}));
vi.mock("@/lib/invoices/categorize", () => ({
  categorizeExpense: vi.fn(),
  descriptionFromLineItems: vi.fn(() => "Consulting"),
}));
vi.mock("@/lib/observability/log-failure", () => ({
  logFailureToLangfuse: vi.fn(),
}));

import { getDocumentForUser, setDocumentPages } from "@/lib/documents/store";
import { downloadObject } from "@/lib/storage/gcs";
import { categorizeExpense } from "@/lib/invoices/categorize";
import { extractInvoiceFromDocument } from "./extract";

const generateObjectMock = vi.mocked(generateObject);
const getDocumentForUserMock = vi.mocked(getDocumentForUser);
const downloadObjectMock = vi.mocked(downloadObject);
const categorizeExpenseMock = vi.mocked(categorizeExpense);
const setDocumentPagesMock = vi.mocked(setDocumentPages);

const extractionObject = {
  vendor: "Acme Corp",
  invoiceNumber: "INV-9001",
  issueDate: "2026-08-01",
  dueDate: null,
  currency: "USD",
  subtotal: 100,
  tax: 0,
  total: 100,
  confidence: 0.9,
  unreadable: false,
  notes: "",
  lineItems: [
    {
      description: "Consulting services",
      quantity: 1,
      unitPrice: 100,
      amount: 100,
    },
  ],
};

function uploadedDocument(fileName: string) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "user-1",
    conversationId: null,
    fileName,
    mime: PDF_MIME,
    sizeBytes: 1024,
    gcsPath: "users/user-1/documents/doc/file.pdf",
    status: "uploaded" as const,
    pages: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function userTextFromGenerateObject() {
  const call = generateObjectMock.mock.calls[0]?.[0] as {
    instructions?: string;
    messages?: Array<{ content: unknown }>;
  };
  const content = call?.messages?.[0]?.content;

  expect(typeof content).toBe("string");
  expect(typeof call.instructions).toBe("string");

  return {
    instructions: call.instructions as string,
    text: content as string,
  };
}

describe("extractInvoiceFromDocument guardrails", () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
    getDocumentForUserMock.mockReset();
    downloadObjectMock.mockReset();
    categorizeExpenseMock.mockReset();
    setDocumentPagesMock.mockReset();

    categorizeExpenseMock.mockResolvedValue({
      ok: true,
      category: "other",
      reason: "Consulting",
      vendor: "Acme Corp",
      description: "Consulting",
    });
  });

  it("rejects malformed files before calling the model", async () => {
    getDocumentForUserMock.mockResolvedValue(uploadedDocument("malware.pdf"));
    downloadObjectMock.mockResolvedValue(Buffer.from("not a pdf"));

    const result = await extractInvoiceFromDocument({
      documentId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "rejected",
      error: "File contents do not match a PDF or image.",
    });
    expect(generateObjectMock).not.toHaveBeenCalled();
  });

  it("wraps injection-fixture text as untrusted data and keeps canaries out of instructions", async () => {
    const fixture = INJECTION_FIXTURES[0];
    getDocumentForUserMock.mockResolvedValue(uploadedDocument(fixture.fileName));
    downloadObjectMock.mockResolvedValue(buildInjectionPdf(fixture));
    generateObjectMock.mockResolvedValue({ object: extractionObject } as never);

    const result = await extractInvoiceFromDocument({
      documentId: "11111111-1111-4111-8111-111111111111",
      userId: "user-1",
    });

    expect(result).toMatchObject({ ok: true, invoice: { vendor: "Acme Corp" } });

    const { instructions, text } = userTextFromGenerateObject();
    const { trusted, untrusted } = splitUntrustedDocumentPrompt(text);

    expect(instructions).toContain(UNTRUSTED_DOCUMENT_POLICY);
    expect(untrusted).toContain(fixture.payload);
    expect(untrusted).toContain(fixture.canary);
    expect(trusted).not.toContain(fixture.canary);
    expect(instructions).not.toContain(fixture.canary);
  });
});
