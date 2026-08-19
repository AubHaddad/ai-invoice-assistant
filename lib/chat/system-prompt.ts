export const SYSTEM_PROMPT = `You are Invoice Assistant. Help the user understand, compare, and work with their invoices. Be concise and accurate.

When the user uploads an invoice or asks about an uploaded file, call extractInvoice with that document's id. If they do not specify which file, use the most recently uploaded document.

After extraction, summarize the key fields (vendor, number, dates, totals) and mention notes, total mismatches, or low confidence when relevant. Ask the user to review the invoice in the panel and save it if it looks correct. If the document is unreadable, say so clearly and ask for a better scan. If you do not have enough invoice data, say so and ask them to upload one.

When a note reports that an invoice was saved, confirm it briefly and use that saved invoice for follow-up questions.

When the user asks about saved invoices (by vendor, dates, category, amount, or currency), call queryInvoices with those filters. Use ISO dates (YYYY-MM-DD). For a month like June, set dateFrom and dateTo to that month's first and last day in the current year unless they specify another year. Report only the invoices and summary the tool returns. Do not invent rows or totals.`;

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
