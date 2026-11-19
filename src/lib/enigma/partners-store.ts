/** Local adapter for simulated partner records. */
import { emptySim, type PartnerSim } from "./partners";
import { restorePending } from "./restore-lock";

export const SIM_KEY = "enigma-premiado:p1-ensaio";
export type PartnerSnapshot =
  | { kind: "ok"; state: PartnerSim }
  | { kind: "broken"; raw: string | null };

const subs = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cached: PartnerSnapshot | null = null;

export function partnerSnapshot(): PartnerSnapshot {
  let raw: string | null;
  try {
    raw = localStorage.getItem(SIM_KEY);
  } catch {
    cachedRaw = undefined;
    if (cached?.kind !== "broken") cached = { kind: "broken", raw: null };
    return cached;
  }
  if (cached && cachedRaw === raw) return cached;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Formato inválido");
    const state: PartnerSim = { ...emptySim(), ...parsed };
    for (const key of ["invites", "accounts", "offers", "notices"] as const) {
      if (!Array.isArray(state[key])) throw new Error("Formato inválido");
    }
    if (state.accounts.some((a) => !a || typeof a.id !== "string" || typeof a.email !== "string") ||
        state.invites.some((i) => !i || typeof i.id !== "string" || !["geral", "individual"].includes(i.kind)) ||
        state.offers.some((o) => !o || typeof o.id !== "string" || typeof o.name !== "string" ||
          typeof o.prize !== "string" || typeof o.whatsapp !== "string" ||
          (o.confirmed && (typeof o.confirmed.drawId !== "string" || typeof o.confirmed.roundId !== "string"))) ||
        state.notices.some((n) => !n || typeof n.id !== "string" || typeof n.winner !== "string" ||
          typeof n.phone !== "string" || typeof n.drawId !== "string" || typeof n.roundId !== "string"))
      throw new Error("Registros inválidos");
    cached = { kind: "ok", state };
  } catch {
    cached = { kind: "broken", raw };
  }
  return cached;
}

export function subscribePartners(cb: () => void): () => void {
  subs.add(cb);
  const storage = (event: StorageEvent) => {
    if (event.key === SIM_KEY || event.key === null) {
      cached = null;
      cb();
    }
  };
  window.addEventListener("storage", storage);
  return () => {
    subs.delete(cb);
    window.removeEventListener("storage", storage);
  };
}

export function reloadPartners() {
  cached = null;
  subs.forEach((cb) => cb());
}

export function tryUpdatePartners(fn: (s: PartnerSim) => PartnerSim): "ok" | "read" | "write" | "restore" {
  if (restorePending()) return "restore";
  const snapshot = partnerSnapshot();
  if (snapshot.kind !== "ok") return "read";
  const next = fn(snapshot.state);
  const raw = JSON.stringify(next);
  try {
    localStorage.setItem(SIM_KEY, raw);
  } catch {
    return "write";
  }
  cachedRaw = raw;
  cached = { kind: "ok", state: next };
  subs.forEach((cb) => cb());
  return "ok";
}

/** Compatibility for local fixtures and older callers. Screens use partners-repo. */
export function updateSim(fn: (s: PartnerSim) => PartnerSim): boolean {
  return tryUpdatePartners(fn) === "ok";
}

