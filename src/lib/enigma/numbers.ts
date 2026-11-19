/**
 * E06: public entry numbers and big lists. The number of a participant is its position in the
 * confirmed list (`draw.names`, 1-based) and never changes, even when earlier winners leave the
 * wheel of a later courtesy. Pure and tested (src/test/enigma-numbers.test.ts).
 */
import { normalizeForCompare } from "./logic";
import { entriesOf } from "./entries";
import { poolFor } from "./rounds";
import type { Draw } from "./types";

/** Most people one wheel can take; more are never cut silently, the list just cannot be confirmed. */
export const MAX_PARTICIPANTS = 250;

export type Numbered = { number: number; name: string; entryId?: string };

/** The confirmed list with public numbers and entry IDs. */
export function numberedList(draw: Draw): Numbered[] {
  const byName = new Map(entriesOf(draw).map((e) => [e.name, e.id]));
  return draw.names.map((name, i) => {
    const id = byName.get(name);
    return { number: i + 1, name, ...(id ? { entryId: id } : {}) };
  });
}

/** The wheel of courtesy `round`, in wheel order, each slice keeping its public number. */
export function numberedPool(draw: Draw, round: number): Numbered[] {
  const all = numberedList(draw);
  const used = new Set<number>();
  return poolFor(draw, round).map((name) => {
    const n = all.find((x) => x.name === name && !used.has(x.number));
    if (!n) return { number: 0, name };
    used.add(n.number);
    return n;
  });
}

/** Public number of a saved winner (by entry ID first, then by name); null if not found. */
export function winnerNumber(
  draw: Draw,
  winner: { winner: string; entryId?: string } | undefined,
): number | null {
  if (!winner) return null;
  const all = numberedList(draw);
  const hit =
    (winner.entryId ? all.find((x) => x.entryId === winner.entryId) : undefined) ??
    all.find((x) => x.name === winner.winner);
  return hit ? hit.number : null;
}

/** Search by number ("250", "nº 250") or by part of the name, ignoring accents and case. */
export function searchNumbered(list: Numbered[], query: string): Numbered[] {
  const q = query.trim();
  if (!q) return list;
  const digits = q.replace(/^n[º°o.]?\s*/i, "");
  if (/^\d+$/.test(digits)) {
    const n = Number(digits);
    const exact = list.filter((x) => x.number === n);
    const rest = list.filter((x) => x.number !== n && String(x.number).startsWith(digits));
    return [...exact, ...rest];
  }
  const key = normalizeForCompare(q);
  return list.filter((x) => normalizeForCompare(x.name).includes(key));
}

/** Why a list cannot be confirmed because of its size; null when the size is fine. */
export function overLimitMessage(ready: number): string | null {
  if (ready <= MAX_PARTICIPANTS) return null;
  const extra = ready - MAX_PARTICIPANTS;
  return `A roleta aceita até ${MAX_PARTICIPANTS} nomes. Há ${ready} prontos: tire ${extra} para confirmar.`;
}
