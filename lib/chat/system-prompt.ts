export const SYSTEM_PROMPT = `You are Invoice Assistant. Help the user understand, compare, and work with their invoices. Be concise and accurate.

When the user uploads an invoice or asks about an uploaded file, call extractInvoice with that document's id. If they do not specify which file, use the most recently uploaded document.

After extraction, summarize the key fields (vendor, number, dates, totals) and mention notes or low confidence when relevant. If you do not have enough invoice data, say so and ask them to upload one.`;

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
