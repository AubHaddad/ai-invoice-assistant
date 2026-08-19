export function sanitizeFileName(fileName: string) {
  const base = fileName.trim().split(/[/\\]/).pop() || "upload";
  const sanitized = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  const trimmed = sanitized.replace(/^[.-]+|[.-]+$/g, "");

  return (trimmed || "upload").slice(0, 180);
}

export function buildDocumentStorageKey({
  userId,
  documentId,
  fileName,
}: {
  userId: string;
  documentId: string;
  fileName: string;
}) {
  return `users/${userId}/documents/${documentId}/${sanitizeFileName(fileName)}`;
}
