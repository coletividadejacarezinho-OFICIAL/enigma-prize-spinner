import { describe, expect, it } from "vitest";
import {
  availableModes,
  mediaExtension,
  needsFor,
  pickType,
  recordedMusicLevel,
} from "@/lib/enigma/capture";

describe("E07 recording", () => {
  it("asks only for the devices the mode uses", () => {
    expect(needsFor("roleta-camera", true)).toEqual({ camera: true, mic: true });
    expect(needsFor("roleta-camera", false)).toEqual({ camera: true, mic: false });
    expect(needsFor("roleta-voz", false)).toEqual({ camera: false, mic: false });
    expect(needsFor("voz", false)).toEqual({ camera: false, mic: true });
  });
  it("offers the modes left when the camera or microphone is refused", () => {
    expect(availableModes({ camera: false, mic: true }).map((m) => m.mode)).toEqual([
      "roleta-voz",
      "voz",
    ]);
    expect(availableModes({ camera: false, mic: false })).toEqual([
      { mode: "roleta-voz", mic: false },
    ]);
  });
  it("names files by what was recorded", () => {
    expect(mediaExtension("video/mp4")).toBe("mp4");
    expect(mediaExtension("video/webm;codecs=vp8")).toBe("webm");
    expect(mediaExtension("audio/mp4")).toBe("m4a");
    expect(mediaExtension("audio/webm")).toBe("webm");
    expect(mediaExtension("audio/ogg")).toBe("ogg");
  });
  it("picks an audio type for voice only", () => {
    expect(pickType(true, (t) => t === "audio/webm")).toBe("audio/webm");
    expect(pickType(false, (t) => t === "audio/webm")).toBe("");
  });
  it("keeps the music under the voice and silent with Sem som", () => {
    expect(recordedMusicLevel(false, 1, true)).toBe(0);
    expect(recordedMusicLevel(true, 1, true)).toBe(0.35);
    expect(recordedMusicLevel(true, 1, false)).toBe(0.8);
  });
});
