import { expect, it } from "vitest";

import { containedImageRect } from "@/lib/enigma/cards-render";
import { summaryCardData, winnerCardData } from "@/lib/enigma/cards";
import { createDraw } from "@/lib/enigma/logic";
import { roundsOf, withRoundResult } from "@/lib/enigma/rounds";
import type { Merchant } from "@/lib/enigma/types";

it("fits wide, tall and square brand images without cropping or changing aspect ratio", () => {
  const wide = containedImageRect(400, 200, 0, 0, 100, 100, 8);
  expect(wide).toEqual({ x: 8, y: 29, width: 84, height: 42 });
  const tall = containedImageRect(200, 400, 10, 20, 100, 100, 8);
  expect(tall).toEqual({ x: 39, y: 28, width: 42, height: 84 });
  const square = containedImageRect(500, 500, 0, 0, 100, 100, 8);
  expect(square).toEqual({ x: 8, y: 8, width: 84, height: 84 });
  for (const result of [wide, tall, square]) {
    expect(result).not.toBeNull();
    expect(result!.x).toBeGreaterThanOrEqual(0);
    expect(result!.y).toBeGreaterThanOrEqual(0);
    expect(result!.x + result!.width).toBeLessThanOrEqual(110);
    expect(result!.y + result!.height).toBeLessThanOrEqual(120);
  }
});

it("never tries to paint an image with invalid dimensions", () => {
  expect(containedImageRect(0, 100, 0, 0, 100, 100)).toBeNull();
  expect(containedImageRect(100, 0, 0, 0, 100, 100)).toBeNull();
  expect(containedImageRect(100, 100, 0, 0, 0, 100)).toBeNull();
});

it("keeps the original saved winner, public number, sponsor and logo in individual and collective arts", () => {
  const burger: Merchant = {
    id: "m1",
    name: "Burger 7",
    logo: "data:image/png;base64,AAAA",
    createdAt: 0,
  };
  const bakery: Merchant = {
    id: "m2",
    name: "Padaria do Bairro",
    logo: "data:image/png;base64,BBBB",
    createdAt: 0,
  };
  const merchants = [burger, bakery];
  let draw = {
    ...createDraw({
      date: "2026-11-19",
      merchant: burger,
      prize: "Combo grande",
      confirmed: true,
      more: [{ merchant: bakery, prize: "Pães artesanais" }],
    }),
    names: ["Ana Aparecida dos Santos", "Bruno Lima", "Carolina Silva"],
  };

  draw = withRoundResult(draw, 0, {
    winner: "Ana Aparecida dos Santos", index: 0, rotation: 200, at: 1,
  });
  draw = withRoundResult(draw, 1, {
    winner: "Carolina Silva", index: 2, rotation: 400, at: 2,
  });

  expect(roundsOf(draw, merchants)).toHaveLength(2);
  const first = winnerCardData(draw, merchants, 0);
  expect(first).toMatchObject({
    winner: "Ana Aparecida dos Santos",
    number: 1,
    prize: "Combo grande",
    merchantName: "Burger 7",
    merchantLogo: burger.logo,
  });
  expect(summaryCardData(draw, merchants)?.rows).toMatchObject([
    {
      winner: "Ana Aparecida dos Santos",
      number: 1,
      merchantName: "Burger 7",
      merchantLogo: burger.logo,
    },
    {
      winner: "Carolina Silva",
      number: 3,
      merchantName: "Padaria do Bairro",
      merchantLogo: bakery.logo,
    },
  ]);
});
