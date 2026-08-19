import { Storage } from "@google-cloud/storage";
import "server-only";

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

const storage = createStorage();

function getFile(storageKey: string) {
  return storage.bucket(getBucketName()).file(storageKey);
}

export async function createV4UploadUrl({
  storageKey,
  contentType,
}: {
  storageKey: string;
  contentType: string;
}) {
  const [url] = await getFile(storageKey).getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + SIGNED_URL_TTL_MS,
    contentType,
  });

  return url;
}

export async function objectExists(storageKey: string) {
  const [exists] = await getFile(storageKey).exists();
  return exists;
}
