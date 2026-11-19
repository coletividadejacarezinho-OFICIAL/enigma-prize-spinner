/** P1 simulated partner data, in its own key so it never mixes with the real draws. */
import { useSyncExternalStore } from "react";
import { emptySim, type PartnerSim } from "./partners";

export const SIM_KEY = "enigma-premiado:p1-ensaio";
const subs = new Set<() => void>();
let cache: PartnerSim | null = null;

function read(): PartnerSim {
  if (cache) return cache;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SIM_KEY) : null;
    cache = raw ? { ...emptySim(), ...(JSON.parse(raw) as PartnerSim) } : emptySim();
  } catch {
    cache = emptySim();
  }
  return cache;
}

/** Saves; false when the phone refused (nothing changes on screen then). */
export function updateSim(fn: (s: PartnerSim) => PartnerSim): boolean {
  const next = fn(read());
  try {
    localStorage.setItem(SIM_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  cache = next;
  subs.forEach((f) => f());
  return true;
}

export function useSim(): PartnerSim | null {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === SIM_KEY) {
          cache = null;
          cb();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        subs.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    read,
    () => null,
  );
}
