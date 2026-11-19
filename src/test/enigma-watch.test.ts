import { beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_AUDIENCE,
  audienceTotals,
  parseWatchState,
  readDemoLike,
  toggleDemoLike,
} from "@/lib/enigma/watch";

describe("Viewer demo page", () => {
  beforeEach(() => window.localStorage.clear());

  it("first tap on 👍 likes and the second tap undoes it", () => {
    expect(readDemoLike()).toBe(false);
    expect(toggleDemoLike()).toBe(true);
    expect(readDemoLike()).toBe(true);
    expect(toggleDemoLike()).toBe(false);
    expect(readDemoLike()).toBe(false);
  });

  it("falls back to 'Aguardando o sorteio' for unknown states", () => {
    expect(parseWatchState("encerrado")).toBe("encerrado");
    expect(parseWatchState("girar")).toBe("aguardando");
  });

  it("counts audience by action, and playing is never more than opening", () => {
    const t = audienceTotals(DEMO_AUDIENCE);
    expect(t.opened).toBe(DEMO_AUDIENCE.length);
    expect(t.played).toBeLessThanOrEqual(t.opened);
    expect(t.liked).toBeLessThanOrEqual(t.opened);
    expect(audienceTotals([{ name: "x", example: false, opened: true, played: false, liked: true }])).toEqual({
      opened: 1,
      played: 0,
      liked: 1,
    });
  });
});
