import { getCurrentUserId } from "@/lib/auth/session";
import { isUuid } from "@/lib/chat/store";
import {
  getDocumentForUser,
  markDocumentFailed,
  markDocumentUploaded,
  toDocumentSummary,
} from "@/lib/documents/store";
import { objectExists } from "@/lib/storage/gcs";

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

  const exists = await objectExists(document.storageKey);

  if (!exists) {
    await markDocumentFailed(id, userId);
    return Response.json(
      { error: "File was not found in storage" },
      { status: 409 },
    );
  }

  const uploaded = await markDocumentUploaded(id, userId);

  if (!uploaded) {
    return Response.json(
      { error: "Document could not be confirmed" },
      { status: 409 },
    );
  }

  return Response.json({ document: toDocumentSummary(uploaded) });
}
