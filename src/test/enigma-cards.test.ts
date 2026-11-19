import { describe, expect, it } from "vitest";
import {
  cardFileName,
  fitText,
  initials,
  listCardData,
  listaoCardItems,
  paginate,
  partLabel,
  summaryCardData,
  winnerCardData,
  winnerChoices,
  wrapLines,
} from "@/lib/enigma/cards";
import { createDraw } from "@/lib/enigma/logic";
import { withRoundResult } from "@/lib/enigma/rounds";
import type { Merchant } from "@/lib/enigma/types";

// One unit per character, so widths are easy to reason about.
const chars = (t: string) => Array.from(t).length;

const burger: Merchant = { id: "m1", name: "Burger 7", logo: "data:image/png;base64,AA", createdAt: 0 };
const padaria: Merchant = { id: "m2", name: "Padaria Pão de Ouro", createdAt: 0 };
const merchants = [burger, padaria];
const res = (winner: string) => ({ winner, index: 0, rotation: 0, at: 1 });

function threePrizeDraw() {
  const d = createDraw({
    date: "2026-11-19",
    merchant: burger,
    prize: "Lanche do Burger 7",
    confirmed: true,
    more: [
      { merchant: padaria, prize: "Cesta de pães" },
      { merchant: burger, prize: "Refrigerante 2 litros" },
    ],
  });
  return { ...d, names: ["Ana", "Bia", "Caio", "Davi"] };
}

describe("Text in the pictures is never cut", () => {
  it("wraps by words and keeps every word", () => {
    const lines = wrapLines("Maria Aparecida dos Santos Oliveira", 16, chars);
    expect(lines.every((l) => chars(l) <= 16)).toBe(true);
    expect(lines.join(" ")).toBe("Maria Aparecida dos Santos Oliveira");
  });
  it("splits a single word longer than the line without losing letters", () => {
    const lines = wrapLines("Supercalifragilístico", 8, chars);
    expect(lines.every((l) => chars(l) <= 8)).toBe(true);
    expect(lines.join("")).toBe("Supercalifragilístico");
  });
  it("shrinks a long winner name to fit the lines, and keeps all lines at the smallest size", () => {
    const measureAt = (t: string, size: number) => chars(t) * size;
    expect(fitText("Ana", 300, 2, [100, 50], measureAt)).toEqual({ size: 100, lines: ["Ana"] });
    const long = fitText("Maria Aparecida dos Santos", 800, 2, [100, 50], measureAt);
    expect(long.size).toBe(50);
    expect(long.lines.length).toBeLessThanOrEqual(2);
    const huge = fitText("Maria Aparecida dos Santos Oliveira da Silva", 300, 2, [100, 50], measureAt);
    expect(huge.lines.join("").replace(/ /g, "")).toBe("Maria Aparecida dos Santos Oliveira da Silva".replace(/ /g, ""));
  });
});

describe("Long lists become numbered pictures", () => {
  it("keeps order, never leaves an item out and never overfills a picture", () => {
    const heights = Array.from({ length: 23 }, (_, i) => (i % 5 === 0 ? 2 : 1));
    const groups = paginate(heights, () => 6);
    expect(groups.flat()).toEqual(heights.map((_, i) => i));
    for (const g of groups) expect(g.reduce((s, i) => s + (heights[i] ?? 0), 0)).toBeLessThanOrEqual(6);
  });
  it("uses a smaller first picture when it carries the courtesies", () => {
    const groups = paginate(Array(10).fill(1), (g) => (g === 0 ? 2 : 4));
    expect(groups.map((g) => g.length)).toEqual([2, 4, 4]);
  });
  it("counts the gap between items", () => {
    expect(paginate([1, 1, 1], () => 3, 1).map((g) => g.length)).toEqual([2, 1]);
  });
  it("gives an item taller than a picture its own picture", () => {
    expect(paginate([1, 9, 1], () => 4)).toEqual([[0], [1], [2]]);
  });
  it("labels parts only when there are several pictures", () => {
    expect(partLabel(0, 1)).toBeNull();
    expect(partLabel(1, 3)).toBe("Parte 2 de 3");
    expect(cardFileName("lista", "2026-11-19", 1, 3)).toBe("enigma-lista-2026-11-19-parte-2-de-3.png");
    expect(cardFileName("ganhador", "2026-11-19", 0, 1, 1)).toBe("enigma-ganhador-2026-11-19-premio-2.png");
  });
});

describe("Picture data comes from the real screen data", () => {
  it("list picture uses only the confirmed names in wheel order, with every courtesy", () => {
    const d = { ...threePrizeDraw(), names: ["Caio", "Ana"] };
    const card = listCardData(d, merchants);
    expect(card.names).toEqual(["Caio", "Ana"]);
    expect(card.courtesies).toEqual([
      { prize: "Lanche do Burger 7", merchantName: "Burger 7" },
      { prize: "Cesta de pães", merchantName: "Padaria Pão de Ouro" },
      { prize: "Refrigerante 2 litros", merchantName: "Burger 7" },
    ]);
  });

  it("Listão picture follows the screen: active shops first, then the scheduled ones", () => {
    const items = listaoCardItems(
      [{ merchant: burger, since: "2026-11-01", until: "2026-11-30" }],
      [{ merchant: padaria, starts: "2026-12-05" }],
    );
    expect(items).toEqual([
      { kind: "shop", id: "m1", name: "Burger 7", logo: burger.logo, note: "Em divulgação até 30/11/2026" },
      { kind: "section", title: "Agendados" },
      { kind: "shop", id: "m2", name: "Padaria Pão de Ouro", note: "Começa em 05/12/2026" },
    ]);
  });

  it("a shop without a logo gets its initials", () => {
    expect(initials("Padaria Pão de Ouro")).toBe("PP");
    expect(initials("Burger 7")).toBe("B7");
    expect(initials("Sorveteria")).toBe("S");
  });

  it("each winner picture links the winner to its own prize and company", () => {
    let d = threePrizeDraw();
    expect(winnerCardData(d, merchants, 0)).toBeNull();
    d = withRoundResult(d, 0, res("Ana"));
    d = withRoundResult(d, 1, res("Bia"));
    expect(winnerCardData(d, merchants, 1)).toEqual({
      date: "2026-11-19",
      round: 1,
      label: "Prêmio 2 de 3",
      winner: "Bia",
      prize: "Cesta de pães",
      merchantName: "Padaria Pão de Ouro",
    });
    expect(winnerCardData(d, merchants, 0)?.merchantLogo).toBe(burger.logo);
    // The summary waits for every courtesy.
    expect(summaryCardData(d, merchants)).toBeNull();
    expect(winnerChoices(d, merchants).map((c) => c.id)).toEqual([0, 1]);
    d = withRoundResult(d, 2, res("Caio"));
    expect(summaryCardData(d, merchants)?.rows.map((r) => [r.winner, r.prize, r.merchantName])).toEqual([
      ["Ana", "Lanche do Burger 7", "Burger 7"],
      ["Bia", "Cesta de pães", "Padaria Pão de Ouro"],
      ["Caio", "Refrigerante 2 litros", "Burger 7"],
    ]);
    expect(winnerChoices(d, merchants).map((c) => c.id)).toEqual(["resumo", 0, 1, 2]);
  });

  it("a single-courtesy winner picture has no prize number", () => {
    const d = createDraw({ date: "2026-11-19", merchant: padaria, prize: "Cesta", confirmed: true });
    const won = withRoundResult({ ...d, names: ["Ana", "Bia"] }, 0, res("Bia"));
    expect(winnerCardData(won, merchants, 0)?.label).toBeNull();
    expect(summaryCardData(won, merchants)).toBeNull();
  });
});
