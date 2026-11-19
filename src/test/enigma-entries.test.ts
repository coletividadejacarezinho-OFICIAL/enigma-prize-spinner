import { describe, expect, it } from "vitest";
import type { Draw } from "@/lib/enigma/types";
import {
  confirmEntry,
  confirmList,
  entriesOf,
  listMessage,
  manualEntry,
  mergeEntry,
  needsConfirmation,
  pendingEntries,
  readyNames,
  receiveBotMessage,
  sameNameEntry,
  similarNames,
} from "@/lib/enigma/entries";
import { migrateState } from "@/lib/enigma/logic";

const GROUP = "COLETIVIDADE JACAREZINHO PR";

function draw(names: string[] = [], id = "d1"): Draw {
  return {
    id,
    date: "2026-11-19",
    merchant: "Padaria",
    prize: "Cesta",
    names: [],
    entries: names.map((n, i) => manualEntry(n, i)),
    createdAt: 0,
  };
}

describe("Nomes list (stage 7)", () => {
  it("spots a typed name that is already in the list, ignoring accents and case", () => {
    const d = draw(["Maria Silva"]);
    expect(sameNameEntry(entriesOf(d), "  maria   sílva ")?.name).toBe("Maria Silva");
    expect(sameNameEntry(entriesOf(d), "Maria Souza")).toBeUndefined();
  });

  it("keeps two people with the same name when their display names differ", () => {
    const d = draw(["Maria Silva (Centro)", "Maria Silva (Vila Rosa)"]);
    expect(readyNames(entriesOf(d))).toEqual(["Maria Silva (Centro)", "Maria Silva (Vila Rosa)"]);
  });

  it("leaves pending entries off the wheel", () => {
    const d = draw(["Ana", "Bia"]);
    const pending = manualEntry("Ana", 9, { kind: "repetido", withId: entriesOf(d)[0]!.id });
    const withPending = { ...d, entries: [...entriesOf(d), pending] };
    expect(confirmList(withPending).names).toEqual(["Ana", "Bia"]);
  });

  it("asks for a new confirmation when the list changes before the spin", () => {
    const confirmed = confirmList(draw(["Ana", "Bia"]));
    expect(needsConfirmation(confirmed)).toBe(false);
    const edited = { ...confirmed, entries: [...entriesOf(confirmed), manualEntry("Caio", 5)] };
    expect(needsConfirmation(edited)).toBe(true);
    expect(confirmList(edited).names).toEqual(["Ana", "Bia", "Caio"]);
  });

  it("keeps the list used in a spun draw", () => {
    const spun: Draw = {
      ...confirmList(draw(["Ana", "Bia"])),
      result: { winner: "Bia", index: 1, rotation: 0, at: 1 },
    };
    const edited = { ...spun, entries: [...entriesOf(spun), manualEntry("Caio", 5)] };
    expect(needsConfirmation(edited)).toBe(false);
    expect(confirmList(edited).names).toEqual(["Ana", "Bia"]);
  });

  it("shares exactly the names on the wheel, by display name", () => {
    const d = confirmList(draw(["Maria Silva (Centro)", "Maria Silva (Vila Rosa)", "João"]));
    const text = listMessage(d, "Padaria", GROUP);
    expect(text).toContain("✅ 3 pessoas confirmadas na roleta:");
    const listed = text.split("\n").filter((l) => /^\d+\. /.test(l)).map((l) => l.replace(/^\d+\. /, ""));
    expect(listed).toEqual(d.names);
  });

  it("turns repeated names in older saved lists into pending entries, never deleting them", () => {
    const old = {
      version: 1,
      currentId: "d1",
      merchants: [],
      sound: true,
      draws: [{ id: "d1", date: "2026-11-19", merchant: "P", prize: "C", names: ["Ana", "ana", "Bia"], createdAt: 1, isSample: true }],
    } as unknown as Parameters<typeof migrateState>[0];
    const d = migrateState(old).draws[0]!;
    expect(entriesOf(d)).toHaveLength(3);
    expect(pendingEntries(entriesOf(d)).map((e) => e.name)).toEqual(["ana"]);
    expect(d.names).toEqual(["Ana", "ana", "Bia"]);
  });
});

describe("Bot test (simulated)", () => {
  const msg = { name: "Carla Mendes", senderId: "Teste 001", time: "19:10", situation: "acertou" as const };

  it("adds a correct guess to the ready list", () => {
    const r = receiveBotMessage(draw(["Ana"]), msg, 1);
    expect(r.outcome).toBe("entrou");
    expect(readyNames(entriesOf(r.draw))).toEqual(["Ana", "Carla Mendes"]);
  });

  it("never gives a second spot to the same message sent again", () => {
    const once = receiveBotMessage(draw(["Ana"]), msg, 1).draw;
    const twice = receiveBotMessage(once, msg, 2);
    expect(twice.outcome).toBe("repetida");
    expect(entriesOf(twice.draw)).toHaveLength(2);
  });

  it("sends a merely similar name to review", () => {
    const r = receiveBotMessage(draw(["Carla Mendes"]), { ...msg, name: "Carla M. Mendes" }, 1);
    expect(r.outcome).toBe("revisao");
    expect(readyNames(entriesOf(r.draw))).toEqual(["Carla Mendes"]);
    expect(similarNames("Carla Mendes", "Karla Mendes")).toBe(true);
    expect(similarNames("Carla Mendes", "Bruno Lima")).toBe(false);
  });

  it("keeps one spot when the organizer says the manual and bot entries are the same person", () => {
    const r = receiveBotMessage(draw(["Carla Mendes"]), msg, 1);
    const pending = pendingEntries(entriesOf(r.draw))[0]!;
    const merged = mergeEntry(entriesOf(r.draw), pending.id, r.match!.id);
    expect(merged).toHaveLength(1);
    const again = receiveBotMessage({ ...r.draw, entries: merged }, msg, 2);
    expect(again.outcome).toBe("repetida");
    expect(entriesOf(again.draw)).toHaveLength(1);
  });

  it("accepts 19:29 and lets it be checked after closing; 19:30 stays out", () => {
    const early = receiveBotMessage(draw(["Ana"]), { ...msg, time: "19:29", situation: "conferir" }, 1);
    expect(early.outcome).toBe("revisao");
    const pending = pendingEntries(entriesOf(early.draw))[0]!;
    // Checked later, after the window closed: still allowed.
    expect(readyNames(confirmEntry(entriesOf(early.draw), pending.id))).toEqual(["Ana", "Carla Mendes"]);

    const late = receiveBotMessage(draw(["Ana"]), { ...msg, senderId: "Teste 002", time: "19:30" }, 1);
    expect(late.outcome).toBe("fora-do-prazo");
    expect(readyNames(entriesOf(late.draw))).toEqual(["Ana"]);
    expect(late.draw.botMessages?.[0]?.outcome).toBe("fora-do-prazo");
  });

  it("keeps each draw's list separate", () => {
    const a = receiveBotMessage(draw(["Ana"], "a"), msg, 1).draw;
    const b = draw(["Bia"], "b");
    expect(readyNames(entriesOf(a))).toEqual(["Ana", "Carla Mendes"]);
    expect(readyNames(entriesOf(b))).toEqual(["Bia"]);
  });

  it("never changes a spun draw", () => {
    const spun: Draw = { ...draw(["Ana", "Bia"]), result: { winner: "Ana", index: 0, rotation: 0, at: 1 } };
    expect(receiveBotMessage(spun, msg, 2).draw).toBe(spun);
  });
});
