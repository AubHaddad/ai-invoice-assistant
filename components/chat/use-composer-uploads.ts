"use client";

import { useCallback, useState } from "react";
import {
  DOCUMENT_FILE_ACCEPT,
  resolveDocumentMimeType,
} from "@/lib/documents/constants";
import {
  uploadDocument,
  validateDocumentFile,
  type UploadedDocument,
} from "@/lib/documents/client-upload";
import type { ComposerUploadItem } from "./composer-uploads";

export function useComposerUploads(conversationId: string) {
  const [items, setItems] = useState<ComposerUploadItem[]>([]);

  const patchItem = useCallback(
    (id: string, patch: Partial<ComposerUploadItem>) => {
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
    },
    [],
  );

  const uploadFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);

      for (const file of files) {
        const localId = crypto.randomUUID();
        const mimeType =
          resolveDocumentMimeType(file) ?? file.type ?? "application/octet-stream";
        const validationError = validateDocumentFile(file);

        setItems((current) => [
          ...current,
          {
            id: localId,
            fileName: file.name,
            mimeType,
            sizeBytes: file.size,
            progress: 0,
            status: validationError ? "error" : "signing",
            error: validationError ?? undefined,
          },
        ]);

        if (validationError) {
          continue;
        }

        void uploadDocument({
          file,
          conversationId,
          onProgress: (progress) => {
            patchItem(localId, { status: "uploading", progress });
          },
          onConfirming: () => {
            patchItem(localId, { status: "confirming", progress: 100 });
          },
        })
          .then((document: UploadedDocument) => {
            patchItem(localId, {
              status: "uploaded",
              progress: 100,
              documentId: document.id,
              mimeType: document.mimeType,
            });
          })
          .catch((error: unknown) => {
            patchItem(localId, {
              status: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "Upload failed",
            });
          });
      }
    },
    [conversationId, patchItem],
  );

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearUploaded = useCallback(() => {
    setItems((current) => current.filter((item) => item.status === "error"));
  }, []);

  const uploadedDocumentIds = items.flatMap((item) =>
    item.status === "uploaded" && item.documentId ? [item.documentId] : [],
  );

  const isUploading = items.some(
    (item) =>
      item.status === "signing" ||
      item.status === "uploading" ||
      item.status === "confirming",
  );

  return {
    items,
    isUploading,
    uploadedDocumentIds,
    uploadFiles,
    removeItem,
    clearUploaded,
    accept: DOCUMENT_FILE_ACCEPT,
  };
}
