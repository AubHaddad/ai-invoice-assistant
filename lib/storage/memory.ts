import { isE2ETestAuth } from "@/lib/e2e/env";

const objects = new Map<string, Buffer>();

export function isMemoryStorage() {
  return isE2ETestAuth();
}

export function memoryPutObject(storageKey: string, bytes: Buffer) {
  objects.set(storageKey, bytes);
}

export function memoryGetObject(storageKey: string) {
  return objects.get(storageKey) ?? null;
}

export function memoryDeleteObject(storageKey: string) {
  objects.delete(storageKey);
}

export function memoryObjectExists(storageKey: string) {
  return objects.has(storageKey);
}

export function memoryObjectSize(storageKey: string) {
  return objects.get(storageKey)?.length ?? null;
}

export function memoryUploadUrl(storageKey: string) {
  return `/api/e2e/storage?key=${encodeURIComponent(storageKey)}`;
}
