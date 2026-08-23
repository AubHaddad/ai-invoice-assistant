import { getCurrentUserId } from "@/lib/auth/session";
import { isUuid } from "@/lib/chat/store";
import { getDocumentForUser } from "@/lib/documents/store";
import { downloadObject } from "@/lib/storage/gcs";

function inlineContentDisposition(fileName: string) {
  const ascii = fileName
    .replace(/[^\u0020-\u007E]/g, "_")
    .replace(/["\\]/g, "_");

  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(
  _request: Request,
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

  if (!document || document.status !== "uploaded") {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    const bytes = await downloadObject(document.gcsPath);

    return new Response(Uint8Array.from(bytes), {
      headers: {
        "Content-Type": document.mime,
        "Content-Disposition": inlineContentDisposition(document.fileName),
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json({ error: "Document file was not found" }, { status: 404 });
  }
}
