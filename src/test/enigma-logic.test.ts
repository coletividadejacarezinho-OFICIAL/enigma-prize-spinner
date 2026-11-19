import { describe, expect, it } from "vitest";
import type { Draw, Merchant } from "@/lib/enigma/types";
import {
  finishRecording,
  formatDuration,
  micFor,
  addDaysISO,
  buildListao,
  createDraw,
  merchantOf,
  migrateState,
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
    const merchant: Merchant = { id: "m1", name: "Loja", createdAt: 0 };
    const draw = createDraw({ date: "2026-11-19", merchant, prize: "Brinde", confirmed: true });
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

  it("shows the chosen shop's logo and name with the courtesy exactly as typed", () => {
    const burguer: Merchant = { id: "b7", name: "Burguer 7", logo: "data:logo", createdAt: 0 };
    const draw = createDraw({
      date: "2026-11-19",
      merchant: burguer,
      prize: "Um hambúrguer com batata",
      confirmed: true,
    });
    expect(merchantOf([burguer], draw)).toEqual({ name: "Burguer 7", logo: "data:logo" });
    expect(draw.prize).toBe("Um hambúrguer com batata");
    expect(draw.date).toBe("2026-11-19");
  });
});

describe("Listão da Alegria", () => {
  const shop = (id: string, name: string): Merchant => ({ id, name, createdAt: 0 });
  const draw = (merchantId: string, date: string, confirmed = true, extra: Partial<Draw> = {}): Draw => ({
    id: `${merchantId}-${date}`,
    date,
    merchantId,
    merchant: merchantId,
    prize: "Brinde",
    confirmed,
    names: [],
    createdAt: 0,
    ...extra,
  });
  const a = shop("a", "Açougue Boi Bom");
  const b = shop("b", "Burguer 7");

  it("counts 30 calendar days including the draw day", () => {
    const state = { merchants: [a], draws: [draw("a", "2026-11-01")] };
    expect(buildListao(state, "2026-11-01").active).toHaveLength(1);
    expect(buildListao(state, "2026-11-30").active).toHaveLength(1);
    expect(buildListao(state, "2026-12-01").active).toHaveLength(0);
    expect(buildListao(state, "2026-11-30").active[0]?.until).toBe("2026-11-30");
  });

  it("leaves out courtesies not yet confirmed and the test round", () => {
    const state = {
      merchants: [a, b],
      draws: [draw("a", "2026-11-10", false), draw("b", "2026-11-10", true, { isSample: true })],
    };
    expect(buildListao(state, "2026-11-19").active).toEqual([]);
  });

  it("lists each shop once, counting from its latest courtesy that has arrived", () => {
    const state = {
      merchants: [a],
      draws: [draw("a", "2026-10-01"), draw("a", "2026-11-15"), draw("a", "2026-12-20")],
    };
    const { active, scheduled } = buildListao(state, "2026-11-19");
    expect(active).toHaveLength(1);
    expect(active[0]?.since).toBe("2026-11-15");
    expect(active[0]?.until).toBe("2026-12-14");
    expect(scheduled).toEqual([]);
  });

  it("schedules a confirmed courtesy dated in the future instead of listing it", () => {
    const state = { merchants: [b], draws: [draw("b", "2026-11-25")] };
    const { active, scheduled } = buildListao(state, "2026-11-19");
    expect(active).toEqual([]);
    expect(scheduled[0]?.starts).toBe("2026-11-25");
  });

  it("adds days across months and years", () => {
    expect(addDaysISO("2026-12-15", 29)).toBe("2027-01-13");
  });

  it("turns shop names from older rounds into registered shops", () => {
    const old = {
      version: 1 as const,
      currentId: "x",
      sound: true,
      draws: [{ ...draw("x", "2026-11-19", false), merchantId: undefined, merchant: "Mercado Bom Preço" }].map(
        ({ merchantId: _m, ...d }) => d,
      ),
    } as unknown as Parameters<typeof migrateState>[0];
    const next = migrateState(old);
    expect(next.merchants.map((m) => m.name)).toEqual(["Mercado Bom Preço"]);
    expect(next.draws[0]?.merchantId).toBe(next.merchants[0]?.id);
  });
});

describe("Test recording", () => {
  const base: Draw = {
    id: "d1",
    date: "2026-11-19",
    merchant: "Burguer 7",
    prize: "Um hambúrguer com batata",
    names: ["Ana", "Bia"],
    createdAt: 0,
  };
  const session = { drawId: "d1", mode: "roleta-voz" as const, mic: true, startedAt: 1000 };

  it("saves the winner when the wheel was spun during the test", () => {
    const draw = { ...base, result: { winner: "Bia", index: 1, rotation: 0, at: 5000 } };
    const rec = finishRecording(session, draw, 65000);
    expect(rec.winner).toBe("Bia");
    expect(rec.durationMs).toBe(64000);
  });

  it("has no winner when ended before spinning", () => {
    expect(finishRecording(session, base, 9000).winner).toBeUndefined();
  });

  it("lets only the video modes turn the microphone off", () => {
    expect(micFor("roleta-voz", false)).toBe(false);
    expect(micFor("roleta-camera", false)).toBe(false);
    expect(micFor("voz", false)).toBe(true);
  });

  it("shows durations as mm:ss", () => {
    expect(formatDuration(64000)).toBe("01:04");
    expect(formatDuration(3725000)).toBe("1:02:05");
  });
});
