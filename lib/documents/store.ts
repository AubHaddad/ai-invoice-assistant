import { and, desc, eq, inArray } from "drizzle-orm";
import "server-only";
import { getConversationForUser } from "@/lib/chat/store";
import { db } from "@/lib/db";
import { documents, type Document } from "@/lib/db/schema";
import { buildDocumentStorageKey } from "./filename";

export function toDocumentSummary(document: Document) {
  return {
    id: document.id,
    fileName: document.fileName,
    mimeType: document.mime,
    sizeBytes: document.sizeBytes,
    status: document.status,
    pages: document.pages,
    conversationId: document.conversationId,
  };
}

export async function getDocumentForUser(id: string, userId: string) {
  const [document] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);

  return document ?? null;
}

export async function createUploadingDocument({
  userId,
  conversationId,
  fileName,
  mimeType,
  sizeBytes,
}: {
  userId: string;
  conversationId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const conversation = conversationId
    ? await getConversationForUser(conversationId, userId)
    : null;

  const documentId = crypto.randomUUID();
  const gcsPath = buildDocumentStorageKey({
    userId,
    documentId,
    fileName,
  });

  const [document] = await db
    .insert(documents)
    .values({
      id: documentId,
      userId,
      conversationId: conversation?.id ?? null,
      fileName,
      mime: mimeType,
      sizeBytes,
      gcsPath,
      status: "uploading",
    })
    .returning();

  return document;
}

export async function markDocumentUploaded(id: string, userId: string) {
  const [document] = await db
    .update(documents)
    .set({ status: "uploaded" })
    .where(
      and(
        eq(documents.id, id),
        eq(documents.userId, userId),
        eq(documents.status, "uploading"),
      ),
    )
    .returning();

  return document ?? null;
}

export async function attachDocumentsToConversation({
  documentIds,
  conversationId,
  userId,
}: {
  documentIds: string[];
  conversationId: string;
  userId: string;
}) {
  if (documentIds.length === 0) {
    return;
  }

  await db
    .update(documents)
    .set({ conversationId })
    .where(
      and(
        eq(documents.userId, userId),
        inArray(documents.id, documentIds),
      ),
    );
}

export async function listUploadedDocumentsForConversation(
  conversationId: string,
  userId: string,
) {
  return db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        eq(documents.conversationId, conversationId),
        eq(documents.status, "uploaded"),
      ),
    )
    .orderBy(desc(documents.createdAt));
}

export async function setDocumentPages(
  id: string,
  userId: string,
  pages: number,
) {
  const [document] = await db
    .update(documents)
    .set({ pages })
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .returning();

  return document ?? null;
}

export async function markDocumentFailed(id: string, userId: string) {
  const [document] = await db
    .update(documents)
    .set({ status: "failed" })
    .where(
      and(
        eq(documents.id, id),
        eq(documents.userId, userId),
        eq(documents.status, "uploading"),
      ),
    )
    .returning();

  return document ?? null;
}
