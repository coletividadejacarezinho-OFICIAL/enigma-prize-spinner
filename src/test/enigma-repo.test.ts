import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDraw, manualEntryNames } from "./repo-helpers";
import { buildListao, todayISO } from "@/lib/enigma/logic";
import { roundIdOf } from "@/lib/enigma/rounds";
import type { Merchant } from "@/lib/enigma/types";

const KEY = "enigma-premiado:v1";
const burger: Merchant = { id: "m1", name: "Burger 7", createdAt: 0 };

async function fresh() {
  vi.resetModules();
  const mod = await import("@/lib/enigma/repo");
  return mod.localRepo;
}
const stateOf = () => JSON.parse(localStorage.getItem(KEY) ?? "null");

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("Primeiro acesso e ensaio", () => {
  it("starts with no draws and never creates a sample by itself", async () => {
    const repo = await fresh();
    const s = repo.getSnapshot();
    expect(s?.kind === "ok" && s.state.draws.length).toBe(0);
  });
  it("keeps the rehearsal out of the Listão", async () => {
    const repo = await fresh();
    const r = await repo.startRehearsal();
    expect(r.ok).toBe(true);
    const st = stateOf();
    expect(st.draws[0].isSample).toBe(true);
    expect(buildListao(st, todayISO()).active).toHaveLength(0);
  });
});

describe("Giro pelo contrato", () => {
  async function ready(n = 1) {
    const repo = await fresh();
    const draws = Array.from({ length: n }, () =>
      manualEntryNames(
        createDraw({
          date: "2026-11-19",
          merchant: burger,
          prize: "Lanche",
          confirmed: true,
          more: [{ merchant: burger, prize: "Lanche duplo" }],
          repeatWinners: false,
        }),
        ["Ana", "Ana (Centro)", "Bia"],
      ),
    );
    for (const d of draws) await repo.createDraw(d, { makeCurrent: true });
    return { repo, draws };
  }
  const res = (winner: string, index: number) => ({ winner, index, rotation: 30, at: 1 });

  it("saves once, links the winning entry, and returns the saved result on a second try", async () => {
    const { repo, draws } = await ready();
    const d = draws[0]!;
    const a = await repo.spin({
      drawId: d.id,
      roundId: d.id,
      pool: d.names,
      result: res("Ana (Centro)", 1),
    });
    expect(a.ok && a.value.status).toBe("saved");
    const saved = stateOf().draws[0].result;
    expect(saved.entryId).toBe(d.entries!.find((e) => e.name === "Ana (Centro)")!.id);
    const b = await repo.spin({
      drawId: d.id,
      roundId: d.id,
      pool: d.names,
      result: res("Bia", 2),
    });
    expect(b.ok && b.value.status).toBe("already");
    expect(b.ok && b.value.result.winner).toBe("Ana (Centro)");
  });

  it("reports a conflict and saves nothing when the list on screen is out of date", async () => {
    const { repo, draws } = await ready();
    const d = draws[0]!;
    const r = await repo.spin({
      drawId: d.id,
      roundId: d.id,
      pool: ["Ana", "Bia"],
      result: res("Bia", 1),
    });
    expect(r.ok ? "" : r.error).toBe("conflict");
    expect(stateOf().draws[0].result).toBeUndefined();
  });

  it("keeps two draws on the same date and two prizes of the same shop apart", async () => {
    const { repo, draws } = await ready(2);
    const [d1, d2] = [draws[0]!, draws[1]!];
    expect(roundIdOf(d1, 1)).not.toBe(roundIdOf(d2, 1));
    await repo.spin({ drawId: d1.id, roundId: d1.id, pool: d1.names, result: res("Ana", 0) });
    await repo.nextRound(d1.id, d1.id);
    const second = await repo.spin({
      drawId: d1.id,
      roundId: roundIdOf(d1, 1)!,
      pool: ["Ana (Centro)", "Bia"],
      result: res("Ana (Centro)", 0),
    });
    expect(second.ok).toBe(true);
    const st = stateOf();
    const s1 = st.draws.find((x: { id: string }) => x.id === d1.id);
    const s2 = st.draws.find((x: { id: string }) => x.id === d2.id);
    expect([s1.result.winner, s1.extraPrizes[0].result.winner]).toEqual(["Ana", "Ana (Centro)"]);
    expect(s2.result).toBeUndefined();
  });

  it("says the save failed and keeps nothing when the browser refuses", async () => {
    const { repo, draws } = await ready();
    const d = draws[0]!;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Quota");
    });
    const r = await repo.spin({
      drawId: d.id,
      roundId: d.id,
      pool: d.names,
      result: res("Bia", 2),
    });
    expect(r.ok ? "" : r.error).toBe("write");
    const n = await repo.changeEntries(d.id, (l) => l);
    expect(n.ok ? "" : n.error).toBe("write");
  });

  it("refuses list changes on a spun draw as a conflict", async () => {
    const { repo, draws } = await ready();
    const d = draws[0]!;
    await repo.spin({ drawId: d.id, roundId: d.id, pool: d.names, result: res("Bia", 2) });
    const r = await repo.changeEntries(d.id, (l) => l);
    expect(r.ok ? "" : r.error).toBe("conflict");
  });
});

describe("Dados antigos e ilegíveis", () => {
  it("reads an old result that has only the winner's name", async () => {
    const old = {
      version: 1,
      currentId: "d1",
      sound: true,
      draws: [
        {
          id: "d1",
          date: "2026-01-02",
          merchant: "Loja",
          prize: "X",
          names: ["Ana", "Bia"],
          result: { winner: "Bia", index: 1, rotation: 0, at: 1 },
          createdAt: 1,
        },
      ],
    };
    localStorage.setItem(KEY, JSON.stringify(old));
    const repo = await fresh();
    const s = repo.getSnapshot();
    expect(s?.kind === "ok" && s.state.draws[0]!.result?.winner).toBe("Bia");
  });
  it("answers a read error for unreadable data and leaves it untouched", async () => {
    localStorage.setItem(KEY, "{x");
    const repo = await fresh();
    const r = await repo.setPreferences({ sound: false });
    expect(r.ok ? "" : r.error).toBe("read");
    expect(localStorage.getItem(KEY)).toBe("{x");
  });
});
