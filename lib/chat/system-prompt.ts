import type { SystemModelMessage } from "ai";
import { ANTHROPIC_CACHE_CONTROL } from "@/lib/ai/cache";
import { SYSTEM_PROMPT } from "@/lib/ai/prompts";

export { SYSTEM_PROMPT };

export function uploadedDocumentsNote(
  documents: Array<{ id: string; fileName: string; mime: string }>,
) {
  if (documents.length === 0) {
    return "Uploaded documents in this conversation: none yet.";
  }

  const list = documents
    .map(
      (document, index) =>
        `${index + 1}. ${document.fileName} (id: ${document.id}, type: ${document.mime})`,
    )
    .join("\n");

  return `Uploaded documents in this conversation (most recent first):\n${list}`;
}

export function instructionsWithDocuments(
  documents: Array<{ id: string; fileName: string; mime: string }>,
) {
  return `${SYSTEM_PROMPT}

${uploadedDocumentsNote(documents)}`;
}

export function instructionsWithContext(
  instructions: string,
  notes: string[],
) {
  const extra = notes.map((note) => note.trim()).filter(Boolean);

  if (extra.length === 0) {
    return instructions;
  }

  return `${instructions}

Additional context:
${extra.map((note) => `- ${note}`).join("\n")}`;
}

export function conversationContextMessage({
  documents,
  notes,
}: {
  documents: Array<{ id: string; fileName: string; mime: string }>;
  notes: string[];
}): SystemModelMessage {
  return {
    role: "system",
    content: instructionsWithContext(uploadedDocumentsNote(documents), notes),
  };
}

/** Static system prompt with an Anthropic cache breakpoint. Variable context is a second, uncached system message. */
export function cachedChatInstructions(
  extra?: SystemModelMessage,
): SystemModelMessage[] {
  const cached: SystemModelMessage = {
    role: "system",
    content: SYSTEM_PROMPT,
    providerOptions: ANTHROPIC_CACHE_CONTROL,
  };

  return extra ? [cached, extra] : [cached];
}

export function systemInstructionsText(instructions: SystemModelMessage[]) {
  return instructions
    .map((message) =>
      typeof message.content === "string" ? message.content : "",
    )
    .filter(Boolean)
    .join("\n\n");
}
