/** Browser-only: reads the zip on the phone and applies a confirmed restore with a journal. */
import JSZip from "jszip";
import {
  checkBackup,
  planRestore,
  type CheckedBackup,
  type LocalVideo,
  type RestorePlan,
} from "./restore";
import { videoRefs } from "./backup";
import {
  clearJournal,
  rawSavedData,
  settleRestore,
  snap,
  writeJournal,
  writeRawBack,
  writeRestoredRaw,
} from "./store";
import { deleteVideo, loadVideo, putVideoOrThrow } from "./videos";

export type Preview =
  | { ok: true; backup: CheckedBackup; plan: RestorePlan; zip: JSZip; prevRaw: string | null }
  | { ok: false; message: string };

async function sameBytes(a: Blob, b: Blob) {
  if (a.size !== b.size) return false;
  const [x, y] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const u = new Uint8Array(x),
    v = new Uint8Array(y);
  for (let i = 0; i < u.length; i++) if (u[i] !== v[i]) return false;
  return true;
}

/** Only reads: the file, the saved data and the videos. Nothing is written here. */
export async function previewRestore(file: File): Promise<Preview> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return {
      ok: false,
      message: "Este arquivo não é uma cópia do Enigma Premiado (não é um .zip válido).",
    };
  }
  const entry = zip.file("copia.json");
  if (!entry)
    return {
      ok: false,
      message: "Este arquivo não é uma cópia do Enigma Premiado (falta o copia.json).",
    };
  let json: unknown;
  try {
    json = JSON.parse(await entry.async("string"));
  } catch {
    return { ok: false, message: "O copia.json desta cópia está danificado." };
  }
  const paths = new Set(Object.keys(zip.files).filter((p) => !zip.files[p]!.dir));
  const checked = checkBackup(json, paths);
  if (!checked.ok) return checked;
  const s = snap();
  if (s.kind !== "ok")
    return {
      ok: false,
      message: "Os dados deste aparelho não podem ser lidos agora. Nada foi alterado.",
    };
  const localVideos = new Map<string, LocalVideo>();
  for (const { rec } of videoRefs(checked.backup.state)) {
    const mine = await loadVideo(rec.id);
    if (!mine) continue;
    const path = checked.backup.files.get(rec.id);
    if (!path) {
      localVideos.set(rec.id, "same");
      continue;
    }
    const theirs = await zip.file(path)!.async("blob");
    localVideos.set(rec.id, (await sameBytes(mine, theirs)) ? "same" : "different");
  }
  const plan = planRestore(s.state, checked.backup, localVideos);
  return { ok: true, backup: checked.backup, plan, zip, prevRaw: rawSavedData() };
}

export type ApplyResult = { ok: true } | { ok: false; message: string };

/**
 * Order: journal → videos → journal "data" → data → journal removed. If the page closes,
 * `settleOnOpen()` finishes (phase data) or rolls back (phase videos). Success only at the end.
 */
export async function applyRestore(p: Extract<Preview, { ok: true }>): Promise<ApplyResult> {
  const { plan, zip, prevRaw } = p;
  if (plan.conflicts.length) return { ok: false, message: "Há conflitos. Nada foi alterado." };
  if (rawSavedData() !== prevRaw)
    return { ok: false, message: "Os dados mudaram desde a prévia. Escolha a cópia de novo." };
  if (plan.newRaw === null && plan.writeVideos.size === 0) return { ok: true };
  const newRaw = plan.newRaw ?? prevRaw ?? "";
  const ids = [...plan.writeVideos.keys()];
  const journal = { phase: "videos" as const, prevRaw, newRaw, newVideoIds: ids };
  if (!writeJournal(journal))
    return {
      ok: false,
      message: "Não há espaço para restaurar neste aparelho. Nada foi alterado.",
    };
  const written: string[] = [];
  try {
    for (const [id, path] of plan.writeVideos) {
      await putVideoOrThrow(id, await zip.file(path)!.async("blob"));
      written.push(id);
    }
  } catch {
    await Promise.all(written.map(deleteVideo));
    clearJournal();
    return { ok: false, message: "Não foi possível guardar os vídeos. Nada foi alterado." };
  }
  if (
    !writeJournal({ ...journal, phase: "data" }) ||
    (plan.newRaw !== null && !writeRestoredRaw(newRaw))
  ) {
    writeRawBack(prevRaw);
    await Promise.all(written.map(deleteVideo));
    clearJournal();
    return { ok: false, message: "Não foi possível salvar os dados. Nada foi alterado." };
  }
  clearJournal();
  return { ok: true };
}

/** Runs once when the app opens. */
export async function settleOnOpen(): Promise<"none" | "finished" | "rolledBack"> {
  const r = settleRestore();
  await Promise.all(r.deleteVideos.map(deleteVideo));
  if (r.outcome !== "none") clearJournal();
  return r.outcome;
}
