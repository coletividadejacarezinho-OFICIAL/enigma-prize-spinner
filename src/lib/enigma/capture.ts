/**
 * E07 pure recording rules: which devices each mode asks for, which modes are left
 * when a device is refused, file extensions and the music level mixed into the file.
 */
import type { RecordingMode } from "./types";

export type Needs = { camera: boolean; mic: boolean };

/** Asks only for what the chosen mode uses. "Só minha voz" always needs the microphone. */
export function needsFor(mode: RecordingMode, mic: boolean): Needs {
  if (mode === "voz") return { camera: false, mic: true };
  return { camera: mode === "roleta-camera", mic };
}

/** What the phone allowed: modes that still work, in the order they are offered. */
export function availableModes(allowed: {
  camera: boolean;
  mic: boolean;
}): { mode: RecordingMode; mic: boolean }[] {
  const out: { mode: RecordingMode; mic: boolean }[] = [];
  if (allowed.camera) out.push({ mode: "roleta-camera", mic: allowed.mic });
  out.push({ mode: "roleta-voz", mic: allowed.mic });
  if (allowed.mic) out.push({ mode: "voz", mic: true });
  return out;
}

/** File extension that matches what was really recorded. */
export function mediaExtension(mimeType: string | undefined): string {
  const t = (mimeType ?? "").toLowerCase();
  const audio = t.startsWith("audio/");
  if (t.includes("mp4") || t.includes("aac") || t.includes("m4a")) return audio ? "m4a" : "mp4";
  if (t.includes("ogg")) return "ogg";
  return "webm";
}

export function isAudioOnly(mimeType: string | undefined): boolean {
  return (mimeType ?? "").toLowerCase().startsWith("audio/");
}

export const VIDEO_TYPES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1,mp4a",
  "video/mp4;codecs=avc1,opus",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];
export const AUDIO_TYPES = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
];

export function pickType(audioOnly: boolean, supported: (t: string) => boolean): string {
  return (audioOnly ? AUDIO_TYPES : VIDEO_TYPES).find(supported) ?? "";
}

/**
 * Music level inside the file: mixed straight in (never through the loudspeaker),
 * and kept well under the voice when the microphone is on. 0 with "Sem som".
 */
export function recordedMusicLevel(sound: boolean, volume: number, micOn: boolean): number {
  if (!sound) return 0;
  const v = Math.min(1, Math.max(0, volume));
  return Math.round(v * (micOn ? 0.35 : 0.8) * 1000) / 1000;
}
