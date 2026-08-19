import { getCurrentUserId } from "@/lib/auth/session";
import { isUuid } from "@/lib/chat/store";
import {
  getDocumentForUser,
  markDocumentFailed,
  markDocumentUploaded,
  setDocumentPages,
  toDocumentSummary,
} from "@/lib/documents/store";
import {
  rejectedDocumentSize,
  validateUploadedBytes,
} from "@/lib/documents/validate";
import {
  deleteObject,
  downloadObject,
  getObjectSize,
  objectExists,
} from "@/lib/storage/gcs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  if (!isUuid(id)) {
    return Response.json({ error: "Invalid document id" }, { status: 400 });
  }

  const document = await getDocumentForUser(id, userId);

  if (!document) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  if (document.status === "uploaded") {
    return Response.json({ document: toDocumentSummary(document) });
  }

  if (document.status !== "uploading") {
    return Response.json(
      { error: "Document is not awaiting upload" },
      { status: 409 },
    );
  }

  const rejectUpload = async (error: string) => {
    try {
      await deleteObject(document.gcsPath);
    } catch {
      // Keep the document failed even if storage cleanup does not succeed.
    }

    await markDocumentFailed(id, userId);

    return Response.json({ error }, { status: 400 });
  };

  const exists = await objectExists(document.gcsPath);

  if (!exists) {
    await markDocumentFailed(id, userId);
    return Response.json(
      { error: "File was not found in storage" },
      { status: 409 },
    );
  }

  const storedSize = await getObjectSize(document.gcsPath);

  if (storedSize !== null) {
    const sizeError = rejectedDocumentSize(storedSize);

    if (sizeError) {
      return rejectUpload(sizeError);
    }
  }

  const bytes = await downloadObject(document.gcsPath);
  const validation = await validateUploadedBytes({
    bytes,
    declaredMime: document.mime,
    sizeBytes: storedSize ?? bytes.length,
  });

  if (!validation.ok) {
    return rejectUpload(validation.error);
  }

  const uploaded = await markDocumentUploaded(id, userId);

  if (!uploaded) {
    return Response.json(
      { error: "Document could not be confirmed" },
      { status: 409 },
    );
  }

  if (validation.pageCount) {
    await setDocumentPages(id, userId, validation.pageCount);
  }

  return Response.json({
    document: toDocumentSummary({
      ...uploaded,
      pages: validation.pageCount ?? uploaded.pages,
    }),
  });
}
