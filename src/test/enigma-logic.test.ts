import { describe, expect, it } from "vitest";
import {
  createDraw,
  createSampleState,
  findDuplicates,
  formatDateBR,
  parsePastedList,
  pickWinnerIndex,
  segmentAtPointer,
  targetRotation,
} from "@/lib/enigma/logic";

describe("Enigma Premiado rules", () => {
  it("stops the pointer on the drawn name", () => {
    for (const count of [2, 3, 6, 7, 25, 100]) {
      for (let index = 0; index < count; index++) {
        for (const jitter of [0, 0.5, 1]) {
          const rotation = targetRotation(123.4, index, count, jitter);
          expect(segmentAtPointer(rotation, count)).toBe(index);
        }
      }
    }
  });

  it("always spins forward several full turns", () => {
    const r = targetRotation(1000, 2, 6, 0.3);
    expect(r - 1000).toBeGreaterThanOrEqual(6 * 360);
  });

  it("draws an index inside the list", () => {
    expect(pickWinnerIndex(6, () => 0)).toBe(0);
    expect(pickWinnerIndex(6, () => 0.9999999)).toBe(5);
  });

  it("starts with a test round of six example names", () => {
    const state = createSampleState();
    expect(state.draws).toHaveLength(1);
    expect(state.draws[0]?.isSample).toBe(true);
    expect(state.draws[0]?.names).toHaveLength(6);
  });

  it("starts a new round with an empty list, never the example names", () => {
    const draw = createDraw({ date: "2026-11-19", merchant: "Loja", prize: "Brinde" });
    expect(draw.names).toEqual([]);
    expect(draw.isSample).toBeUndefined();
  });

  it("shows dates as DD/MM/AAAA", () => {
    expect(formatDateBR("2026-11-19")).toBe("19/11/2026");
  });

  it("reads one name per line from a pasted list", () => {
    expect(parsePastedList("Ana\n\n  Bruno  Lima \n3. Carla\n")).toEqual(["Ana", "Bruno Lima", "Carla"]);
  });

  it("flags repeated names regardless of case and accents", () => {
    const dups = findDuplicates(["Fábio", "Ana", "fabio", "Bia"]);
    expect(dups.get(0)).toEqual([0, 2]);
    expect(dups.get(2)).toEqual([0, 2]);
    expect(dups.has(1)).toBe(false);
  });
});
