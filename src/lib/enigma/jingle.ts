/**
 * E06 spin track: an original, synthesized instrumental (no audio file, nothing remote).
 * Pure plan here (tested); `sound.ts` plays it. Notes follow the wheel's own easing, so the
 * music slows down with the wheel and the reveal chord lands when the wheel stops.
 */

/** Same easing as the wheel (`Wheel.tsx`): 1 - (1 - t)^4. */
export const wheelEase = (t: number) => 1 - Math.pow(1 - t, 4);

/** Seconds at which the wheel has covered k/count of its turn, for k = 0..count-1. */
export function spinNoteTimes(durationMs: number, count: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < count; k++)
    out.push((1 - Math.pow(1 - k / count, 1 / 4)) * (durationMs / 1000));
  return out;
}

/** Space the dense opening notes and add two soft beats through the final slow turns. */
export function spinBeatTimes(durationMs: number): number[] {
  const beats: number[] = [];
  for (const time of spinNoteTimes(durationMs, noteCount(durationMs))) {
    if (time - (beats.at(-1) ?? -Infinity) >= 0.09) beats.push(time);
  }
  for (const fraction of [0.78, 0.93]) {
    const time = (durationMs / 1000) * fraction;
    if (time - (beats.at(-1) ?? -Infinity) >= 0.09) beats.push(time);
  }
  return beats;
}

/** Cheerful loop (C major pentatonic, Hz); bass on the stronger beats. */
export const MELODY = [523.25, 659.25, 783.99, 659.25, 880, 783.99, 659.25, 587.33];
export const BASS = [130.81, 196, 174.61, 196];
/** Reveal chord (C major, rising). */
export const REVEAL = [523.25, 659.25, 783.99, 1046.5];

/** Number of melody notes for a spin: dense enough to feel lively, never thousands. */
export function noteCount(durationMs: number): number {
  return Math.max(8, Math.min(48, Math.round(durationMs / 120)));
}

/** 0..1 volume from a saved preference; default 0.7. */
export function clampVolume(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.7;
}

export type CountdownStep = 3 | 2 | 1 | "VALENDO!";
