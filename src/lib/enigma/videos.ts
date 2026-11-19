/**
 * Recorded videos stay on this phone, in the browser's IndexedDB (localStorage is far too
 * small for video). Browser-only: call from effects or event handlers.
 */
const DB = "enigma-premiado-videos";
const STORE = "videos";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function saveVideo(id: string, blob: Blob): Promise<boolean> {
  try {
    await run("readwrite", (s) => s.put(blob, id));
    return true;
  } catch {
    return false;
  }
}

export async function loadVideo(id: string): Promise<Blob | null> {
  try {
    const v = await run<unknown>("readonly", (s) => s.get(id));
    return v instanceof Blob ? v : null;
  } catch {
    return null;
  }
}

export function videoFileName(date: string, mimeType: string, index = 0): string {
  const ext = mimeType.includes("mp4") ? "mp4" : "webm";
  const [y, m, d] = date.split("-");
  return `enigma-premiado-${d}-${m}-${y}${index > 0 ? `-${index + 1}` : ""}.${ext}`;
}

/** "Salvar vídeo": hands the file to the phone's downloads (or its viewer on iPhone). */
export function downloadVideo(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** "Compartilhar": the phone's share menu with the video file, when the browser allows it. */
export async function shareVideo(blob: Blob, filename: string): Promise<"ok" | "cancelled" | "unsupported"> {
  const file = new File([blob], filename, { type: blob.type || "video/mp4" });
  const data = { files: [file], title: "Enigma Premiado" };
  if (!navigator.canShare?.(data) || !navigator.share) return "unsupported";
  try {
    await navigator.share(data);
    return "ok";
  } catch (e) {
    return e instanceof DOMException && e.name === "AbortError" ? "cancelled" : "unsupported";
  }
}

export async function deleteVideo(id: string): Promise<boolean> {
  try {
    await run("readwrite", (s) => s.delete(id));
    return true;
  } catch {
    return false;
  }
}

/** Strict version for restore: throws when the browser refuses. */
export async function putVideoOrThrow(id: string, blob: Blob): Promise<void> {
  await run("readwrite", (s) => s.put(blob, id));
}
