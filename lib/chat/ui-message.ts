import type { UIMessage } from "ai";
import type { Message, MessageContent } from "@/lib/db/schema";
import { getMessageText } from "./message-text";
import type { InvoiceAssistantUIMessage } from "./types";

export { getMessageText };

export function toUIMessage(row: Message): InvoiceAssistantUIMessage | null {
  if (row.role === "tool") {
    return null;
  }

  return {
    id: row.id,
    role: row.role,
    parts: row.content as InvoiceAssistantUIMessage["parts"],
  };
}

export function toMessageContent(message: UIMessage): MessageContent {
  return message.parts as MessageContent;
}
