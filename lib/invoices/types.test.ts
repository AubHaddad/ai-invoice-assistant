import { describe, expect, it } from "vitest";
import {
  invoiceSavedSystemText,
  savedDocumentIdFromSystemText,
} from "./types";

const saved = {
  invoiceId: "11111111-1111-4111-8111-111111111111",
  documentId: "22222222-2222-4222-8222-222222222222",
  vendor: "Acme",
  invoiceNumber: "INV-1",
  total: 120,
  currency: "USD",
  category: "software" as const,
};

describe("savedDocumentIdFromSystemText", () => {
  it("reads the document id from a save confirmation", () => {
    expect(
      savedDocumentIdFromSystemText(invoiceSavedSystemText(saved)),
    ).toBe(saved.documentId);
  });

  it("returns null when the text is not a save confirmation", () => {
    expect(savedDocumentIdFromSystemText("Invoice extracted.")).toBeNull();
  });
});
