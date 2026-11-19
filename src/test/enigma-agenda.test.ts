import { describe, expect, it } from "vitest";
import {
  fromTemplate,
  markDelivered,
  roundStage,
  windowState,
  deliveryRows,
} from "@/lib/enigma/agenda";
import { receiveBotMessage, confirmEntry } from "@/lib/enigma/entries";
import type { Draw } from "@/lib/enigma/types";

// 2026-11-19 is a Thursday; 2026-11-21 a Saturday.
const base: Draw = {
  id: "d1",
  date: "2026-11-19",
  merchant: "Padaria",
  prize: "Cesta",
  names: [],
  entries: [],
  createdAt: 1,
};

describe("E08 window in Jacarezinho", () => {
  it("opens at 19:00, takes 19:29 and is closed at 19:30", () => {
    expect(windowState("2026-11-19", "18:59")).toBe("antes");
    expect(windowState("2026-11-19", "19:00")).toBe("aberta");
    expect(windowState("2026-11-19", "19:29")).toBe("aberta");
    expect(windowState("2026-11-19", "19:30")).toBe("encerrada");
  });
  it("is closed on weekends", () => {
    expect(windowState("2026-11-21", "19:10")).toBe("fora-do-dia");
    expect(windowState("2026-11-22", "19:10")).toBe("fora-do-dia");
  });
});

describe("E08 simulated events", () => {
  const msg = {
    name: "Carla",
    senderId: "T1",
    time: "19:10",
    situation: "conferir" as const,
    eventId: "ev-1",
  };
  it("the same event twice keeps one entry", () => {
    const once = receiveBotMessage(base, msg, 1).draw;
    const twice = receiveBotMessage(once, { ...msg, senderId: "T9", name: "Carla 2" }, 2);
    expect(twice.outcome).toBe("repetida");
    expect(twice.draw.entries).toHaveLength(1);
  });
  it("a guess before 19:00 or on Saturday stays out", () => {
    expect(receiveBotMessage(base, { ...msg, time: "18:59" }, 1).outcome).toBe("fora-do-prazo");
    expect(receiveBotMessage(base, { ...msg, day: "2026-11-21" }, 1).outcome).toBe("fora-do-prazo");
  });
  it("keeps arrival time apart from the later check", () => {
    const d = receiveBotMessage(base, msg, 1).draw;
    const e = d.entries![0]!;
    const checked = confirmEntry(d.entries!, e.id, undefined, 5000)[0]!;
    expect([checked.botTime, checked.status, checked.checkedAt]).toEqual(["19:10", "ready", 5000]);
  });
});

describe("E08 rounds", () => {
  const spun: Draw = {
    ...base,
    names: ["Ana", "Bia"],
    entries: [],
    result: { winner: "Ana", index: 0, rotation: 1, at: 2 },
    extraPrizes: [
      {
        id: "p2",
        merchant: "Loja",
        prize: "Bolo",
        result: { winner: "Bia", index: 1, rotation: 1, at: 3 },
      },
    ],
    recordings: [{ id: "r", mode: "voz", mic: true, startedAt: 1, durationMs: 1 }],
  };
  it("a template copies the courtesies only", () => {
    const t = fromTemplate(spun, "2026-11-20", 9);
    expect(t.id).not.toBe(spun.id);
    expect([t.names, t.entries, t.result, t.recordings, t.deliveries, t.draft]).toEqual([
      [],
      [],
      undefined,
      undefined,
      undefined,
      true,
    ]);
    expect(t.extraPrizes?.[0]).toMatchObject({ prize: "Bolo" });
    expect(t.extraPrizes?.[0]?.result).toBeUndefined();
    expect(t.extraPrizes?.[0]?.id).not.toBe("p2");
  });
  it("delivering one courtesy keeps the winner and leaves the other pending", () => {
    const d = markDelivered(spun, "p2", 100);
    const rows = deliveryRows(d, []);
    expect(rows.map((r) => [r.winner, r.deliveredAt])).toEqual([
      ["Ana", undefined],
      ["Bia", 100],
    ]);
    expect(d.extraPrizes?.[0]?.result).toEqual(spun.extraPrizes?.[0]?.result);
    expect(markDelivered(d, "p2", 200)).toBe(d);
    expect(roundStage(d).stage).toBe("entrega");
    expect(roundStage(markDelivered(d, "d1", 300)).stage).toBe("entregue");
  });
  it("a courtesy without a winner can't be delivered", () => {
    expect(markDelivered(base, "d1", 1)).toBe(base);
  });
  it("a draft says so", () => {
    expect(roundStage({ ...base, draft: true }).stage).toBe("rascunho");
  });
});

import { riddleCardData } from "@/lib/enigma/cards";
describe("E08 riddle art", () => {
  const d: Draw = {
    ...base,
    riddle: { text: "O que é?", image: "data:a", answer: "A sombra", answerImage: "data:b" },
  };
  it("the riddle art never carries the answer or its picture", () => {
    const c = riddleCardData(d, "enigma")!;
    expect(JSON.stringify(c)).not.toContain("sombra");
    expect(c.image).toBe("data:a");
  });
  it("the answer art highlights the answer", () => {
    expect(riddleCardData(d, "resposta")).toMatchObject({ headline: "A sombra", image: "data:b" });
  });
});
