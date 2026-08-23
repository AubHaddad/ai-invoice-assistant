import { describe, expect, it } from "vitest";
import {
  DEFAULT_UPLOAD_USER_TEXT,
  getMessageAttachments,
  getMessageText,
} from "./message-text";
import type { InvoiceAssistantUIMessage } from "./types";

function message(
  parts: InvoiceAssistantUIMessage["parts"],
): Pick<InvoiceAssistantUIMessage, "parts"> {
  return { parts };
}

const invoicePdf = {
  documentId: "doc-1",
  fileName: "acme-invoice.pdf",
  mimeType: "application/pdf",
  sizeBytes: 12_345,
};

describe("getMessageText", () => {
  it("joins text parts and ignores attachments", () => {
    expect(
      getMessageText(
        message([
          { type: "text", text: "What's the total?" },
          { type: "data-attachment", data: invoicePdf },
        ]),
      ),
    ).toBe("What's the total?");
  });

  it("keeps the default extract prompt when a file is attached", () => {
    expect(
      getMessageText(
        message([
          { type: "text", text: DEFAULT_UPLOAD_USER_TEXT },
          { type: "data-attachment", data: invoicePdf },
        ]),
      ),
    ).toBe(DEFAULT_UPLOAD_USER_TEXT);
  });
});

describe("getMessageAttachments", () => {
  it("returns attachment data parts", () => {
    expect(
      getMessageAttachments(
        message([
          { type: "text", text: DEFAULT_UPLOAD_USER_TEXT },
          { type: "data-attachment", data: invoicePdf },
        ]),
      ),
    ).toEqual([invoicePdf]);
  });
});
