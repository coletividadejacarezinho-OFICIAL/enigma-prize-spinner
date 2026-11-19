import { describe, expect, it } from "vitest";
import { createDraw } from "@/lib/enigma/logic";
import {
  addOfferCourtesy,
  cleanWhatsapp,
  findExisting,
  offerText,
  openDraws,
  sameShopRounds,
} from "@/lib/enigma/partners";
import { roundsOf } from "@/lib/enigma/rounds";
import type { Merchant } from "@/lib/enigma/types";

const burger: Merchant = { id: "b7", name: "Burguer 7", whatsapp: "43999990000", createdAt: 0 };
const padaria: Merchant = { id: "p", name: "Padaria Sol", createdAt: 0 };

describe("P1 parceiros", () => {
  it("WhatsApp precisa de DDD", () => {
    expect(cleanWhatsapp("(43) 99999-0000")).toBe("43999990000");
    expect(cleanWhatsapp("+55 43 99999-0000")).toBe("43999990000");
    expect(cleanWhatsapp("99999-0000")).toBeNull();
  });
  it("convite geral: mesmo nome ou mesmo WhatsApp pede Conferir cadastro", () => {
    expect(findExisting([burger], "burguer 7", "")?.id).toBe("b7");
    expect(findExisting([burger], "Outro nome", "43 99999-0000")?.id).toBe("b7");
    expect(findExisting([burger], "Outro nome", "43 98888-0000")).toBeUndefined();
  });
  it("texto da oferta", () => {
    expect(offerText({ name: "Burguer 7", prize: "Um hambúrguer com batata." })).toBe(
      "Burguer 7 ofereceu um hambúrguer com batata",
    );
  });
  it("confirmar oferta acrescenta uma cortesia no fim sem mexer na primeira", () => {
    const d = createDraw({ date: "2026-11-20", merchant: padaria, prize: "Pão", confirmed: true });
    const next = addOfferCourtesy(d, burger, "Hambúrguer", "x1");
    const r = roundsOf(next, [burger, padaria]);
    expect(r.map((x) => [x.merchantName, x.prize])).toEqual([
      ["Padaria Sol", "Pão"],
      ["Burguer 7", "Hambúrguer"],
    ]);
    expect(next.repeatWinners).toBe(false);
  });
  it("prêmio já cadastrado da mesma loja pode ser associado; rodada girada não recebe oferta", () => {
    const d = createDraw({ date: "2026-11-20", merchant: burger, prize: "Hambúrguer", confirmed: true });
    expect(sameShopRounds(d, [burger], "b7")).toEqual([{ roundId: d.id, prize: "Hambúrguer" }]);
    const spun = { ...d, result: { winner: "Ana", index: 0, rotation: 0, at: 1 } };
    expect(openDraws([spun])).toEqual([]);
    expect(addOfferCourtesy(spun, padaria, "Pão", "y")).toBe(spun);
  });
});

import { appendOffers, draftFromOffers, placementOf, type Offer } from "@/lib/enigma/partners";
const off = (id: string, merchantId: string, prize: string): Offer => ({
  id, accountId: "a", merchantId, name: "", whatsapp: "", prize, createdAt: 0,
});
const shops = [burger, padaria, { id: "c", name: "Café", createdAt: 0 }, { id: "d", name: "Doces", createdAt: 0 }];

describe("P1 várias ofertas", () => {
  it("um único rascunho com as ofertas na ordem escolhida", () => {
    const os = [off("1", "b7", "1 hambúrguer com batata"), off("2", "p", "Pão"), off("3", "c", "Café"), off("4", "d", "Bolo")];
    const d = draftFromOffers(os, shops, "2026-11-20", 0)!;
    expect(d.draft).toBe(true);
    expect(roundsOf(d, shops).map((r) => r.prize)).toEqual(["1 hambúrguer com batata", "Pão", "Café", "Bolo"]);
    expect(os.map((o) => placementOf([d], o)?.drawId)).toEqual([d.id, d.id, d.id, d.id]);
  });
  it("uma oferta só cria rodada com esse único prêmio", () => {
    const d = draftFromOffers([off("1", "b7", "1 hambúrguer com batata")], shops, "2026-11-20", 0)!;
    expect(roundsOf(d, shops).map((r) => r.prize)).toEqual(["1 hambúrguer com batata"]);
  });
  it("adicionar duas vezes não duplica; associação explícita não acrescenta", () => {
    const base = createDraw({ date: "2026-11-20", merchant: padaria, prize: "Pão", confirmed: true });
    const os = [off("5", "b7", "X"), off("6", "c", "Y")];
    const once = appendOffers(base, os, shops, { "6": base.id });
    const twice = appendOffers(once, os, shops, { "6": base.id });
    expect(roundsOf(twice, shops).map((r) => r.prize)).toEqual(["Pão", "X"]);
  });
});
