/** E05: pure checks and merge rules for "Restaurar cópia de segurança" (tested). */
import { BACKUP_FORMAT, BACKUP_VERSION, buildManifest, videoRefs, type BackupManifest } from "./backup";
import { loadState } from "./store";
import type { AppState, Draw, Merchant } from "./types";

/** Key-order independent JSON, so "same content" never depends on property order. */
export function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.keys(v)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}
const same = (a: unknown, b: unknown) => stableJson(a) === stableJson(b);

export type CheckedBackup = {
  exportedAt: string;
  raw: string;
  state: AppState;
  manifest: BackupManifest;
  /** Recording id → path in the zip, only for files actually present in the zip. */
  files: Map<string, string>;
  /** Real recordings with no file in the zip. */
  missingVideos: string[];
};

type Fail = { ok: false; message: string };
const fail = (message: string): Fail => ({ ok: false, message });

function dupe(ids: string[]): string | undefined {
  const seen = new Set<string>();
  return ids.find((id) => (seen.has(id) ? true : (seen.add(id), false)));
}

/** IDs unique and links pointing at existing records. Returns a problem or null. */
export function checkLinks(state: AppState): string | null {
  const d = dupe(state.draws.map((x) => x.id));
  if (d) return `O sorteio ${d} aparece duas vezes.`;
  const m = dupe(state.merchants.map((x) => x.id));
  if (m) return `O comércio ${m} aparece duas vezes.`;
  const merchantIds = new Set(state.merchants.map((x) => x.id));
  const recIds: string[] = [];
  for (const draw of state.draws) {
    if (draw.merchantId && !merchantIds.has(draw.merchantId))
      return `O sorteio ${draw.id} aponta para um comércio que não está na cópia.`;
    for (const p of draw.extraPrizes ?? []) {
      if (p.merchantId && !merchantIds.has(p.merchantId))
        return `Uma cortesia do sorteio ${draw.id} aponta para um comércio que não está na cópia.`;
    }
    const pd = dupe([draw.id, ...(draw.extraPrizes ?? []).map((p) => p.id)].filter(Boolean) as string[]);
    if (pd) return `A cortesia ${pd} aparece duas vezes.`;
    const entryIds = (draw.entries ?? []).map((e) => e.id);
    const ed = dupe(entryIds);
    if (ed) return `O nome ${ed} aparece duas vezes no sorteio ${draw.id}.`;
    const results = [draw.result, ...(draw.extraPrizes ?? []).map((p) => p.result)];
    for (const r of results) {
      if (!r) continue;
      if (!draw.names.includes(r.winner))
        return `Um ganhador do sorteio ${draw.id} não está na lista aprovada.`;
      if (r.entryId && !entryIds.includes(r.entryId))
        return `Um ganhador do sorteio ${draw.id} não está ligado a um nome da lista.`;
    }
    recIds.push(...(draw.recordings ?? []).map((r) => r.id));
  }
  const rd = dupe(recIds);
  if (rd) return `A gravação ${rd} aparece duas vezes.`;
  if (state.currentId && state.draws.length && !state.draws.some((x) => x.id === state.currentId))
    return "O sorteio aberto na roleta não está na cópia.";
  return null;
}

/** Validates copia.json before anything is saved. `zipPaths` = files present in the zip. */
export function checkBackup(json: unknown, zipPaths: ReadonlySet<string>): { ok: true; backup: CheckedBackup } | Fail {
  if (!json || typeof json !== "object") return fail("Este arquivo não é uma cópia do Enigma Premiado.");
  const m = json as Partial<BackupManifest>;
  if (m.format !== BACKUP_FORMAT) return fail("Este arquivo não é uma cópia do Enigma Premiado.");
  if (m.backupVersion !== BACKUP_VERSION)
    return fail(`Esta cópia é da versão ${String(m.backupVersion)}, e este aplicativo só abre a versão ${BACKUP_VERSION}.`);
  if (typeof m.savedData !== "string" || typeof m.exportedAt !== "string" || !m.state || !m.summary || !Array.isArray(m.videos))
    return fail("A cópia está incompleta.");
  const loaded = loadState(m.savedData);
  if (loaded.kind !== "ok") return fail("Os dados dentro da cópia não podem ser lidos.");
  const state = loaded.state;
  if (!same(state, m.state)) return fail("A cópia não confere: os dados organizados são diferentes dos dados salvos.");
  const problem = checkLinks(state);
  if (problem) return fail(problem);
  const listed = new Set(m.videos.filter((v) => v.file).map((v) => v.recordingId));
  const expected = buildManifest(state, m.savedData, m.storageKey ?? "", listed, new Date(m.exportedAt));
  if (!same(expected.summary, m.summary) || !same(expected.videos, m.videos))
    return fail("A cópia não confere: o resumo é diferente dos dados salvos.");
  const files = new Map<string, string>();
  const missingVideos: string[] = [];
  for (const v of m.videos) {
    if (v.file && zipPaths.has(v.file)) files.set(v.recordingId, v.file);
    else missingVideos.push(v.recordingId);
  }
  return {
    ok: true,
    backup: { exportedAt: m.exportedAt, raw: m.savedData, state, manifest: m as BackupManifest, files, missingVideos },
  };
}

export type LocalVideo = "absent" | "same" | "different";

export type RestorePlan = {
  emptyBrowser: boolean;
  addMerchants: Merchant[];
  addDraws: Draw[];
  sameMerchants: number;
  sameDraws: number;
  conflicts: string[];
  /** Videos to save (recording id → zip path). */
  writeVideos: Map<string, string>;
  videosAlready: number;
  /** Recordings that stay without a video after the restore. */
  unavailableVideos: string[];
  /** Final saved text; null when nothing changes. */
  newRaw: string | null;
  counts: { official: number; rehearsals: number; courtesies: number; results: number };
};

const isEmpty = (s: AppState | null) => !s || (s.draws.length === 0 && s.merchants.length === 0);

/**
 * Compares by ID and content: new records are added, identical ones skipped, the same ID with
 * different content is a conflict (and nothing is saved). Local preferences are kept.
 */
export function planRestore(
  local: AppState | null,
  backup: CheckedBackup,
  localVideos: ReadonlyMap<string, LocalVideo>,
): RestorePlan {
  const inc = backup.state;
  const emptyBrowser = isEmpty(local);
  const conflicts: string[] = [];
  const addMerchants: Merchant[] = [];
  const addDraws: Draw[] = [];
  let sameMerchants = 0;
  let sameDraws = 0;
  const lm = new Map((local?.merchants ?? []).map((x) => [x.id, x]));
  const ld = new Map((local?.draws ?? []).map((x) => [x.id, x]));
  for (const m of inc.merchants) {
    const mine = lm.get(m.id);
    if (!mine) addMerchants.push(m);
    else if (same(mine, m)) sameMerchants++;
    else conflicts.push(`O comércio “${m.name}” já existe neste aparelho com outros dados.`);
  }
  for (const d of inc.draws) {
    const mine = ld.get(d.id);
    if (!mine) addDraws.push(d);
    else if (same(mine, d)) sameDraws++;
    else conflicts.push(`O sorteio de ${d.date.split("-").reverse().join("/")} (${d.prize}) já existe neste aparelho com outros dados.`);
  }
  const writeVideos = new Map<string, string>();
  let videosAlready = 0;
  const unavailableVideos: string[] = [];
  for (const { rec } of videoRefs(inc)) {
    const status = localVideos.get(rec.id) ?? "absent";
    const path = backup.files.get(rec.id);
    if (status === "different" && path) conflicts.push("Um vídeo da cópia é diferente do vídeo com o mesmo código neste aparelho.");
    else if (status !== "absent") videosAlready++;
    else if (path) writeVideos.set(rec.id, path);
    else unavailableVideos.push(rec.id);
  }
  let finalState: AppState;
  if (emptyBrowser) finalState = inc;
  else {
    const l = local as AppState;
    finalState = { ...l, merchants: [...l.merchants, ...addMerchants], draws: [...l.draws, ...addDraws] };
    const problem = conflicts.length ? null : checkLinks(finalState);
    if (problem) conflicts.push(problem);
  }
  const changes = addMerchants.length + addDraws.length > 0;
  const newRaw = emptyBrowser ? backup.raw : changes ? JSON.stringify(finalState) : null;
  const s = backup.manifest.summary;
  return {
    emptyBrowser,
    addMerchants,
    addDraws,
    sameMerchants,
    sameDraws,
    conflicts: [...new Set(conflicts)],
    writeVideos,
    videosAlready,
    unavailableVideos,
    newRaw,
    counts: { official: s.officialDraws.length, rehearsals: s.rehearsalDraws.length, courtesies: s.courtesies, results: s.results },
  };
}
