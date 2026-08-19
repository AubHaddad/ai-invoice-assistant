import {
  MAX_DOCUMENT_BYTES,
  formatFileSize,
  resolveDocumentMimeType,
} from "./constants";

export type UploadedDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: "uploaded";
  conversationId: string | null;
};

type CreateUploadResponse = {
  document: {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    status: string;
    conversationId: string | null;
  };
  uploadUrl: string;
  headers: {
    "Content-Type": string;
  };
  error?: string;
};

function readErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallback;
}

export function validateDocumentFile(file: File) {
  if (file.size <= 0) {
    return "That file is empty.";
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    return `Files must be ${formatFileSize(MAX_DOCUMENT_BYTES)} or smaller.`;
  }

  if (!resolveDocumentMimeType(file)) {
    return "Use a PDF or image (JPEG, PNG, WebP, GIF).";
  }

  return null;
}

function putFileWithProgress({
  url,
  file,
  contentType,
  onProgress,
  signal,
}: {
  url: string;
  file: File;
  contentType: string;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }

      reject(new Error(`Upload failed (${xhr.status})`));
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed"));
    };

    xhr.onabort = () => {
      reject(new DOMException("Upload aborted", "AbortError"));
    };

    const abort = () => xhr.abort();

    if (signal) {
      if (signal.aborted) {
        abort();
        return;
      }

      signal.addEventListener("abort", abort, { once: true });
    }

    xhr.send(file);
  });
}

export async function uploadDocument({
  file,
  conversationId,
  onProgress,
  onConfirming,
  signal,
}: {
  file: File;
  conversationId?: string;
  onProgress?: (percent: number) => void;
  onConfirming?: () => void;
  signal?: AbortSignal;
}): Promise<UploadedDocument> {
  const validationError = validateDocumentFile(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const mimeType = resolveDocumentMimeType(file);

  if (!mimeType) {
    throw new Error("Use a PDF or image (JPEG, PNG, WebP, GIF).");
  }

  const createResponse = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType,
      sizeBytes: file.size,
      conversationId,
    }),
    signal,
  });

  const createPayload = (await createResponse.json().catch(() => null)) as
    | CreateUploadResponse
    | null;

  if (!createResponse.ok || !createPayload?.uploadUrl || !createPayload.document) {
    throw new Error(
      readErrorMessage(createPayload, "Could not start the upload."),
    );
  }

  await putFileWithProgress({
    url: createPayload.uploadUrl,
    file,
    contentType: createPayload.headers["Content-Type"] ?? mimeType,
    onProgress,
    signal,
  });

  onConfirming?.();

  const confirmResponse = await fetch(
    `/api/documents/${createPayload.document.id}/confirm`,
    {
      method: "POST",
      signal,
    },
  );

  const confirmPayload = (await confirmResponse.json().catch(() => null)) as {
    document?: UploadedDocument;
    error?: string;
  } | null;

  if (!confirmResponse.ok || !confirmPayload?.document) {
    throw new Error(
      readErrorMessage(confirmPayload, "Could not confirm the upload."),
    );
  }

  return confirmPayload.document;
}
