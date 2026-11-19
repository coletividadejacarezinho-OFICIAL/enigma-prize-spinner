import { afterEach, describe, expect, it, vi } from "vitest";
import { createDraw, createSampleState } from "@/lib/enigma/logic";
import { commitSpin, roundResult } from "@/lib/enigma/rounds";
import { loadState } from "@/lib/enigma/store";
import type { Draw, Merchant } from "@/lib/enigma/types";

const burger: Merchant = { id: "m1", name: "Burger 7", createdAt: 0 };
const padaria: Merchant = { id: "m2", name: "Padaria", createdAt: 0 };
function draw(): Draw {
  const d = createDraw({
    date: "2026-11-19",
    merchant: burger,
    prize: "Lanche",
    confirmed: true,
    more: [{ merchant: padaria, prize: "Cesta" }],
  });
  return { ...d, names: ["Ana", "Bia", "Caio"] };
}
const res = (winner: string, index: number) => ({ winner, index, rotation: 10, at: 1 });

describe("Giro só com resultado salvo", () => {
  it("saves the first result and the repeat answer together", () => {
    const d = draw();
    const r = commitSpin(
      d,
      { drawId: d.id, round: 0, pool: d.names, repeatWinners: false },
      res("Bia", 1),
    );
    expect(r.status).toBe("saved");
    expect(r.draw.repeatWinners).toBe(false);
    expect(r.draw.result?.winner).toBe("Bia");
  });
  it("never picks another winner for a courtesy that already has one", () => {
    const d = { ...draw(), repeatWinners: true, result: res("Ana", 0) };
    const r = commitSpin(d, { drawId: d.id, round: 0, pool: d.names }, res("Caio", 2));
    expect(r.status).toBe("already");
    expect(roundResult(r.draw, 0)?.winner).toBe("Ana");
  });
  it("saves nothing when the confirmed list on screen is out of date", () => {
    const d = { ...draw(), repeatWinners: true };
    const r = commitSpin(d, { drawId: d.id, round: 0, pool: ["Ana", "Bia"] }, res("Bia", 1));
    expect(r.status).toBe("changed");
    expect(r.draw).toBe(d);
  });
  it("saves nothing for another draw or courtesy than the one shown", () => {
    const d = { ...draw(), repeatWinners: true };
    expect(commitSpin(d, { drawId: "x", round: 0, pool: d.names }, res("Ana", 0)).status).toBe(
      "changed",
    );
    expect(commitSpin(d, { drawId: d.id, round: 1, pool: d.names }, res("Ana", 0)).status).toBe(
      "changed",
    );
  });
  it("requires the repeat answer before the first spin of several courtesies", () => {
    const d = draw();
    expect(commitSpin(d, { drawId: d.id, round: 0, pool: d.names }, res("Ana", 0)).status).toBe(
      "changed",
    );
  });
});

describe("Leitura dos dados guardados", () => {
  it("tells a first open apart from unreadable data", () => {
    expect(loadState(null).kind).toBe("empty");
    expect(loadState("{nao é json").kind).toBe("broken");
    expect(loadState(JSON.stringify({ version: 2 })).kind).toBe("broken");
  });
  it("reads valid saved data", () => {
    const s = createSampleState();
    const r = loadState(JSON.stringify(s));
    expect(r.kind).toBe("ok");
  });
});

describe("Gravação recusada pelo navegador", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });
  it("keeps unreadable data untouched and refuses changes", async () => {
    localStorage.setItem("enigma-premiado:v1", "{quebrado");
    vi.resetModules();
    const store = await import("@/lib/enigma/store");
    expect(store.update((s) => s)).toBe(false);
    expect(localStorage.getItem("enigma-premiado:v1")).toBe("{quebrado");
  });
  it("does not show a refused save as done", async () => {
    localStorage.clear();
    vi.resetModules();
    const store = await import("@/lib/enigma/store");
    expect(store.update((s) => ({ ...s, sound: true }))).toBe(true);
    const before = localStorage.getItem("enigma-premiado:v1");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(store.update((s) => ({ ...s, sound: false }))).toBe(false);
    expect(localStorage.getItem("enigma-premiado:v1")).toBe(before);
    expect(store.rawSavedData()).toBe(before);
  });
});
