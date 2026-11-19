import { useSyncExternalStore } from "react";
import { receiveBotMessage, type BotInput } from "./entries";
import { finishRecording, migrateState } from "./logic";
import type { AppState, BotOutcome, Draw, Merchant, Recording } from "./types";

const KEY = "enigma-premiado:v1";
export const STORAGE_KEY = KEY;
const EVENT = "enigma-premiado:change";

function isState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<AppState>;
  return v.version === 1 && Array.isArray(v.draws) && typeof v.currentId === "string";
}

/** Shown whenever the browser refuses to save. */
export const SAVE_FAIL =
  "Não foi possível salvar. Confira o espaço disponível no celular e tente novamente.";

/** What the saved text holds: nothing yet (first open), a valid state, or data the app cannot read. */
export type Loaded =
  { kind: "empty" } | { kind: "ok"; state: AppState; migrated: boolean } | { kind: "broken" };

/** Pure: reads the saved text without ever changing it. */
export function loadState(raw: string | null): Loaded {
  if (raw === null || raw === "") return { kind: "empty" };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isState(parsed)) return { kind: "broken" };
    const state = migrateState(parsed);
    return { kind: "ok", state, migrated: state !== parsed };
  } catch {
    return { kind: "broken" };
  }
}

export type StoreSnapshot =
  { kind: "ok"; state: AppState } | { kind: "broken"; raw: string | null };

let cachedRaw: string | null | undefined;
let cachedSnap: StoreSnapshot | null = null;
/** First open where the browser refuses to save: keep the sample in memory only. */
let memoryOnly: AppState | null = null;

function getRaw(): { raw: string | null; readable: boolean } {
  try {
    return { raw: window.localStorage.getItem(KEY), readable: true };
  } catch {
    return { raw: null, readable: false };
  }
}

export function snap(): StoreSnapshot {
  const { raw, readable } = getRaw();
  if (cachedSnap && raw === cachedRaw) return cachedSnap;
  if (raw === null && memoryOnly) {
    cachedRaw = raw;
    return (cachedSnap = { kind: "ok", state: memoryOnly });
  }
  if (!readable) {
    cachedRaw = raw;
    return (cachedSnap = { kind: "broken", raw: null });
  }
  const loaded = loadState(raw);
  cachedRaw = raw;
  if (loaded.kind === "broken") return (cachedSnap = { kind: "broken", raw });
  if (loaded.kind === "empty") {
    // First open: no draws yet. Rehearsal draws are only created on request.
    const fresh = emptyState();
    if (!write(fresh)) memoryOnly = fresh;
    return snap();
  }
  // Older data is upgraded on screen; saving the upgrade is a bonus, the original stays if it fails.
  if (loaded.migrated) write(loaded.state, false);
  return (cachedSnap = { kind: "ok", state: loaded.state });
}

function write(state: AppState, notify = true): boolean {
  const raw = JSON.stringify(state);
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    // Nothing changes on screen: a refused save must never look done.
    return false;
  }
  memoryOnly = null;
  cachedRaw = raw;
  cachedSnap = { kind: "ok", state };
  if (notify) window.dispatchEvent(new Event(EVENT));
  return true;
}

function read(): AppState | null {
  const s = snap();
  return s.kind === "ok" ? s.state : null;
}

export function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Returns null during server render and hydration, or when the saved data cannot be read. */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** null on the server; "broken" when saved data exists but cannot be read (it is kept untouched). */
export function useStoreSnapshot(): StoreSnapshot | null {
  return useSyncExternalStore(subscribe, snap, () => null);
}

/** "Tentar novamente" on the recovery screen. */
export function retryLoad() {
  cachedSnap = null;
  cachedRaw = undefined;
  window.dispatchEvent(new Event(EVENT));
}

/** The saved text exactly as it is, for "Baixar cópia dos dados". */
export function rawSavedData(): string | null {
  return getRaw().raw;
}

export function emptyState(): AppState {
  return { version: 1, draws: [], merchants: [], currentId: "", sound: true };
}

/** Like `update`, but says whether reading or saving failed. Errors thrown by `fn` propagate. */
export function tryUpdate(fn: (state: AppState) => AppState): "ok" | "read" | "write" {
  const s = snap();
  if (s.kind !== "ok") return "read";
  return write(fn(s.state)) ? "ok" : "write";
}

/** Applies a change and saves it. Returns false when the phone's storage is full. */
export function update(fn: (state: AppState) => AppState): boolean {
  const s = snap();
  if (s.kind !== "ok") return false;
  return write(fn(s.state));
}

/** The draw on the Roleta. Screens that call this only render once a draw exists (see FirstRun). */
export function currentDraw(state: AppState): Draw {
  return state.draws.find((d) => d.id === state.currentId) ?? state.draws[0]!;
}

export function updateDraw(id: string, fn: (draw: Draw) => Draw): boolean {
  return update((s) => ({ ...s, draws: s.draws.map((d) => (d.id === id ? fn(d) : d)) }));
}

export function addDraw(draw: Draw): boolean {
  return update((s) => switchCurrent({ ...s, draws: [...s.draws, draw] }, draw.id));
}

export function setCurrent(id: string): boolean {
  return update((s) => switchCurrent(s, id));
}

export function saveMerchant(merchant: Merchant): boolean {
  return update((s) => {
    const exists = s.merchants.some((m) => m.id === merchant.id);
    return {
      ...s,
      merchants: exists
        ? s.merchants.map((m) => (m.id === merchant.id ? merchant : m))
        : [...s.merchants, merchant],
    };
  });
}

/** Adds a draft or ready round without putting it on the wheel. */
export function saveDraw(draw: Draw): boolean {
  return update((s) => ({ ...s, draws: [...s.draws, draw] }));
}

/** Removes the running test from the state and files it under its draw's "Gravações". */
export function closeSession(
  s: AppState,
  now: number,
): { state: AppState; saved: Recording | null } {
  const session = s.recording;
  const { recording: _ended, ...rest } = s;
  if (!session) return { state: s, saved: null };
  const draw = s.draws.find((d) => d.id === session.drawId);
  if (!draw) return { state: rest, saved: null };
  const rec = finishRecording(session, draw, now);
  return {
    saved: rec,
    state: {
      ...rest,
      draws: s.draws.map((d) =>
        d.id === draw.id ? { ...d, recordings: [...(d.recordings ?? []), rec] } : d,
      ),
    },
  };
}

export function endRecording(now: number): Recording | null {
  let saved: Recording | null = null;
  const ok = update((s) => {
    const r = closeSession(s, now);
    saved = r.saved;
    return r.state;
  });
  return ok ? saved : null;
}

/** Putting another round on the wheel ends a test recording of the previous one. */
export function switchCurrent(s: AppState, id: string): AppState {
  const base = s.recording && s.recording.drawId !== id ? closeSession(s, Date.now()).state : s;
  return { ...base, currentId: id };
}

/** Applies a simulated bot message to one draw and reports what happened (demonstration only). */
export function simulateBotMessage(
  drawId: string,
  input: BotInput,
  now: number,
): { outcome: BotOutcome; matchName?: string } | null {
  let out: { outcome: BotOutcome; matchName?: string } | null = null;
  const ok = update((s) => ({
    ...s,
    draws: s.draws.map((d) => {
      if (d.id !== drawId || d.result) return d;
      const r = receiveBotMessage(d, input, now);
      out = { outcome: r.outcome, ...(r.match ? { matchName: r.match.name } : {}) };
      return r.draw;
    }),
  }));
  return ok ? out : null;
}

/** Files a finished real recording under its draw's "Gravações". */
export function addRecording(drawId: string, rec: Recording): boolean {
  return updateDraw(drawId, (d) => ({ ...d, recordings: [...(d.recordings ?? []), rec] }));
}

/* ---------- E05: restore journal (data and videos are saved separately) ---------- */

export const RESTORE_KEY = "enigma-premiado:restore";

export type RestoreJournal = {
  phase: "videos" | "data";
  prevRaw: string | null;
  newRaw: string;
  /** Videos this restore adds; deleted again if the restore is rolled back. */
  newVideoIds: string[];
};

function readJournal(): RestoreJournal | null {
  try {
    const j = window.localStorage.getItem(RESTORE_KEY);
    return j ? (JSON.parse(j) as RestoreJournal) : null;
  } catch {
    return null;
  }
}

export function writeJournal(j: RestoreJournal): boolean {
  try {
    window.localStorage.setItem(RESTORE_KEY, JSON.stringify(j));
    return true;
  } catch {
    return false;
  }
}

export function clearJournal() {
  try {
    window.localStorage.removeItem(RESTORE_KEY);
  } catch {
    /* nothing else to do */
  }
}

/** Saves the restored text as the app's data; false when the browser refuses. */
export function writeRestoredRaw(raw: string): boolean {
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    return false;
  }
  retryLoad();
  return true;
}

/** Puts the data back as it was before a restore that did not finish. */
export function writeRawBack(prevRaw: string | null) {
  try {
    if (prevRaw === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, prevRaw);
  } catch {
    /* journal stays; retried on next open */
    return false;
  }
  retryLoad();
  return true;
}

/**
 * On open, a restore left halfway is settled: phase "data" means every video is in place, so
 * the data write is finished; phase "videos" means data was never touched, so it is rolled back
 * and the returned video ids must be deleted.
 */
export function settleRestore(): { outcome: "none" | "finished" | "rolledBack"; deleteVideos: string[] } {
  const j = readJournal();
  if (!j) return { outcome: "none", deleteVideos: [] };
  if (j.phase === "data") {
    if (getRaw().raw !== j.newRaw && !writeRestoredRaw(j.newRaw)) {
      writeRawBack(j.prevRaw);
      return { outcome: "rolledBack", deleteVideos: j.newVideoIds };
    }
    return { outcome: "finished", deleteVideos: [] };
  }
  writeRawBack(j.prevRaw);
  return { outcome: "rolledBack", deleteVideos: j.newVideoIds };
}
