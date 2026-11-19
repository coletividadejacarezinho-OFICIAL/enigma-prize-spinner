import { describe, expect, it } from "vitest";
import { buildManifest, videoPath } from "@/lib/enigma/backup";
import { createDraw } from "@/lib/enigma/logic";
import type { AppState, Merchant } from "@/lib/enigma/types";

const burger: Merchant = { id: "m1", name: "Burger 7", createdAt: 0 };
function state(): AppState {
  const a = {
    ...createDraw({ date: "2026-11-19", merchant: burger, prize: "Lanche", confirmed: true,
      more: [{ merchant: burger, prize: "Combo" }] }),
    names: ["Ana Souza", "Ana Souza (Centro)", "Bia"],
    result: { winner: "Bia", index: 2, rotation: 5, at: 1, entryId: "e3" },
    recordings: [
      { id: "r1", mode: "roleta-voz" as const, mic: true, startedAt: 1, durationMs: 9, real: true as const, mimeType: "video/webm" },
      { id: "r2", mode: "roleta-voz" as const, mic: true, startedAt: 2, durationMs: 9, real: true as const, mimeType: "video/mp4" },
      { id: "r3", mode: "voz" as const, mic: true, startedAt: 3, durationMs: 9 },
    ],
  };
  const b = createDraw({ date: "2026-11-19", merchant: burger, prize: "Lanche", confirmed: true });
  const s = { ...createDraw({ date: "2026-11-19", merchant: burger, prize: "X", confirmed: true }), isSample: true as const };
  return { version: 1, draws: [a, b, s], merchants: [burger], currentId: a.id, sound: true };
}

describe("Cópia de segurança", () => {
  it("keeps the exact saved text and ids, and separates rehearsals", () => {
    const st = state();
    const raw = JSON.stringify(st);
    const m = buildManifest(st, raw, "k", new Set(["r1"]), new Date("2026-11-19T12:00:00Z"));
    expect(m.savedData).toBe(raw);
    expect(m.exportedAt).toBe("2026-11-19T12:00:00.000Z");
    expect(m.summary.officialDraws).toEqual([st.draws[0]!.id, st.draws[1]!.id]);
    expect(m.summary.rehearsalDraws).toEqual([st.draws[2]!.id]);
    expect(m.summary.courtesies).toBe(4);
    expect(m.summary.results).toBe(1);
  });
  it("includes found videos and reports missing ones; simulated recordings have no file", () => {
    const st = state();
    const m = buildManifest(st, "", "k", new Set(["r1"]), new Date());
    expect(m.videos.map((v) => [v.recordingId, v.file])).toEqual([
      ["r1", videoPath("r1", "video/webm")],
      ["r2", null],
    ]);
    expect(m.summary.videosMissing).toEqual([{ recordingId: "r2", drawId: st.draws[0]!.id }]);
  });
});
