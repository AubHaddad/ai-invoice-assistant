function escapePdfLiteral(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function padOffset(offset: number) {
  return String(offset).padStart(10, "0");
}

/**
 * Minimal text-layer PDF that pdf-parse can read. ASCII-only so byte offsets
 * match string indices. Each input line is a separate text show so extractors
 * keep the full payload.
 */
export function buildTextPdf(text: string, pageCount = 1) {
  if (pageCount < 1) {
    throw new Error("pageCount must be at least 1");
  }

  const fontId = 3;
  const parts = new Map<number, string>();
  let nextId = 4;
  const pageIds: number[] = [];

  for (let index = 0; index < pageCount; index += 1) {
    const contentId = nextId;
    const pageId = nextId + 1;
    nextId += 2;
    pageIds.push(pageId);

    const pageText =
      index === 0 ? text : `${text}\n\nPage ${index + 1} of ${pageCount}`;
    const lines = pageText.split(/\n/).map((line) => (line.length > 0 ? line : " "));

    const ops = ["BT /F1 12 Tf 72 720 Td"];
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) {
        ops.push("0 -16 Td");
      }
      ops.push(`(${escapePdfLiteral(line)}) Tj`);
    });
    ops.push("ET");
    const stream = ops.join("\n");

    parts.set(contentId, `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    parts.set(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`,
    );
  }

  parts.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  parts.set(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`,
  );
  parts.set(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const maxId = Math.max(...parts.keys());
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const offsets = new Map<number, number>([[0, 0]]);
  let offset = chunks[0].length;

  for (let id = 1; id <= maxId; id += 1) {
    const body = parts.get(id);
    if (!body) {
      continue;
    }

    const object = Buffer.from(`${id} 0 obj\n${body}\nendobj\n`);
    offsets.set(id, offset);
    chunks.push(object);
    offset += object.length;
  }

  const xrefStart = offset;
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;

  for (let id = 1; id <= maxId; id += 1) {
    xref += `${padOffset(offsets.get(id) ?? 0)} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  chunks.push(Buffer.from(xref), Buffer.from(trailer));

  return Buffer.concat(chunks);
}

export const JPEG_MAGIC_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

export const PNG_MAGIC_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52,
]);

export const GIF_MAGIC_BYTES = Buffer.from("GIF89a\x01\x00\x01\x00\x00\x00\x00");

export const WEBP_MAGIC_BYTES = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x10, 0x00, 0x00, 0x00]),
  Buffer.from("WEBP"),
]);
