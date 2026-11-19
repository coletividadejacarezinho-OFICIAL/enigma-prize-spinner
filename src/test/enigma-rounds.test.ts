import { describe, expect, it } from "vitest";
import type { Draw, Merchant } from "@/lib/enigma/types";
import { buildListao, createDraw } from "@/lib/enigma/logic";
import {
  allRoundsDone,
  applyPrizes,
  canShowRound,
  drawResultMessage,
  needsRepeatAnswer,
  nextRound,
  poolFor,
  roundLabel,
  roundsOf,
  shownRound,
  withRoundResult,
} from "@/lib/enigma/rounds";

const burger: Merchant = { id: "m1", name: "Burger 7", createdAt: 0 };
const padaria: Merchant = { id: "m2", name: "Padaria Pão de Ouro", createdAt: 0 };
const merchants = [burger, padaria];
const GROUP = "COLETIVIDADE JACAREZINHO PR";

function twoPrizeDraw(repeatWinners?: boolean): Draw {
  const d = createDraw({
    date: "2026-11-19",
    merchant: burger,
    prize: "Lanche do Burger 7",
    confirmed: true,
    more: [{ merchant: padaria, prize: "Cesta de pães" }],
    ...(repeatWinners !== undefined ? { repeatWinners } : {}),
  });
  return { ...d, names: ["Ana", "Bia", "Caio"] };
}
const res = (winner: string, index: number) => ({ winner, index, rotation: 0, at: 1 });

describe("Several courtesies in one draw", () => {
  it("keeps each courtesy with its own company and prize, same company allowed twice", () => {
    const d = createDraw({
      date: "2026-11-19",
      merchant: burger,
      prize: "Lanche",
      confirmed: true,
      more: [{ merchant: burger, prize: "Milk-shake" }, { merchant: padaria, prize: "Cesta" }],
    });
    expect(roundsOf(d, merchants).map((r) => [r.merchantName, r.prize])).toEqual([
      ["Burger 7", "Lanche"],
      ["Burger 7", "Milk-shake"],
      ["Padaria Pão de Ouro", "Cesta"],
    ]);
  });

  it("labels the prize in play", () => {
    expect(roundLabel(0, 2, "Lanche do Burger 7")).toBe("Prêmio 1 de 2 — Lanche do Burger 7");
  });

  it("asks the repeat question only with two or more courtesies, before the first spin", () => {
    expect(needsRepeatAnswer(twoPrizeDraw())).toBe(true);
    expect(needsRepeatAnswer(twoPrizeDraw(false))).toBe(false);
    const single = createDraw({ date: "2026-11-19", merchant: burger, prize: "Lanche", confirmed: true });
    expect(needsRepeatAnswer(single)).toBe(false);
  });

  it("ties each winner to the right courtesy and moves on only after a result", () => {
    let d = twoPrizeDraw(true);
    expect(canShowRound(d, 1)).toBe(false);
    expect(nextRound(d)).toBe(d);
    d = withRoundResult(d, 0, res("Bia", 1));
    d = nextRound(d);
    expect(shownRound(d)).toBe(1);
    d = withRoundResult(d, 1, res("Caio", 2));
    const rounds = roundsOf(d, merchants);
    expect(rounds.map((r) => [r.merchantName, r.prize, r.result?.winner])).toEqual([
      ["Burger 7", "Lanche do Burger 7", "Bia"],
      ["Padaria Pão de Ouro", "Cesta de pães", "Caio"],
    ]);
    expect(allRoundsDone(d)).toBe(true);
  });

  it("never changes a round that already has a winner", () => {
    const d = withRoundResult(twoPrizeDraw(true), 0, res("Bia", 1));
    expect(withRoundResult(d, 0, res("Ana", 0)).result?.winner).toBe("Bia");
  });

  it("takes earlier winners off the wheel when the answer is Não", () => {
    const no = withRoundResult(twoPrizeDraw(false), 0, res("Bia", 1));
    expect(poolFor(no, 1)).toEqual(["Ana", "Caio"]);
    const yes = withRoundResult(twoPrizeDraw(true), 0, res("Bia", 1));
    expect(poolFor(yes, 1)).toEqual(["Ana", "Bia", "Caio"]);
  });

  it("removes only one spot per win, so another person with the same name stays", () => {
    const d = { ...withRoundResult(twoPrizeDraw(false), 0, res("Ana", 0)), names: ["Ana", "Ana", "Bia"] };
    expect(poolFor(d, 1)).toEqual(["Ana", "Bia"]);
  });

  it("shares one WhatsApp message with every prize, company and winner once all rounds are done", () => {
    let d = withRoundResult(twoPrizeDraw(true), 0, res("Bia", 1));
    expect(drawResultMessage(d, merchants, GROUP)).toBeNull();
    d = withRoundResult(nextRound(d), 1, res("Caio", 2));
    const text = drawResultMessage(d, merchants, GROUP) ?? "";
    expect(text).toContain("🎁 Prêmio 1: Lanche do Burger 7\n🤝 Oferecimento: Burger 7\n🎉 Ganhador(a): Bia");
    expect(text).toContain("🎁 Prêmio 2: Cesta de pães\n🤝 Oferecimento: Padaria Pão de Ouro\n🎉 Ganhador(a): Caio");
  });

  it("keeps results of courtesies that stay when editing", () => {
    const d = withRoundResult(twoPrizeDraw(true), 0, res("Bia", 1));
    const spun = withRoundResult(nextRound(d), 1, res("Caio", 2));
    const extraId = spun.extraPrizes?.[0]?.id ?? "";
    const edited = applyPrizes(
      spun,
      [
        { merchant: burger, prize: "Lanche do Burger 7" },
        { id: extraId, merchant: padaria, prize: "Cesta de pães" },
        { merchant: padaria, prize: "Bolo" },
      ],
      () => "new",
    );
    expect(roundsOf(edited, merchants).map((r) => r.result?.winner)).toEqual(["Bia", "Caio", undefined]);
  });

  it("puts every company of a confirmed draw on the Listão", () => {
    const d = twoPrizeDraw(true);
    const list = buildListao({ draws: [d], merchants }, "2026-11-19");
    expect(list.active.map((e) => e.merchant.name)).toEqual(["Burger 7", "Padaria Pão de Ouro"]);
  });
});
