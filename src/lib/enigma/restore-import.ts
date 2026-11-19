/** Browser-only: reads the zip on the phone and applies a confirmed restore with a journal. */
import { SIM_KEY } from "./partners-store";
import { mergePartners } from "./partners-backup";
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
  writeRestoredRaw,
} from "./store";
import { deleteVideo, loadVideo, putVideoOrThrow } from "./videos";

export type Preview =
  | { ok: true; backup: CheckedBackup; plan: RestorePlan; zip: JSZip; prevRaw: string | null; prevPartnerRaw?: string | null; newPartnerRaw?: string }
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
  let checked: ReturnType<typeof checkBackup>;
  try { checked = checkBackup(json, paths); }
  catch { return { ok: false, message: "Os dados da cópia estão danificados." }; }
  if (!checked.ok) return checked;
  const s = snap();
  if (s.kind !== "ok")
    return {
      ok: false,
      message: "Os dados deste aparelho não podem ser lidos agora. Nada foi alterado.",
    };
  const prevRaw = rawSavedData();
  const prevPartnerRaw = localStorage.getItem(SIM_KEY);
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
  let partners: { prevPartnerRaw: string | null; newPartnerRaw: string } | undefined;
  if (checked.backup.manifest.partners !== undefined) {
    try {
      const merged = mergePartners(prevPartnerRaw, checked.backup.manifest.partners);
      partners = { prevPartnerRaw, newPartnerRaw: JSON.stringify(merged) };
    } catch {
      return { ok: false, message: "Os dados dos parceiros estão inválidos ou têm conflitos. Confira a cópia." };
    }
  }
  if (rawSavedData() !== prevRaw || localStorage.getItem(SIM_KEY) !== prevPartnerRaw)
    return { ok: false, message: "Os dados mudaram durante a prévia. Escolha a cópia de novo." };
  return { ok: true, backup: checked.backup, plan, zip, prevRaw, ...partners };
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
  if (p.prevPartnerRaw !== undefined && localStorage.getItem(SIM_KEY) !== p.prevPartnerRaw)
    return { ok: false, message: "Os parceiros mudaram desde a prévia. Escolha a cópia de novo." };
  const partnersChanged = p.newPartnerRaw !== undefined && p.newPartnerRaw !== p.prevPartnerRaw;
  if (plan.newRaw === null && plan.writeVideos.size === 0 && !partnersChanged) return { ok: true };
  const newRaw = plan.newRaw ?? prevRaw ?? "";
  const ids = [...plan.writeVideos.keys()];
  const journal = {
    phase: "videos" as const, prevRaw, newRaw, newVideoIds: ids,
    ...(p.newPartnerRaw !== undefined ? { prevPartnerRaw: p.prevPartnerRaw ?? null, newPartnerRaw: p.newPartnerRaw } : {}),
  };
  if (!writeJournal(journal))
    return {
      ok: false,
      message: "Não há espaço para restaurar neste aparelho. Nada foi alterado.",
    };
  const written: string[] = [];
  try {
    for (const [id, path] of plan.writeVideos) {
      const raw = await zip.file(path)!.async("blob");
      const mime = p.backup.manifest.videos.find((v) => v.recordingId === id)?.mimeType;
      await putVideoOrThrow(id, mime ? new Blob([raw], { type: mime }) : raw);
      written.push(id);
    }
  } catch {
    await Promise.all(written.map(deleteVideo));
    clearJournal();
    return { ok: false, message: "Não foi possível guardar os vídeos. Nada foi alterado." };
  }
  if (rawSavedData() !== prevRaw ||
      (p.prevPartnerRaw !== undefined && localStorage.getItem(SIM_KEY) !== p.prevPartnerRaw)) {
    await Promise.all(written.map(deleteVideo));
    clearJournal();
    return { ok: false, message: "Os dados mudaram durante a restauração. Escolha a cópia de novo." };
  }
  let saved = writeJournal({ ...journal, phase: "data" });
  if (saved && partnersChanged) {
    try { localStorage.setItem(SIM_KEY, p.newPartnerRaw!); }
    catch { saved = false; }
  }
  if (saved && plan.newRaw !== null) saved = writeRestoredRaw(newRaw);
  if (!saved) {
    if (!writeJournal(journal))
      return { ok: false, message: "Restauração interrompida. Reabra o aplicativo para recuperar os dados." };
    const rollback = settleRestore();
    if (rollback.outcome === "pending")
      return { ok: false, message: "Não foi possível recuperar agora. Libere espaço e reabra o aplicativo." };
    await Promise.all(written.map(deleteVideo));
    clearJournal();
    return { ok: false, message: "Não foi possível salvar os dados. A restauração foi desfeita." };
  }
  clearJournal();
  return { ok: true };
}

/** Runs once when the app opens. */
export async function settleOnOpen(): Promise<"none" | "finished" | "rolledBack" | "pending"> {
  const r = settleRestore();
  await Promise.all(r.deleteVideos.map(deleteVideo));
  if (r.outcome === "finished" || r.outcome === "rolledBack") clearJournal();
  return r.outcome;
}
