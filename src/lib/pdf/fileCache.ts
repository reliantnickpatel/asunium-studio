"use client";

type CachedPdf = {
  id: string;
  name: string;
  type: string;
  lastModified: number;
  bytes: ArrayBuffer;
};

const DB_NAME = "asunium-studio";
const STORE_NAME = "pdf-files";
const DB_VERSION = 1;

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export async function cachePdfFile(record: CachedPdf): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function getCachedPdf(id: string): Promise<CachedPdf | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  const result = await new Promise<CachedPdf | null>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as CachedPdf | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

export async function hasCachedPdf(id: string): Promise<boolean> {
  try {
    return (await getCachedPdf(id)) !== null;
  } catch {
    return false;
  }
}
