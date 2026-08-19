import { SYSTEM_PROMPT } from "@/lib/ai/prompts";

export { SYSTEM_PROMPT };

export function instructionsWithDocuments(
  documents: Array<{ id: string; fileName: string; mime: string }>,
) {
  if (documents.length === 0) {
    return `${SYSTEM_PROMPT}

Uploaded documents in this conversation: none yet.`;
  }

  const list = documents
    .map(
      (document, index) =>
        `${index + 1}. ${document.fileName} (id: ${document.id}, type: ${document.mime})`,
    )
    .join("\n");

  return `${SYSTEM_PROMPT}

Uploaded documents in this conversation (most recent first):
${list}`;
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
