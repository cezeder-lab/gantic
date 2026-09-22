import { getElectronAPI } from './electronBridge';

const DB_NAME = 'gantic-attachments';
const STORE_NAME = 'files';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string): Blob {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)]);
}

/**
 * Persists attachment blobs to a real file (via Electron's IPC bridge) when
 * running as a desktop app, so they live in the user's chosen data folder
 * alongside the project data — otherwise falls back to IndexedDB, which is
 * all a plain browser build can offer.
 */
export async function saveAttachmentBlob(id: string, blob: Blob): Promise<void> {
  const api = getElectronAPI();
  if (api) {
    await api.writeAttachment(id, await blobToBase64(blob));
    return;
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAttachmentBlob(id: string): Promise<Blob | undefined> {
  const api = getElectronAPI();
  if (api) {
    const base64 = await api.readAttachment(id);
    return base64 ? base64ToBlob(base64) : undefined;
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAttachmentBlob(id: string): Promise<void> {
  const api = getElectronAPI();
  if (api) {
    await api.deleteAttachments([id]);
    return;
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function deleteAttachmentBlobs(ids: string[]): void {
  const api = getElectronAPI();
  if (api) {
    api.deleteAttachments(ids).catch(() => {});
    return;
  }
  for (const id of ids) {
    deleteAttachmentBlob(id).catch(() => {});
  }
}
