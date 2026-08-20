import "./pdf-dom-polyfill";
import { PDFParse } from "pdf-parse";
import { pdf } from "pdf-to-img";
import "server-only";

export const TEXT_LAYER_MIN_CHARS = 50;

export type PdfPageText = {
  pageNumber: number;
  text: string;
};

export type PdfPageImage = {
  pageNumber: number;
  bytes: Uint8Array;
  mediaType: "image/png";
};

function normalizeExtractedText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function hasUsableTextLayer(text: string) {
  return normalizeExtractedText(text).length >= TEXT_LAYER_MIN_CHARS;
}

export function concatenatePdfPages(pages: PdfPageText[]) {
  return pages
    .map((page) => {
      const body = page.text || "[no selectable text]";
      return `--- Page ${page.pageNumber} ---\n${body}`;
    })
    .join("\n\n");
}

export async function countPdfPages(bytes: Buffer) {
  const parser = new PDFParse({ data: Uint8Array.from(bytes) });

  try {
    const info = await parser.getInfo();
    return info.total;
  } finally {
    await parser.destroy();
  }
}

export async function extractPdfPages(bytes: Buffer) {
  const parser = new PDFParse({ data: Uint8Array.from(bytes) });

  try {
    const result = await parser.getText({ pageJoiner: "" });
    const pages: PdfPageText[] = result.pages.map((page, index) => ({
      pageNumber: page.num > 0 ? page.num : index + 1,
      text: normalizeExtractedText(page.text),
    }));

    return {
      pages,
      pageCount: result.total || pages.length,
      concatenated: concatenatePdfPages(pages),
    };
  } finally {
    await parser.destroy();
  }
}

export async function rasterizePdfPages(bytes: Buffer): Promise<PdfPageImage[]> {
  const document = await pdf(bytes, { scale: 2 });
  const pages: PdfPageImage[] = [];

  for (let pageNumber = 1; pageNumber <= document.length; pageNumber += 1) {
    const image = await document.getPage(pageNumber);
    pages.push({
      pageNumber,
      bytes: new Uint8Array(image),
      mediaType: "image/png",
    });
  }

  return pages;
}
