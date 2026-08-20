import { Storage } from "@google-cloud/storage";
import "server-only";
import {
  isMemoryStorage,
  memoryDeleteObject,
  memoryGetObject,
  memoryObjectExists,
  memoryObjectSize,
  memoryUploadUrl,
} from "@/lib/storage/memory";
import { EXTERNAL_TIMEOUT, withTimeout } from "@/lib/timeout";

const SIGNED_URL_TTL_MS = 15 * 60 * 1000;

function getBucketName() {
  const bucket = process.env.GCS_BUCKET?.trim();

  if (!bucket) {
    throw new Error("GCS_BUCKET is not set");
  }

  return bucket;
}

function getPrivateKey() {
  const privateKey = process.env.GCS_PRIVATE_KEY;

  if (!privateKey) {
    return undefined;
  }

  return privateKey.replace(/\\n/g, "\n");
}

function createStorage() {
  const projectId = process.env.GCS_PROJECT_ID?.trim() || undefined;
  const clientEmail = process.env.GCS_CLIENT_EMAIL?.trim();
  const privateKey = getPrivateKey();

  if (clientEmail && privateKey) {
    return new Storage({
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
    });
  }

  return new Storage(projectId ? { projectId } : undefined);
}

const globalForGcs = globalThis as unknown as {
  gcsStorage: Storage | undefined;
};

function getStorage() {
  const existing = globalForGcs.gcsStorage ?? createStorage();

  if (process.env.NODE_ENV !== "production") {
    globalForGcs.gcsStorage = existing;
  }

  return existing;
}

function getFile(storageKey: string) {
  return getStorage().bucket(getBucketName()).file(storageKey);
}

export async function createV4UploadUrl({
  storageKey,
  contentType,
}: {
  storageKey: string;
  contentType: string;
}) {
  if (isMemoryStorage()) {
    return memoryUploadUrl(storageKey);
  }

  const [url] = await getFile(storageKey).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + SIGNED_URL_TTL_MS,
    contentType,
  });

  return url;
}

export async function objectExists(storageKey: string) {
  if (isMemoryStorage()) {
    return memoryObjectExists(storageKey);
  }

  const [exists] = await getFile(storageKey).exists();
  return exists;
}

export async function getObjectSize(storageKey: string) {
  if (isMemoryStorage()) {
    return memoryObjectSize(storageKey);
  }

  const [metadata] = await withTimeout(
    getFile(storageKey).getMetadata(),
    EXTERNAL_TIMEOUT.gcsMs,
    "Invoice file metadata timed out.",
  );
  const size = Number(metadata.size);

  return Number.isFinite(size) ? size : null;
}

export async function deleteObject(storageKey: string) {
  if (isMemoryStorage()) {
    memoryDeleteObject(storageKey);
    return;
  }

  await withTimeout(
    getFile(storageKey).delete({ ignoreNotFound: true }),
    EXTERNAL_TIMEOUT.gcsMs,
    "Invoice file delete timed out.",
  );
}

export async function downloadObject(storageKey: string) {
  if (isMemoryStorage()) {
    const bytes = memoryGetObject(storageKey);

    if (!bytes) {
      throw new Error("File was not found in storage");
    }

    return bytes;
  }

  const [contents] = await withTimeout(
    getFile(storageKey).download(),
    EXTERNAL_TIMEOUT.gcsMs,
    "Invoice file download timed out.",
  );
  return contents;
}
