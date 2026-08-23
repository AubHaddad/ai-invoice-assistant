import type { UIMessage } from "ai";
import type { MessageAttachment } from "./types";

export const DEFAULT_UPLOAD_USER_TEXT = "Extract the uploaded invoice.";

export function getMessageText(message: Pick<UIMessage, "parts">) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function isAttachmentPart(
  part: UIMessage["parts"][number],
): part is { type: "data-attachment"; id?: string; data: MessageAttachment } {
  if (part.type !== "data-attachment" || !("data" in part)) {
    return false;
  }

  const data = part.data;

  return (
    typeof data === "object" &&
    data !== null &&
    "documentId" in data &&
    "fileName" in data &&
    "mimeType" in data &&
    "sizeBytes" in data &&
    typeof data.documentId === "string" &&
    typeof data.fileName === "string" &&
    typeof data.mimeType === "string" &&
    typeof data.sizeBytes === "number"
  );
}

export function getMessageAttachments(
  message: Pick<UIMessage, "parts">,
): MessageAttachment[] {
  return message.parts.flatMap((part) =>
    isAttachmentPart(part) ? [part.data] : [],
  );
}
