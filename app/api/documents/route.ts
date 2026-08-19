import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/session";
import { isUuid } from "@/lib/chat/store";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  isAllowedDocumentMimeType,
  mimeTypeFromFileName,
} from "@/lib/documents/constants";
import {
  createUploadingDocument,
  markDocumentFailed,
  toDocumentSummary,
} from "@/lib/documents/store";
import { createV4UploadUrl } from "@/lib/storage/gcs";

const createDocumentBody = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(127),
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
  conversationId: z.string().optional(),
});

function resolveMimeType(fileName: string, mimeType: string) {
  if (isAllowedDocumentMimeType(mimeType)) {
    return mimeType;
  }

  return mimeTypeFromFileName(fileName);
}

export async function POST(req: Request) {
  const userId = await getCurrentUserId();

  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createDocumentBody.safeParse(json);

  if (!parsed.success) {
    return Response.json({ error: "Invalid upload request" }, { status: 400 });
  }

  const { fileName, sizeBytes, conversationId } = parsed.data;

  if (conversationId && !isUuid(conversationId)) {
    return Response.json({ error: "Invalid conversation id" }, { status: 400 });
  }

  const mimeType = resolveMimeType(fileName, parsed.data.mimeType);

  if (!mimeType) {
    return Response.json(
      {
        error: `Unsupported file type. Use PDF or image (${ALLOWED_DOCUMENT_MIME_TYPES.join(", ")}).`,
      },
      { status: 400 },
    );
  }

  const document = await createUploadingDocument({
    userId,
    conversationId,
    fileName,
    mimeType,
    sizeBytes,
  });

  try {
    const uploadUrl = await createV4UploadUrl({
      storageKey: document.gcsPath,
      contentType: mimeType,
    });

    return Response.json({
      document: toDocumentSummary(document),
      uploadUrl,
      headers: { "Content-Type": mimeType },
    });
  } catch (error) {
    await markDocumentFailed(document.id, userId);
    throw error;
  }
}
