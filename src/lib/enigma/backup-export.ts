/** Browser-only: reads (never writes) localStorage and IndexedDB and builds the backup zip. */
import JSZip from "jszip";
import { buildManifest, backupFileName, videoPath, videoRefs, type BackupManifest } from "./backup";
import { loadState, rawSavedData, STORAGE_KEY } from "./store";
import { loadVideo } from "./videos";

export type PreparedBackup =
  | { ok: true; blob: Blob; filename: string; manifest: BackupManifest }
  | { ok: false; message: string };

export const BACKUP_FAIL =
  "Não foi possível preparar a cópia. Seus dados continuam guardados. Tente novamente.";

export async function prepareBackup(now = new Date()): Promise<PreparedBackup> {
  try {
    const raw = rawSavedData();
    const loaded = loadState(raw);
    if (loaded.kind !== "ok" || raw === null)
      return { ok: false, message: "Ainda não há dados para copiar neste aparelho." };
    const zip = new JSZip();
    const available = new Set<string>();
    for (const { rec } of videoRefs(loaded.state)) {
      const blob = await loadVideo(rec.id);
      if (blob && blob.size > 0) {
        zip.file(videoPath(rec.id, rec.mimeType), blob);
        available.add(rec.id);
      }
    }
    const manifest = buildManifest(loaded.state, raw, STORAGE_KEY, available, now);
    zip.file("copia.json", JSON.stringify(manifest, null, 2));
    const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
    return { ok: true, blob, filename: backupFileName(now), manifest };
  } catch {
    return { ok: false, message: BACKUP_FAIL };
  }
}
