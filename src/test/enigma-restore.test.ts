import { describe, expect, it } from "vitest";
import { buildManifest } from "@/lib/enigma/backup";
import { checkBackup, planRestore } from "@/lib/enigma/restore";
import { createDraw } from "@/lib/enigma/logic";
import type { AppState, Merchant } from "@/lib/enigma/types";

const burger: Merchant = { id: "m1", name: "Burger 7", createdAt: 0 };
function st(): AppState {
  const a = {
    ...createDraw({ date: "2026-11-19", merchant: burger, prize: "Lanche", confirmed: true }),
    names: ["Ana", "Bia"],
    result: { winner: "Bia", index: 1, rotation: 5, at: 1 },
    recordings: [
      { id: "r1", mode: "voz" as const, mic: true, startedAt: 1, durationMs: 1, real: true as const, mimeType: "video/webm" },
      { id: "r2", mode: "voz" as const, mic: true, startedAt: 2, durationMs: 1, real: true as const, mimeType: "video/webm" },
    ],
  };
  const s = { ...createDraw({ date: "2026-11-19", merchant: burger, prize: "X", confirmed: true }), isSample: true as const };
  return { version: 1, draws: [a, s], merchants: [burger], currentId: a.id, sound: true };
}
function zipOf(state: AppState, withFiles = ["r1"]) {
  const raw = JSON.stringify(state);
  const m = buildManifest(state, raw, "k", new Set(withFiles), new Date("2026-11-19T10:00:00Z"));
  const paths = new Set(m.videos.flatMap((v) => (v.file ? [v.file] : [])));
  return { json: JSON.parse(JSON.stringify(m)) as unknown, paths };
}
const ok = (state: AppState, paths?: Set<string>) => {
  const z = zipOf(state);
  const r = checkBackup(z.json, paths ?? z.paths);
  if (!r.ok) throw new Error(r.message);
  return r.backup;
};

describe("Restaurar cópia", () => {
  it("refuses wrong format, other version and mismatched organized data", () => {
    const z = zipOf(st());
    expect(checkBackup({ a: 1 }, z.paths).ok).toBe(false);
    expect(checkBackup({ ...(z.json as object), backupVersion: 2 }, z.paths).ok).toBe(false);
    const j = z.json as { state: AppState };
    j.state.draws[0]!.names = ["Ana", "Zé"];
    expect(checkBackup(j, z.paths).ok).toBe(false);
  });
  it("refuses a winner not on the approved list", () => {
    const s = st();
    s.draws[0]!.result = { winner: "Zé", index: 0, rotation: 1, at: 1 };
    expect(checkBackup(zipOf(s).json, zipOf(s).paths).ok).toBe(false);
  });
  it("empty browser takes the exact saved text; videos missing in the zip stay unavailable", () => {
    const b = ok(st(), new Set());
    const p = planRestore(null, b, new Map());
    expect(p.newRaw).toBe(b.raw);
    expect(p.writeVideos.size).toBe(0);
    expect(p.unavailableVideos).toEqual(["r1", "r2"]);
    expect(p.counts).toMatchObject({ official: 1, rehearsals: 1 });
  });
  it("same backup twice adds nothing", () => {
    const s = st();
    const p = planRestore(s, ok(s), new Map([["r1", "same" as const]]));
    expect(p.newRaw).toBeNull();
    expect(p.writeVideos.size).toBe(0);
    expect(p.sameDraws).toBe(2);
  });
  it("adds new records and keeps local preferences", () => {
    const local: AppState = { ...st(), draws: [], merchants: [burger], sound: false, currentId: "" };
    const p = planRestore(local, ok(st()), new Map());
    const after = JSON.parse(p.newRaw!) as AppState;
    expect(after.draws).toHaveLength(2);
    expect(after.sound).toBe(false);
    expect([...p.writeVideos.keys()]).toEqual(["r1"]);
  });
  it("same id with other content, or a different video, is a conflict", () => {
    const s = st();
    const local = { ...s, draws: [{ ...s.draws[0]!, prize: "Outro" }, s.draws[1]!] };
    expect(planRestore(local, ok(s), new Map()).conflicts).toHaveLength(1);
    expect(planRestore(s, ok(s), new Map([["r1", "different" as const]])).conflicts).toHaveLength(1);
  });
});
