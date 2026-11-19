import { describe, expect, it } from "vitest";
import { clampVolume, noteCount, spinNoteTimes, wheelEase } from "@/lib/enigma/jingle";
import { createDraw, segmentAtPointer, targetRotation } from "@/lib/enigma/logic";
import {
  MAX_PARTICIPANTS,
  numberedList,
  numberedPool,
  overLimitMessage,
  searchNumbered,
  wheelLabels,
  winnerNumber,
} from "@/lib/enigma/numbers";
import { poolFor } from "@/lib/enigma/rounds";
import type { Draw, Merchant } from "@/lib/enigma/types";
import { manualEntryNames } from "./repo-helpers";

const m: Merchant = { id: "m1", name: "Burger 7", createdAt: 0 };
const names = (n: number) =>
  Array.from({ length: n }, (_, i) => (i === 1 ? "Ana Souza (Centro)" : i === 0 ? "Ana Souza" : `Pessoa ${i + 1}`));
function draw(n: number): Draw {
  const d = createDraw({ date: "2026-11-19", merchant: m, prize: "Lanche", confirmed: true, more: [{ merchant: m, prize: "Combo" }] });
  return { ...manualEntryNames(d, names(n)), repeatWinners: false };
}

describe("E06: 250 participantes", () => {
  it("limit is 250: 250 is fine, 251 is refused with a clear message (never cut)", () => {
    expect(MAX_PARTICIPANTS).toBe(250);
    expect(overLimitMessage(250)).toBeNull();
    expect(overLimitMessage(251)).toContain("tire 1");
  });
  it("numbers follow the confirmed order with entry IDs; homonyms stay separate", () => {
    const d = draw(250);
    const list = numberedList(d);
    expect(list).toHaveLength(250);
    expect(list.map((x) => x.number)).toEqual(Array.from({ length: 250 }, (_, i) => i + 1));
    expect(list[0]!.name).toBe("Ana Souza");
    expect(list[1]!.name).toBe("Ana Souza (Centro)");
    expect(new Set(list.map((x) => x.entryId)).size).toBe(250);
  });
  it("search finds nº 250 first and names ignoring accents", () => {
    const list = numberedList(draw(250));
    expect(searchNumbered(list, "250")[0]!.number).toBe(250);
    expect(searchNumbered(list, "nº 250")[0]!.number).toBe(250);
    expect(searchNumbered(list, "ana souza").map((x) => x.number)).toEqual([1, 2]);
  });
  it("big wheels show numbered marks, small ones names", () => {
    expect(wheelLabels(numberedPool(draw(60), 0))[59]).toBe("Pessoa 60");
    const big = wheelLabels(numberedPool(draw(250), 0));
    expect(big[0]).toBe("1");
    expect(big[249]).toBe("250");
    expect(big[4]).toBe("");
    expect(big.filter(Boolean)).toHaveLength(26);
    expect(wheelLabels(numberedPool(draw(61), 0))[4]).toBe("5");
  });
  it("second courtesy: earlier winner leaves by entry ID, public numbers stay the same", () => {
    const d = draw(250);
    const list = numberedList(d);
    const won = list[9]!; // nº 10
    const d2: Draw = { ...d, result: { winner: won.name, index: 9, rotation: 0, at: 1, entryId: won.entryId! } };
    const pool = numberedPool(d2, 1);
    expect(pool).toHaveLength(249);
    expect(pool.some((p) => p.number === 10)).toBe(false);
    // Internal wheel index 9 is now nº 11, its public number unchanged.
    expect(pool[9]!.number).toBe(11);
    expect(poolFor(d2, 1)[9]).toBe(list[10]!.name);
    expect(winnerNumber(d2, d2.result)).toBe(10);
  });
  it("pointer lands on the saved slice for 250 slices", () => {
    for (const idx of [0, 124, 249]) {
      const rot = targetRotation(0, idx, 250, 0.5);
      expect(segmentAtPointer(rot, 250)).toBe(idx);
    }
  });
});

describe("E06: trilha do giro", () => {
  it("notes follow the wheel easing and end before the reveal", () => {
    const t = spinNoteTimes(5500, 40);
    expect(t[0]).toBe(0);
    expect(t.every((x, i) => i === 0 || x > t[i - 1]!)).toBe(true);
    expect(t[t.length - 1]!).toBeLessThan(5.5);
    // At each note the wheel has covered k/40 of its turn.
    t.forEach((x, k) => expect(wheelEase(x / 5.5)).toBeCloseTo(k / 40, 6));
    expect(noteCount(5500)).toBeLessThanOrEqual(48);
  });
  it("volume preference is clamped, default 70%", () => {
    expect(clampVolume(undefined)).toBe(0.7);
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume(0.3)).toBe(0.3);
  });
});
