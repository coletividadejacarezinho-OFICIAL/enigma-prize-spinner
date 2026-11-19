import { mediaExtension } from "./capture";
import { roundsOf } from "./rounds";
import type { AppState } from "./types";

/** Format of "Baixar cópia de segurança" (E04). Restore comes in E05. */
export const BACKUP_FORMAT = "enigma-premiado-backup";
export const BACKUP_VERSION = 1;

export type BackupVideo = {
  recordingId: string;
  drawId: string;
  /** Path inside the zip; null when the file was missing or unreadable. */
  file: string | null;
  mimeType?: string | undefined;
  size?: number | undefined;
};

export type BackupManifest = {
  format: typeof BACKUP_FORMAT;
  backupVersion: typeof BACKUP_VERSION;
  exportedAt: string;
  /** localStorage key and exact saved text: restore can rebuild the app byte for byte. */
  storageKey: string;
  savedData: string;
  /** Same data, parsed, for reading. IDs, order and links are untouched. */
  state: AppState;
  summary: {
    merchants: number;
    officialDraws: string[];
    rehearsalDraws: string[];
    courtesies: number;
    results: number;
    entries: number;
    videosIncluded: number;
    videosMissing: { recordingId: string; drawId: string }[];
  };
  videos: BackupVideo[];
};

export function videoPath(recordingId: string, mimeType?: string): string {
  return `videos/${recordingId}.${mediaExtension(mimeType)}`;
}

/** Every real recording the state points to. */
export function videoRefs(state: AppState) {
  return state.draws.flatMap((d) =>
    (d.recordings ?? []).filter((r) => r.real).map((r) => ({ drawId: d.id, rec: r })),
  );
}

/** Pure: builds the manifest; `available` = recording ids whose file was read. */
export function buildManifest(
  state: AppState,
  savedData: string,
  storageKey: string,
  available: ReadonlySet<string>,
  now: Date,
): BackupManifest {
  const videos: BackupVideo[] = videoRefs(state).map(({ drawId, rec }) => ({
    recordingId: rec.id,
    drawId,
    file: available.has(rec.id) ? videoPath(rec.id, rec.mimeType) : null,
    mimeType: rec.mimeType,
    size: rec.size,
  }));
  const rounds = state.draws.flatMap((d) => roundsOf(d, state.merchants));
  return {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    storageKey,
    savedData,
    state,
    summary: {
      merchants: state.merchants.length,
      officialDraws: state.draws.filter((d) => !d.isSample).map((d) => d.id),
      rehearsalDraws: state.draws.filter((d) => d.isSample).map((d) => d.id),
      courtesies: rounds.length,
      results: rounds.filter((r) => r.result).length,
      entries: state.draws.reduce((n, d) => n + (d.entries?.length ?? 0), 0),
      videosIncluded: videos.filter((v) => v.file).length,
      videosMissing: videos
        .filter((v) => !v.file)
        .map(({ recordingId, drawId }) => ({ recordingId, drawId })),
    },
    videos,
  };
}

export function backupFileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `enigma-premiado-copia-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.zip`;
}
