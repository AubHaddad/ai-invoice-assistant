export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AllowedDocumentMimeType =
  (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number];

const MIME_BY_EXTENSION: Record<string, AllowedDocumentMimeType> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

export const DOCUMENT_FILE_ACCEPT = [
  ...ALLOWED_DOCUMENT_MIME_TYPES,
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
].join(",");

export function isAllowedDocumentMimeType(
  value: string,
): value is AllowedDocumentMimeType {
  return (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(value);
}

export function mimeTypeFromFileName(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension) {
    return null;
  }

  return MIME_BY_EXTENSION[extension] ?? null;
}

export function resolveDocumentMimeType(file: Pick<File, "name" | "type">) {
  if (isAllowedDocumentMimeType(file.type)) {
    return file.type;
  }

  return mimeTypeFromFileName(file.name);
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
