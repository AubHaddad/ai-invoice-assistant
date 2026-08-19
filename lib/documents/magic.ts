import {
  PDF_MIME,
  type AllowedDocumentMimeType,
} from "./constants";

const PDF_MAGIC = Buffer.from("%PDF");
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF87_MAGIC = Buffer.from("GIF87a");
const GIF89_MAGIC = Buffer.from("GIF89a");
const RIFF_MAGIC = Buffer.from("RIFF");
const WEBP_MAGIC = Buffer.from("WEBP");

/** PDF spec allows a small header of garbage before `%PDF`. */
const PDF_MAGIC_SCAN_BYTES = 1024;

function startsWith(bytes: Buffer, magic: Buffer, offset = 0) {
  if (bytes.length < offset + magic.length) {
    return false;
  }

  return bytes.subarray(offset, offset + magic.length).equals(magic);
}

function findPdfMagicOffset(bytes: Buffer) {
  const limit = Math.min(bytes.length, PDF_MAGIC_SCAN_BYTES);

  for (let offset = 0; offset <= limit - PDF_MAGIC.length; offset += 1) {
    if (startsWith(bytes, PDF_MAGIC, offset)) {
      return offset;
    }
  }

  return -1;
}

export function detectDocumentMimeFromMagicBytes(
  bytes: Buffer,
): AllowedDocumentMimeType | null {
  if (findPdfMagicOffset(bytes) >= 0) {
    return PDF_MIME;
  }

  if (startsWith(bytes, JPEG_MAGIC)) {
    return "image/jpeg";
  }

  if (startsWith(bytes, PNG_MAGIC)) {
    return "image/png";
  }

  if (startsWith(bytes, GIF87_MAGIC) || startsWith(bytes, GIF89_MAGIC)) {
    return "image/gif";
  }

  if (
    startsWith(bytes, RIFF_MAGIC) &&
    bytes.length >= 12 &&
    startsWith(bytes, WEBP_MAGIC, 8)
  ) {
    return "image/webp";
  }

  return null;
}
