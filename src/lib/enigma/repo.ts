/**
 * Persistence contract (E02). Screens talk only to `repo`; the adapter behind it can be
 * swapped (local browser storage today, a server database in E03) without touching screens.
 * Every operation takes explicit draw / courtesy ids and returns a typed result.
 */
import { markDelivered } from "./agenda";
import { useSyncExternalStore } from "react";

import { MAX_PARTICIPANTS } from "./numbers";
import {
  confirmList as confirmListRule,
  entriesOf,
  needsConfirmation,
  readyEntries,
  receiveBotMessage,
  type BotInput,
} from "./entries";
import { createSampleState } from "./logic";
import { commitSpin, nextRound as nextRoundRule, roundIndexOf, shownRound } from "./rounds";
import * as local from "./store";
import type { AppState, BotOutcome, Draw, DrawResult, Entry, Merchant, Recording } from "./types";

export type RepoError = "read" | "write" | "unavailable" | "conflict";
export type RepoResult<T = void> =
  { ok: true; value: T } | { ok: false; error: RepoError; message: string };

export const MESSAGES: Record<RepoError, string> = {
  read: "Não foi possível abrir os dados deste celular. Toque em “Tentar novamente”.",
  write: local.SAVE_FAIL,
  unavailable: "Esta ação precisa de internet. Conecte o celular e tente de novo.",
  conflict: "A lista ou a cortesia mudou. Os dados foram recarregados: confira antes de girar.",
};

export type Snapshot = local.StoreSnapshot;

export type SpinInput = {
  drawId: string;
  roundId: string;
  /** The names the screen showed on the wheel, in order. */
  pool: string[];
  /** Answer to "Quem ganhar pode ganhar de novo?", saved together with the first result. */
  repeatWinners?: boolean | undefined;
  result: DrawResult;
};

export type Preferences = { sound?: boolean; volume?: number; groupLogo?: string | null; demoTools?: boolean };

export interface EnigmaRepo {
  readonly kind: "local";
  subscribe(cb: () => void): () => void;
  /** null while opening (server render / hydration). */
  getSnapshot(): Snapshot | null;
  reload(): void;
  rawCopy(): string | null;

  selectDraw(drawId: string): Promise<RepoResult>;
  createDraw(draw: Draw, opts: { makeCurrent: boolean }): Promise<RepoResult>;
  editDraw(drawId: string, fn: (d: Draw) => Draw): Promise<RepoResult>;
  saveMerchant(m: Merchant): Promise<RepoResult>;
  /** Nomes list changes. Conflict when the draw was already spun. */
  changeEntries(drawId: string, fn: (list: Entry[]) => Entry[]): Promise<RepoResult>;
  confirmList(drawId: string): Promise<RepoResult<{ count: number }>>;
  /** Saves one courtesy's result. Returns the saved result, or the one already there. */
  spin(input: SpinInput): Promise<RepoResult<{ status: "saved" | "already"; result: DrawResult }>>;
  nextRound(drawId: string, fromRoundId: string): Promise<RepoResult>;
  setPreferences(p: Preferences): Promise<RepoResult>;
  simulateBot(
    drawId: string,
    input: BotInput,
    now: number,
  ): Promise<RepoResult<{ outcome: BotOutcome; matchName?: string }>>;
  addRecording(drawId: string, rec: Recording): Promise<RepoResult>;
  /** E08 "Lançar rodada": the draft becomes the Roleta's round. */
  launchDraft(drawId: string): Promise<RepoResult>;
  /** E08: records one courtesy's delivery time; never touches results. */
  markDelivered(drawId: string, roundId: string, at: number): Promise<RepoResult>;
  closeLegacyTest(now: number): Promise<RepoResult>;
  /** "Fazer um ensaio": a rehearsal draw, never part of the official history or Listão. */
  startRehearsal(): Promise<RepoResult<{ drawId: string }>>;
}

const ok = <T>(value: T): RepoResult<T> => ({ ok: true, value });
const fail = (error: RepoError): RepoResult<never> => ({
  ok: false,
  error,
  message: MESSAGES[error],
});

class Conflict extends Error {}

/** Runs one local change; a thrown Conflict reloads the data and saves nothing. */
function run(fn: (s: AppState) => AppState): RepoResult {
  try {
    const r = local.tryUpdate(fn);
    return r === "ok" ? ok(undefined) : fail(r);
  } catch (e) {
    if (e instanceof Conflict) {
      local.retryLoad();
      return fail("conflict");
    }
    throw e;
  }
}

function mapDraw(s: AppState, drawId: string, fn: (d: Draw) => Draw): AppState {
  if (!s.draws.some((d) => d.id === drawId)) throw new Conflict();
  return { ...s, draws: s.draws.map((d) => (d.id === drawId ? fn(d) : d)) };
}

/** The winner's entry id: display names on a confirmed list are unique (sameNameEntry), so this is safe. */
function withEntryId(d: Draw, r: DrawResult): DrawResult {
  const e = readyEntries(entriesOf(d)).find((x) => x.name === r.winner);
  return e ? { ...r, entryId: e.id } : r;
}

export const localRepo: EnigmaRepo = {
  kind: "local",
  subscribe: local.subscribe,
  getSnapshot: local.snap,
  reload: local.retryLoad,
  rawCopy: local.rawSavedData,

  async selectDraw(drawId) {
    return run((s) => {
      const d = s.draws.find((x) => x.id === drawId);
      // A draft is never put on the Roleta; it must be launched first.
      if (!d || d.draft) throw new Conflict();
      return local.switchCurrent(s, drawId);
    });
  },
  async createDraw(draw, { makeCurrent }) {
    return run((s) => {
      const next = { ...s, draws: [...s.draws, draw] };
      return makeCurrent ? local.switchCurrent(next, draw.id) : next;
    });
  },
  async editDraw(drawId, fn) {
    return run((s) => mapDraw(s, drawId, fn));
  },
  async saveMerchant(m) {
    return run((s) => ({
      ...s,
      merchants: s.merchants.some((x) => x.id === m.id)
        ? s.merchants.map((x) => (x.id === m.id ? m : x))
        : [...s.merchants, m],
    }));
  },
  async changeEntries(drawId, fn) {
    return run((s) =>
      mapDraw(s, drawId, (d) => {
        if (d.result) throw new Conflict();
        return { ...d, entries: fn(entriesOf(d)) };
      }),
    );
  },
  async confirmList(drawId) {
    let count = 0;
    const r = run((s) =>
      mapDraw(s, drawId, (d) => {
        if (d.result) throw new Conflict();
        const next = confirmListRule(d);
        if (next.names.length > MAX_PARTICIPANTS) throw new Conflict();
        count = next.names.length;
        return next;
      }),
    );
    return r.ok ? ok({ count }) : r;
  },
  async spin(input) {
    let out: { status: "saved" | "already"; result: DrawResult } | null = null;
    const r = run((s) =>
      mapDraw(s, input.drawId, (d) => {
        const index = roundIndexOf(d, input.roundId);
        if (index < 0 || needsConfirmation(d)) throw new Conflict();
        const c = commitSpin(
          d,
          {
            drawId: input.drawId,
            round: index,
            pool: input.pool,
            repeatWinners: input.repeatWinners,
          },
          withEntryId(d, input.result),
        );
        if (c.status === "changed") throw new Conflict();
        const saved = index === 0 ? c.draw.result : c.draw.extraPrizes?.[index - 1]?.result;
        if (!saved) throw new Conflict();
        out = { status: c.status, result: saved };
        return c.draw;
      }),
    );
    if (!r.ok) return r;
    return out ? ok(out) : fail("conflict");
  },
  async nextRound(drawId, fromRoundId) {
    return run((s) =>
      mapDraw(s, drawId, (d) => {
        if (roundIndexOf(d, fromRoundId) !== shownRound(d)) throw new Conflict();
        return nextRoundRule(d);
      }),
    );
  },
  async setPreferences(p) {
    return run((s) => {
      let next: AppState = p.sound === undefined ? s : { ...s, sound: p.sound };
      if (p.volume !== undefined) next = { ...next, volume: Math.min(1, Math.max(0, p.volume)) };
      if (p.demoTools !== undefined) next = { ...next, demoTools: p.demoTools };
      if (p.groupLogo === null) {
        const { groupLogo: _removed, ...rest } = next;
        next = rest;
      } else if (p.groupLogo !== undefined) next = { ...next, groupLogo: p.groupLogo };
      return next;
    });
  },
  async simulateBot(drawId, input, now) {
    let out: { outcome: BotOutcome; matchName?: string } | null = null;
    const r = run((s) =>
      mapDraw(s, drawId, (d) => {
        if (d.result) throw new Conflict();
        const b = receiveBotMessage(d, input, now);
        out = { outcome: b.outcome, ...(b.match ? { matchName: b.match.name } : {}) };
        return b.draw;
      }),
    );
    if (!r.ok) return r;
    return out ? ok(out) : fail("conflict");
  },
  async launchDraft(drawId) {
    return run((s) => {
      const d = s.draws.find((x) => x.id === drawId);
      if (!d) throw new Conflict();
      const { draft: _d, ...launched } = d;
      return local.switchCurrent(mapDraw(s, drawId, () => launched), drawId);
    });
  },
  async markDelivered(drawId, roundId, at) {
    return run((s) => mapDraw(s, drawId, (d) => markDelivered(d, roundId, at)));
  },
  async addRecording(drawId, rec) {
    return run((s) =>
      mapDraw(s, drawId, (d) => ({ ...d, recordings: [...(d.recordings ?? []), rec] })),
    );
  },
  async closeLegacyTest(now) {
    return run((s) => (s.recording ? local.closeSession(s, now).state : s));
  },
  async startRehearsal() {
    const sample = createSampleState().draws[0]!;
    const r = run((s) => local.switchCurrent({ ...s, draws: [...s.draws, sample] }, sample.id));
    return r.ok ? ok({ drawId: sample.id }) : r;
  },
};

/** The adapter in use. E03 replaces it with the server one. */
export let repo: EnigmaRepo = localRepo;
export function setRepo(next: EnigmaRepo) {
  repo = next;
}

const readState = () => {
  const s = repo.getSnapshot();
  return s?.kind === "ok" ? s.state : null;
};

/** null while opening or when the data cannot be read. */
export function useAppState(): AppState | null {
  return useSyncExternalStore(
    (cb) => repo.subscribe(cb),
    readState,
    () => null,
  );
}

export function useSnapshot(): Snapshot | null {
  return useSyncExternalStore(
    (cb) => repo.subscribe(cb),
    () => repo.getSnapshot(),
    () => null,
  );
}

/** Actions that must leave the phone (WhatsApp, links). Local saving never needs it. */
export function needsConnection(): RepoResult {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return fail("unavailable");
  return ok(undefined);
}

export { currentDraw } from "./store";
