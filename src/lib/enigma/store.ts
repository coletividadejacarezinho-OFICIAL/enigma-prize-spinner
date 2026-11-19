import { useSyncExternalStore } from "react";
import { createSampleState, finishRecording, migrateState } from "./logic";
import type { AppState, Draw, Merchant, Recording, RecordingSession } from "./types";

const KEY = "enigma-premiado:v1";
const EVENT = "enigma-premiado:change";

let cachedRaw: string | null = null;
let cachedState: AppState | null = null;

function isState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<AppState>;
  return v.version === 1 && Array.isArray(v.draws) && typeof v.currentId === "string";
}

function read(): AppState {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw !== null && raw === cachedRaw && cachedState) return cachedState;
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isState(parsed) && parsed.draws.length > 0) {
        const migrated = migrateState(parsed);
        if (migrated !== parsed) {
          write(migrated);
          return migrated;
        }
        cachedRaw = raw;
        cachedState = parsed;
        return parsed;
      }
    } catch {
      // fall through to a fresh sample
    }
  }
  const fresh = createSampleState();
  write(fresh);
  return fresh;
}

function write(state: AppState): boolean {
  const raw = JSON.stringify(state);
  cachedRaw = raw;
  cachedState = state;
  try {
    window.localStorage.setItem(KEY, raw);
    return true;
  } catch {
    return false;
  } finally {
    window.dispatchEvent(new Event(EVENT));
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Returns null during server render and hydration, then the saved state. */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Applies a change and saves it. Returns false when the phone's storage is full. */
export function update(fn: (state: AppState) => AppState): boolean {
  return write(fn(read()));
}

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

export function startRecording(session: RecordingSession): boolean {
  return update((s) => ({ ...s, recording: session }));
}

/** Removes the running test from the state and files it under its draw's "Gravações". */
function closeSession(s: AppState, now: number): { state: AppState; saved: Recording | null } {
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
  update((s) => {
    const r = closeSession(s, now);
    saved = r.saved;
    return r.state;
  });
  return saved;
}

/** Putting another round on the wheel ends a test recording of the previous one. */
function switchCurrent(s: AppState, id: string): AppState {
  const base = s.recording && s.recording.drawId !== id ? closeSession(s, Date.now()).state : s;
  return { ...base, currentId: id };
}
