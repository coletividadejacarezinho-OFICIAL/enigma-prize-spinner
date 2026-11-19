/** Browser-only sound. Every function is safe when the device blocks audio: it just stays silent. */
import { BASS, MELODY, REVEAL, noteCount, spinNoteTimes } from "./jingle";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    return ctx;
  } catch {
    return null;
  }
}

/** Call from the tap that starts the spin so phones allow sound. */
export function unlockSound() {
  audio();
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function note(
  a: AudioContext,
  out: AudioNode,
  freq: number,
  at: number,
  dur: number,
  vol: number,
  type: OscillatorType,
) {
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.03);
}

const active = new Set<() => void>();

/** Stops every sound this module started (leaving the screen, cancelling). */
export function stopAllSound() {
  for (const s of [...active]) s();
}

function master(a: AudioContext, volume: number) {
  const g = a.createGain();
  g.gain.value = volume;
  g.connect(a.destination);
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    active.delete(stop);
    try {
      g.gain.setTargetAtTime(0, a.currentTime, 0.05);
      setTimeout(() => g.disconnect(), 400);
    } catch {
      /* already gone */
    }
  };
  active.add(stop);
  return { g, stop };
}

/** The spin part: starts with the saved result's animation; returns stop(). */
export function startSpinTrack(durationMs: number, volume: number): () => void {
  const a = audio();
  if (!a || volume <= 0) return () => undefined;
  const { g, stop } = master(a, volume);
  const t0 = a.currentTime + 0.02;
  spinNoteTimes(durationMs, noteCount(durationMs)).forEach((t, i) => {
    note(a, g, MELODY[i % MELODY.length]!, t0 + t, 0.16, 0.16, "triangle");
    if (i % 4 === 0) note(a, g, BASS[(i / 4) % BASS.length]!, t0 + t, 0.3, 0.22, "sine");
  });
  return stop;
}

/** The reveal: played when the wheel stops on the saved result. */
export function playReveal(volume: number): () => void {
  const a = audio();
  if (!a || volume <= 0) return () => undefined;
  const { g, stop } = master(a, volume);
  const t0 = a.currentTime + 0.01;
  REVEAL.forEach((f, i) => note(a, g, f, t0 + i * 0.11, 0.5, 0.2, "triangle"));
  note(a, g, 1046.5, t0 + 0.5, 0.9, 0.18, "triangle");
  note(a, g, 130.81, t0 + 0.5, 0.9, 0.25, "sine");
  setTimeout(stop, 1800);
  return stop;
}

/** "Ouvir prévia": a short spin then the reveal. */
export function previewTrack(volume: number): () => void {
  const DURATION = 2500;
  const s = startSpinTrack(DURATION, volume);
  let r: () => void = () => undefined;
  const t = setTimeout(() => {
    s();
    r = playReveal(volume);
  }, DURATION);
  return () => {
    clearTimeout(t);
    s();
    r();
  };
}
